import { createHash } from "node:crypto";
import fs from "node:fs";
import readline from "node:readline";
import readlinePromises from "node:readline/promises";
import { spawn } from "node:child_process";
import {
  LEGACY_PREFLIGHT_SCHEMA_VERSION,
  LEGACY_RECORD_SCHEMA_VERSION,
  LegacyRecordError,
  normalizeEmail,
  normalizeMobileNumber,
  parseLegacyRecord,
  sha256Hex,
} from "./legacyUserMigration";

export interface LegacyPreflight {
  schemaVersion: string;
  recordSchemaVersion: string;
  sourceChecksum: string;
  overall: { recordCount: number };
}

export interface ContactRemediation {
  line: number;
  email?: string | null;
  mobileNumber?: string | null;
  membershipStatus?: "LOST";
}

export function readLegacyPreflight(preflightPath: string): LegacyPreflight {
  const parsed: unknown = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("preflight must be a JSON object");
  }
  const preflight = parsed as LegacyPreflight;
  if (preflight.schemaVersion !== LEGACY_PREFLIGHT_SCHEMA_VERSION) {
    throw new Error("unsupported preflight schema version");
  }
  if (preflight.recordSchemaVersion !== LEGACY_RECORD_SCHEMA_VERSION) {
    throw new Error("unsupported legacy record schema version");
  }
  if (!/^[0-9a-f]{64}$/.test(preflight.sourceChecksum)) {
    throw new Error("preflight source checksum is invalid");
  }
  if (
    !preflight.overall ||
    !Number.isInteger(preflight.overall.recordCount) ||
    preflight.overall.recordCount < 0
  ) {
    throw new Error("preflight record count is invalid");
  }
  return preflight;
}

/** Proves that the reviewed preflight was produced from these exact decrypted bytes. */
export function assertLegacyPreflightSourceBinding(
  preflight: LegacyPreflight,
  artifactChecksum: string
): void {
  if (preflight.sourceChecksum !== artifactChecksum) {
    throw new Error("preflight does not match the decrypted legacy source artifact");
  }
}

export async function decryptLegacyArtifact(inputPath: string): Promise<{
  artifactChecksum: string;
  plaintextLines: string[];
}> {
  if (!fs.statSync(inputPath).isFile()) {
    throw new Error("encrypted input is not a file");
  }
  // GPG owns passphrase handling through its configured pinentry program. The
  // process reads decrypted bytes only from stdout and never persists them.
  const child = spawn("gpg", ["--quiet", "--decrypt", inputPath], {
    stdio: ["inherit", "pipe", "pipe"],
  });
  const exit = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  const digest = createHash("sha256");
  child.stdout.on("data", (chunk: Buffer) => digest.update(chunk));
  let stderrBytes = 0;
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBytes += chunk.length;
  });

  const lines = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });
  const plaintextLines: string[] = [];
  for await (const line of lines) {
    plaintextLines.push(line);
  }
  const exitCode = await exit;
  if (exitCode !== 0) {
    throw new Error(
      `GPG decryption failed (exit ${exitCode}, ${stderrBytes} diagnostic bytes)`
    );
  }
  return { artifactChecksum: digest.digest("hex"), plaintextLines };
}

function terminalSafe(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  return Array.from(text, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)
      ? "?"
      : character;
  })
    .join("")
    .slice(0, 200);
}

function memberLabel(record: {
  firstName: string | null;
  lastName: string | null;
  serviceNumber: string | null;
}): string {
  const name = `${terminalSafe(record.firstName)} ${terminalSafe(
    record.lastName
  )}`.trim();
  const serviceNumber = terminalSafe(record.serviceNumber) || "not supplied";
  return `${name || "Unnamed member"} (service number: ${serviceNumber})`;
}

function isEmailRemediationError(error: unknown): boolean {
  return (
    error instanceof LegacyRecordError &&
    ["invalid-email", "placeholder-email", "missing-required-value"].includes(
      error.reason
    )
  );
}

export async function remediateLegacyContacts(
  lines: readonly string[]
): Promise<{ lines: string[]; remediations: ContactRemediation[] }> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "--interactive-remediation requires an interactive local terminal"
    );
  }
  console.error(
    "Interactive remediation displays member PII locally. " +
      "Do not record, capture, or share this terminal session."
  );
  const prompt = readlinePromises.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const remediatedLines: string[] = [];
  const remediations: ContactRemediation[] = [];

  try {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim()) {
        remediatedLines.push(line);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        remediatedLines.push(line);
        continue;
      }
      let record;
      try {
        record = parseLegacyRecord(parsed);
      } catch {
        remediatedLines.push(line);
        continue;
      }
      const remediation: ContactRemediation = { line: index + 1 };
      try {
        normalizeEmail(record.email);
      } catch (error) {
        if (!isEmailRemediationError(error)) throw error;
        console.error(
          `\nInvalid email for ${memberLabel(record)}: ` +
            `"${terminalSafe(record.email)}"`
        );
        while (true) {
          const replacement = await prompt.question(
            "Replacement email, LOST for an email-less lost member, " +
              "or SKIP to quarantine: "
          );
          const action = replacement.trim().toUpperCase();
          if (action === "SKIP") break;
          if (action === "LOST") {
            record.email = null;
            record.membershipStatus = "LOST";
            remediation.email = null;
            remediation.membershipStatus = "LOST";
            break;
          }
          try {
            record.email = normalizeEmail(replacement);
            remediation.email = record.email;
            break;
          } catch {
            console.error("That is not a valid non-placeholder email address.");
          }
        }
      }

      try {
        normalizeMobileNumber(record.mobileNumber);
      } catch (error) {
        if (
          !(error instanceof LegacyRecordError) ||
          error.reason !== "invalid-mobile-number"
        ) throw error;
        console.error(
          `\nInvalid mobile for ${memberLabel(record)}: ` +
            `"${terminalSafe(record.mobileNumber)}"`
        );
        while (true) {
          const replacement = await prompt.question(
            "Replacement mobile (press Enter to clear it): "
          );
          try {
            record.mobileNumber = normalizeMobileNumber(replacement);
            remediation.mobileNumber = record.mobileNumber;
            break;
          } catch {
            console.error(
              "That number cannot be normalized to E.164; retry or press Enter."
            );
          }
        }
      }

      if (
        remediation.email !== undefined ||
        remediation.mobileNumber !== undefined
      ) remediations.push(remediation);
      remediatedLines.push(JSON.stringify(record));
    }
  } finally {
    prompt.close();
  }
  return { lines: remediatedLines, remediations };
}

export function effectiveLegacySourceChecksum(
  artifactChecksum: string,
  remediations: readonly ContactRemediation[]
): string {
  return remediations.length === 0
    ? artifactChecksum
    : sha256Hex(JSON.stringify({ artifactChecksum, remediations }));
}

export function emailLessLegacyUserIds(
  lines: readonly string[],
  remediations: readonly ContactRemediation[]
): Set<string> {
  return new Set(
    remediations
      .filter(
        ({ email, membershipStatus }) =>
          email === null && membershipStatus === "LOST"
      )
      .map(({ line }) => {
        const parsed: unknown = JSON.parse(lines[line - 1]);
        return parseLegacyRecord(parsed).legacyUserId;
      })
  );
}
