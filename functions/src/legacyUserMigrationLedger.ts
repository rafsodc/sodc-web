import fs from "node:fs";
import path from "node:path";

export type MigrationStage =
  | "auth-created"
  | "profile-created"
  | "identity-linked"
  | "access-reconciled";

export interface MigrationLedgerBinding {
  projectId: string;
  migrationBatchId: string;
  recordSchemaVersion: string;
  sourceChecksum: string;
}

export interface MigrationLedgerRecord {
  canonicalUid: string;
  stages: MigrationStage[];
}

export interface MigrationLedger extends MigrationLedgerBinding {
  ledgerSchemaVersion: "sodc-legacy-user-import-ledger/v1";
  records: Record<string, MigrationLedgerRecord>;
  excludedRecords: Record<string, { reason: string }>;
}

export function createMigrationLedger(
  binding: MigrationLedgerBinding
): MigrationLedger {
  return {
    ledgerSchemaVersion: "sodc-legacy-user-import-ledger/v1",
    ...binding,
    records: {},
    excludedRecords: {},
  };
}

export function assertLedgerBinding(
  ledger: MigrationLedger,
  expected: MigrationLedgerBinding
): void {
  for (const field of [
    "projectId",
    "migrationBatchId",
    "recordSchemaVersion",
    "sourceChecksum",
  ] as const) {
    if (ledger[field] !== expected[field]) {
      throw new Error(`resume ledger ${field} does not match this import`);
    }
  }
}

export function hasMigrationStage(
  ledger: MigrationLedger,
  legacyUserId: string,
  stage: MigrationStage
): boolean {
  return ledger.records[legacyUserId]?.stages.includes(stage) ?? false;
}

export function recordMigrationStage(
  ledger: MigrationLedger,
  legacyUserId: string,
  canonicalUid: string,
  stage: MigrationStage
): void {
  if (ledger.excludedRecords[legacyUserId]) {
    throw new Error("excluded migration record cannot receive a stage");
  }
  const existing = ledger.records[legacyUserId];
  if (existing && existing.canonicalUid !== canonicalUid) {
    throw new Error("resume ledger canonical UID conflict");
  }
  const stages = existing?.stages ?? [];
  if (!stages.includes(stage)) {
    stages.push(stage);
  }
  ledger.records[legacyUserId] = { canonicalUid, stages };
}

export function readMigrationLedger(
  ledgerPath: string,
  expected: MigrationLedgerBinding
): MigrationLedger {
  const raw: unknown = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  if (
    raw === null ||
    typeof raw !== "object" ||
    (raw as { ledgerSchemaVersion?: unknown }).ledgerSchemaVersion !==
      "sodc-legacy-user-import-ledger/v1"
  ) {
    throw new Error("resume ledger schema is invalid");
  }
  const ledger = raw as MigrationLedger;
  assertLedgerBinding(ledger, expected);
  if (
    !ledger.records ||
    typeof ledger.records !== "object" ||
    Array.isArray(ledger.records)
  ) {
    throw new Error("resume ledger records are invalid");
  }
  if (
    !ledger.excludedRecords ||
    typeof ledger.excludedRecords !== "object" ||
    Array.isArray(ledger.excludedRecords)
  ) {
    throw new Error("resume ledger excluded records are invalid");
  }
  const validStages = new Set<MigrationStage>([
    "auth-created",
    "profile-created",
    "identity-linked",
    "access-reconciled",
  ]);
  for (const [legacyUserId, record] of Object.entries(ledger.records)) {
    if (
      !legacyUserId ||
      !record ||
      typeof record !== "object" ||
      typeof record.canonicalUid !== "string" ||
      !record.canonicalUid ||
      !Array.isArray(record.stages) ||
      record.stages.some(
        (stage) => typeof stage !== "string" || !validStages.has(stage)
      ) ||
      new Set(record.stages).size !== record.stages.length
    ) {
      throw new Error("resume ledger record is invalid");
    }
  }
  for (const [legacyUserId, exclusion] of Object.entries(
    ledger.excludedRecords
  )) {
    if (
      !legacyUserId ||
      ledger.records[legacyUserId] ||
      !exclusion ||
      typeof exclusion !== "object" ||
      typeof exclusion.reason !== "string" ||
      !exclusion.reason
    ) {
      throw new Error("resume ledger excluded record is invalid");
    }
  }
  return ledger;
}

export function recordMigrationExclusion(
  ledger: MigrationLedger,
  legacyUserId: string,
  reason: string
): void {
  if (ledger.records[legacyUserId]) {
    throw new Error("migration ledger record cannot also be excluded");
  }
  ledger.excludedRecords[legacyUserId] = { reason };
}

/**
 * Persists only migration IDs, stage names, and non-PII exclusion reason codes.
 * The temporary file is owner-only and atomically replaces the checkpoint.
 */
export function writeMigrationLedger(
  ledgerPath: string,
  ledger: MigrationLedger
): void {
  const directory = path.dirname(ledgerPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${ledgerPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(temporaryPath, 0o600);
  fs.renameSync(temporaryPath, ledgerPath);
  fs.chmodSync(ledgerPath, 0o600);
}
