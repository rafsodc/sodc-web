#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as admin from "firebase-admin";
import {
  bcryptPilotSucceeded,
  generateSyntheticLegacyCredential,
  type BcryptPilotOutcome,
} from "../src/legacyBcryptPilot";

interface CliOptions {
  projectId: string;
  apiKey: string;
  costFactor: number;
  allowProduction: boolean;
}

function usage(): never {
  console.error(`Usage:
  npm run legacy-bcrypt-pilot -- \\
    --project sodc-web \\
    --api-key <Firebase Web API key for that project> \\
    [--cost 12] [--allow-production]

Proves that Firebase Authentication's BCRYPT import correctly verifies a
synthetic, legacy-format ($2y$) bcrypt hash before the real importer's
--bcrypt-proven flag is used. Creates one disposable test account under the
sodc-legacy-bcrypt-pilot.invalid domain, imports a hash for a freshly
generated random password, attempts to sign in with that password via
Firebase's REST API, then deletes the test account regardless of outcome.

No real member data, hashes, or passwords are read or displayed. The Web API
key is not secret (it identifies the project, not a credential) but should
still come from your own environment configuration, not be hardcoded here.

Refuses to run against a project aliased "prod" in .firebaserc unless
--allow-production is passed. There is normally no reason to: Firebase's
BCRYPT import behaviour is a platform property, not a per-project one, so
proving it once in a non-production project is sufficient.`);
  process.exit(2);
}

function parseArguments(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueOptions = new Set(["--project", "--api-key", "--cost"]);
  const flagOptions = new Set(["--allow-production", "--help"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") usage();
    if (flagOptions.has(argument)) {
      flags.add(argument);
      continue;
    }
    if (!valueOptions.has(argument)) usage();
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) usage();
    values.set(argument, value);
    index += 1;
  }
  const projectId = values.get("--project");
  const apiKey = values.get("--api-key");
  if (!projectId || !apiKey) usage();
  const costFactor = values.has("--cost") ? Number(values.get("--cost")) : 12;
  if (!Number.isInteger(costFactor) || costFactor < 4 || costFactor > 31) {
    console.error("--cost must be an integer bcrypt cost factor between 4 and 31");
    process.exit(2);
  }
  return {
    projectId,
    apiKey,
    costFactor,
    allowProduction: flags.has("--allow-production"),
  };
}

function guardAgainstProduction(options: CliOptions): void {
  if (options.allowProduction) return;
  const firebaseRcPath = path.join(__dirname, "..", "..", ".firebaserc");
  const firebaserc = JSON.parse(fs.readFileSync(firebaseRcPath, "utf8")) as {
    projects?: Record<string, string>;
  };
  const isProd = Object.entries(firebaserc.projects ?? {}).some(
    ([alias, id]) => alias.toLowerCase() === "prod" && id === options.projectId
  );
  if (isProd) {
    throw new Error(
      `refusing to run the bcrypt pilot against production project "${options.projectId}" ` +
        "without --allow-production -- there is no reason to run this against production; " +
        "prove it once in a non-production project."
    );
  }
}

async function signInWithPassword(
  apiKey: string,
  email: string,
  password: string
): Promise<boolean> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return response.ok;
}

async function runPilot(options: CliOptions): Promise<BcryptPilotOutcome> {
  admin.initializeApp({ projectId: options.projectId });

  const { password, hash } = generateSyntheticLegacyCredential(options.costFactor);
  const uid = `legacy-bcrypt-pilot-${randomBytes(8).toString("hex")}`;
  const email = `${uid}@sodc-legacy-bcrypt-pilot.invalid`;

  let hashImported = false;
  try {
    const result = await admin.auth().importUsers(
      [
        {
          uid,
          email,
          emailVerified: false,
          disabled: false,
          passwordHash: Buffer.from(hash, "utf8"),
        },
      ],
      { hash: { algorithm: "BCRYPT" } }
    );
    hashImported = result.failureCount === 0;
    if (!hashImported) {
      console.error(
        `Import failed: ${result.errors.map((error) => error.error.message).join("; ")}`
      );
    }

    const signInVerified = hashImported
      ? await signInWithPassword(options.apiKey, email, password)
      : false;

    return { hashImported, signInVerified, costFactor: options.costFactor };
  } finally {
    if (hashImported) {
      await admin
        .auth()
        .deleteUser(uid)
        .catch((error: unknown) => {
          console.error(
            `Warning: failed to delete pilot test account ${uid} -- delete it manually. ` +
              `${error instanceof Error ? error.message : "unknown error"}`
          );
        });
    }
  }
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  guardAgainstProduction(options);
  const outcome = await runPilot(options);

  console.log(JSON.stringify(outcome, null, 2));
  if (bcryptPilotSucceeded(outcome)) {
    console.log(
      "\nPASS: a synthetic $2y$ bcrypt hash imported and signed in successfully. " +
        "--bcrypt-proven is safe to use for this environment."
    );
  } else {
    console.error(
      "\nFAIL: Firebase did not accept or verify the synthetic $2y$ hash. " +
        "Do not use --bcrypt-proven until this is understood and resolved."
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    `Legacy bcrypt pilot stopped: ${error instanceof Error ? error.message : "unknown error"}`
  );
  process.exitCode = 1;
});
