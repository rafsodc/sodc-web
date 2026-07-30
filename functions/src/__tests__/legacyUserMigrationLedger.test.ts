import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertLedgerBinding,
  createMigrationLedger,
  hasMigrationStage,
  readMigrationLedger,
  recordMigrationStage,
  writeMigrationLedger,
} from "../legacyUserMigrationLedger";

const temporaryDirectories: string[] = [];
const binding = {
  projectId: "sodc-web",
  migrationBatchId: "f3b47f8e-91d2-449f-a1cd-8545a705b423",
  recordSchemaVersion: "sodc-legacy-user/v1",
  sourceChecksum: "a".repeat(64),
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("legacy migration resume ledger", () => {
  it("records stages idempotently and rejects a UID change", () => {
    const ledger = createMigrationLedger(binding);
    recordMigrationStage(ledger, "legacy-id", "canonical-id", "auth-created");
    recordMigrationStage(ledger, "legacy-id", "canonical-id", "auth-created");

    expect(hasMigrationStage(ledger, "legacy-id", "auth-created")).toBe(true);
    expect(ledger.records["legacy-id"].stages).toEqual(["auth-created"]);
    expect(() =>
      recordMigrationStage(ledger, "legacy-id", "different", "profile-created")
    ).toThrow(/canonical UID conflict/);
  });

  it("binds resume to the exact project, batch, schema, and source", () => {
    const ledger = createMigrationLedger(binding);

    expect(() =>
      assertLedgerBinding(ledger, { ...binding, projectId: "another-project" })
    ).toThrow(/projectId/);
    expect(() =>
      assertLedgerBinding(ledger, {
        ...binding,
        sourceChecksum: "b".repeat(64),
      })
    ).toThrow(/sourceChecksum/);
  });

  it("writes an owner-only checkpoint without member data or hashes", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "sodc-migration-ledger-")
    );
    temporaryDirectories.push(directory);
    const ledgerPath = path.join(directory, "state.json");
    const ledger = createMigrationLedger(binding);
    recordMigrationStage(ledger, "legacy-id", "canonical-id", "profile-created");

    writeMigrationLedger(ledgerPath, ledger);
    const serialized = fs.readFileSync(ledgerPath, "utf8");
    const mode = fs.statSync(ledgerPath).mode & 0o777;

    expect(mode).toBe(0o600);
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("password");
    expect(readMigrationLedger(ledgerPath, binding)).toEqual(ledger);
  });

  it("rejects a malformed or manually extended stage list", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "sodc-migration-ledger-")
    );
    temporaryDirectories.push(directory);
    const ledgerPath = path.join(directory, "state.json");
    const ledger = createMigrationLedger(binding);
    ledger.records["legacy-id"] = {
      canonicalUid: "canonical-id",
      stages: ["access-reconciled"],
    };
    writeMigrationLedger(ledgerPath, ledger);
    const tampered = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    tampered.records["legacy-id"].stages.push("skip-everything");
    fs.writeFileSync(ledgerPath, JSON.stringify(tampered), { mode: 0o600 });

    expect(() => readMigrationLedger(ledgerPath, binding)).toThrow(
      /record is invalid/
    );
  });
});
