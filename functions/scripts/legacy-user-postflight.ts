#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as admin from "firebase-admin";
import type { UserRecord } from "firebase-admin/auth";
import { listLegacyUserIdentitiesByBatch } from "@dataconnect/admin-generated";
import {
  LEGACY_RECORD_SCHEMA_VERSION,
  batchesOf,
  validateJsonLines,
} from "../src/legacyUserMigration";
import {
  decryptLegacyArtifact,
  effectiveLegacySourceChecksum,
  emailLessLegacyUserIds,
  readLegacyPreflight,
  remediateLegacyContacts,
} from "../src/legacyUserMigrationArtifact";
import {
  readMigrationLedger,
  type MigrationLedgerBinding,
} from "../src/legacyUserMigrationLedger";
import {
  buildLegacyUserPostflightReport,
  type PostflightIdentity,
} from "../src/legacyUserPostflight";

const MAX_MIGRATION_RECORDS = 10_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

interface CliOptions {
  inputPath: string;
  preflightPath: string;
  statePath: string;
  projectId: string;
  confirmProject: string;
  outputPath?: string;
  production: boolean;
  bcryptProven: boolean;
  interactiveRemediation: boolean;
}

function usage(): never {
  console.error(`Usage:
  npm run legacy-user-postflight -- \\
    --input ../secure/legacy-users.jsonl.gpg \\
    --preflight ../secure/preflight.json \\
    --state ../secure/import-ledger.json \\
    --project sodc-web \\
    --confirm-project sodc-web \\
    --output ../secure/postflight.json \\
    --interactive-remediation

Use the same remediation answers and --bcrypt-proven choice as the import.
Add --production when the selected .firebaserc project uses the prod alias.`);
  process.exit(2);
}

function parseArguments(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueOptions = new Set([
    "--input",
    "--preflight",
    "--state",
    "--project",
    "--confirm-project",
    "--output",
  ]);
  const flagOptions = new Set([
    "--production",
    "--bcrypt-proven",
    "--interactive-remediation",
    "--help",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) usage();
      values.set(argument, value);
      index += 1;
    } else if (flagOptions.has(argument)) {
      flags.add(argument);
    } else usage();
  }
  if (flags.has("--help")) usage();
  const inputPath = values.get("--input");
  const preflightPath = values.get("--preflight");
  const statePath = values.get("--state");
  const projectId = values.get("--project");
  const confirmProject = values.get("--confirm-project");
  if (!inputPath || !preflightPath || !statePath || !projectId) usage();
  if (confirmProject !== projectId) {
    throw new Error("--confirm-project must exactly match the target project");
  }
  return {
    inputPath,
    preflightPath,
    statePath,
    projectId,
    confirmProject,
    outputPath: values.get("--output"),
    production: flags.has("--production"),
    bcryptProven: flags.has("--bcrypt-proven"),
    interactiveRemediation: flags.has("--interactive-remediation"),
  };
}

function firebasercPath(): string {
  const candidates = [
    path.resolve(process.cwd(), ".firebaserc"),
    path.resolve(process.cwd(), "../.firebaserc"),
    path.resolve(__dirname, "../../.firebaserc"),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) throw new Error("could not find .firebaserc");
  return existing;
}

function assertProjectAllowed(options: CliOptions): void {
  const parsed = JSON.parse(fs.readFileSync(firebasercPath(), "utf8")) as {
    projects?: Record<string, unknown>;
  };
  const entries = Object.entries(parsed.projects ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  if (!entries.some(([, projectId]) => projectId === options.projectId)) {
    throw new Error("target project is not declared in .firebaserc");
  }
  const isProduction = entries.some(
    ([alias, projectId]) =>
      alias.toLowerCase() === "prod" && projectId === options.projectId
  );
  if (options.production !== isProduction) {
    throw new Error(
      isProduction
        ? "production target requires --production"
        : "--production was supplied for a non-production target"
    );
  }
}

function readLedgerBinding(
  statePath: string,
  projectId: string,
  sourceChecksum: string
): MigrationLedgerBinding {
  const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
    projectId?: unknown;
    migrationBatchId?: unknown;
    recordSchemaVersion?: unknown;
    sourceChecksum?: unknown;
  };
  if (
    parsed.projectId !== projectId ||
    typeof parsed.migrationBatchId !== "string" ||
    !UUID_PATTERN.test(parsed.migrationBatchId) ||
    parsed.recordSchemaVersion !== LEGACY_RECORD_SCHEMA_VERSION ||
    parsed.sourceChecksum !== sourceChecksum ||
    !SHA256_PATTERN.test(sourceChecksum)
  ) {
    throw new Error("import ledger is not bound to this effective migration plan");
  }
  return {
    projectId,
    migrationBatchId: parsed.migrationBatchId,
    recordSchemaVersion: LEGACY_RECORD_SCHEMA_VERSION,
    sourceChecksum,
  };
}

async function snapshotAuthUsers(
  canonicalUids: readonly string[]
): Promise<Map<string, UserRecord>> {
  const users = new Map<string, UserRecord>();
  for (const batch of batchesOf(canonicalUids, 100)) {
    const result = await admin.auth().getUsers(batch.map((uid) => ({ uid })));
    for (const user of result.users) users.set(user.uid, user);
  }
  return users;
}

function writeReport(outputPath: string, report: unknown): void {
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${outputPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(temporaryPath, 0o600);
  fs.renameSync(temporaryPath, outputPath);
  fs.chmodSync(outputPath, 0o600);
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  assertProjectAllowed(options);
  const preflight = readLegacyPreflight(options.preflightPath);
  console.log("Decrypting and reconstructing the effective migration plan...");
  const decrypted = await decryptLegacyArtifact(options.inputPath);
  const remediated = options.interactiveRemediation
    ? await remediateLegacyContacts(decrypted.plaintextLines)
    : { lines: decrypted.plaintextLines, remediations: [] };
  const validation = validateJsonLines(remediated.lines, {
    allowEmailLessLegacyUserIds: emailLessLegacyUserIds(
      remediated.lines,
      remediated.remediations
    ),
  });
  if (validation.recordCount !== preflight.overall.recordCount) {
    throw new Error("decrypted record count does not match preflight");
  }
  const sourceChecksum = effectiveLegacySourceChecksum(
    decrypted.artifactChecksum,
    remediated.remediations
  );
  const binding = readLedgerBinding(
    options.statePath,
    options.projectId,
    sourceChecksum
  );
  const ledger = readMigrationLedger(options.statePath, binding);

  if (!admin.apps.length) admin.initializeApp({ projectId: options.projectId });
  console.log("Taking read-only Auth and Data Connect postflight snapshots...");
  const [identityResult, authUsers] = await Promise.all([
    listLegacyUserIdentitiesByBatch({
      migrationBatchId: binding.migrationBatchId,
      limit: MAX_MIGRATION_RECORDS + 1,
    }),
    snapshotAuthUsers(
      Object.values(ledger.records).map(({ canonicalUid }) => canonicalUid)
    ),
  ]);
  const identities = identityResult.data.legacyUserIdentities;
  if (identities.length > MAX_MIGRATION_RECORDS) {
    throw new Error("postflight identity snapshot exceeds the safe CLI ceiling");
  }
  const report = buildLegacyUserPostflightReport({
    projectId: options.projectId,
    rawSourceRecords: validation.recordCount,
    normalizedRecords: validation.records,
    sourceQuarantined: new Set(
      validation.quarantined.map(({ line }) => line)
    ).size,
    ledger,
    identities: identities as PostflightIdentity[],
    authUsers,
    bcryptProven: options.bcryptProven,
  });
  console.log(JSON.stringify(report, null, 2));
  if (options.outputPath) writeReport(options.outputPath, report);
  if (report.outcome !== "match") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    `Legacy user postflight stopped: ${
      error instanceof Error ? error.message : "unknown error"
    }`
  );
  process.exitCode = 1;
});
