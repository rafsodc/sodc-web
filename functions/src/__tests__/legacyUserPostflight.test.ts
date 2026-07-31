import type { UserRecord } from "firebase-admin/auth";
import { describe, expect, it } from "vitest";
import type { NormalizedLegacyUser } from "../legacyUserMigration";
import {
  createMigrationLedger,
  recordMigrationExclusion,
  recordMigrationStage,
} from "../legacyUserMigrationLedger";
import {
  buildLegacyUserPostflightReport,
  type PostflightIdentity,
} from "../legacyUserPostflight";

const legacyUserId = "19eb78b8-d258-46f0-a3b7-d01a44a86bd9";
const binding = {
  projectId: "sodc-web",
  migrationBatchId: "f3b47f8e-91d2-449f-a1cd-8545a705b423",
  recordSchemaVersion: "sodc-legacy-user/v1",
  sourceChecksum: "a".repeat(64),
};
const record: NormalizedLegacyUser = {
  legacyUserId,
  oldUid: 123,
  email: "member@example.test",
  firstName: "Test",
  lastName: "Member",
  mobileNumber: "+447700900123",
  postNominals: null,
  serviceNumber: "A123",
  rank: "Squadron Leader",
  membershipStatus: "REGULAR",
  shareContactInfo: true,
  announcementOptOutAll: false,
  passwordHash: "$2b$10$" + "a".repeat(53),
  passwordDisposition: "compatible-bcrypt",
  warnings: [],
};

function identity(overrides: Partial<PostflightIdentity> = {}): PostflightIdentity {
  return {
    sourceSystem: "sodc-legacy",
    legacyUserId,
    oldUid: 123,
    migrationBatchId: binding.migrationBatchId,
    recordSchemaVersion: binding.recordSchemaVersion,
    sourceChecksum: binding.sourceChecksum,
    user: {
      id: legacyUserId,
      firstName: "Test",
      lastName: "Member",
      email: "member@example.test",
      serviceNumber: "A123",
      mobileNumber: "+447700900123",
      postNominals: null,
      rank: "Squadron Leader",
      membershipStatus: "REGULAR",
      shareContactInfo: true,
      announcementOptOutAll: false,
      legacyPasswordMigrated: true,
      profileReviewedAt: null,
    },
    ...overrides,
  };
}

function auth(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    uid: legacyUserId,
    email: "member@example.test",
    emailVerified: false,
    disabled: false,
    customClaims: { enabled: true },
    ...overrides,
  } as UserRecord;
}

function completedLedger() {
  const ledger = createMigrationLedger(binding);
  for (const stage of [
    "auth-created",
    "profile-created",
    "access-reconciled",
  ] as const) {
    recordMigrationStage(ledger, legacyUserId, legacyUserId, stage);
  }
  return ledger;
}

describe("legacy user postflight reconciliation", () => {
  it("reports a complete migration as a match without emitting PII", () => {
    const report = buildLegacyUserPostflightReport({
      projectId: binding.projectId,
      rawSourceRecords: 1,
      normalizedRecords: [record],
      sourceQuarantined: 0,
      ledger: completedLedger(),
      identities: [identity()],
      authUsers: new Map([[legacyUserId, auth()]]),
      bcryptProven: true,
    });

    expect(report.outcome).toBe("match");
    expect(report.counts.compatibleBcryptPlanned).toBe(1);
    expect(report.counts.credentialHashesDirectlyVerifiable).toBe(0);
    expect(JSON.stringify(report)).not.toContain(record.email);
    expect(JSON.stringify(report)).not.toContain(record.mobileNumber!);
  });

  it("reports field, access, provenance, and missing-state differences", () => {
    const report = buildLegacyUserPostflightReport({
      projectId: binding.projectId,
      rawSourceRecords: 1,
      normalizedRecords: [record],
      sourceQuarantined: 0,
      ledger: completedLedger(),
      identities: [
        identity({
          sourceChecksum: "b".repeat(64),
          user: { ...identity().user, firstName: "Wrong" },
        }),
      ],
      authUsers: new Map([
        [legacyUserId, auth({ disabled: true, customClaims: { enabled: false } })],
      ]),
      bcryptProven: false,
    });

    expect(report.outcome).toBe("mismatch");
    expect(report.reasonCounts).toMatchObject({
      "identity-provenance-mismatch": 1,
      "profile-field-mismatch": 1,
      "auth-access-claim-mismatch": 1,
      "auth-disabled-state-mismatch": 1,
    });
    expect(report.differences[0].correlationId).toHaveLength(20);
  });

  it("accepts a planned reconciliation exclusion without a destination record", () => {
    const ledger = createMigrationLedger(binding);
    recordMigrationExclusion(ledger, legacyUserId, "identity-mapping-conflict");
    const report = buildLegacyUserPostflightReport({
      projectId: binding.projectId,
      rawSourceRecords: 1,
      normalizedRecords: [record],
      sourceQuarantined: 0,
      ledger,
      identities: [],
      authUsers: new Map(),
      bcryptProven: false,
    });

    expect(report.outcome).toBe("match");
    expect(report.counts.excludedRecords).toBe(1);
  });
});
