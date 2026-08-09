import { describe, expect, it } from "vitest";
import {
  APPROVED_LEGACY_MEMBERSHIP_STATUSES,
  APPROVED_LEGACY_RANK_TARGETS,
  buildLegacyMigrationApprovalStub,
  buildLegacyPreflightReviewWorksheet,
  legacyPreflightChecksum,
  parseLegacyPreflightReport,
  type LegacyPreflightReport,
} from "../legacyUserPreflightReview";

function valueCounts(present: number, blank = 0, nullCount = 0) {
  return { present, blank, null: nullCount };
}

function cohort(recordCount: number): LegacyPreflightReport["overall"] {
  return {
    recordCount,
    requiredFields: {
      usersComplete: recordCount - 1,
      usersMissingAny: 1,
      missingByField: { email: 0, firstName: 1, lastName: 0, serviceNumber: 0 },
    },
    fields: {
      legacyUserId: { present: recordCount },
      oldUid: { null: 1, present: recordCount - 1 },
      email: valueCounts(recordCount),
      firstName: valueCounts(recordCount - 1, 1),
      lastName: valueCounts(recordCount),
      mobileNumber: valueCounts(recordCount - 2, 1, 1),
      postNominals: valueCounts(0, 0, recordCount),
      serviceNumber: valueCounts(recordCount),
      rank: { null: 1, values: { "Squadron Leader": 1, Mr: recordCount - 2 } },
      membershipStatus: { REGULAR: recordCount - 1, PENDING: 1 },
      isShared: { true: recordCount - 1, false: 0, null: 1 },
      hasSubscriptions: { true: recordCount - 1, false: 1 },
      passwordHash: valueCounts(recordCount - 1, 0, 1),
    },
  };
}

function preflight(overrides: Partial<LegacyPreflightReport> = {}): LegacyPreflightReport {
  return {
    schemaVersion: "sodc-legacy-user-preflight/v3",
    recordSchemaVersion: "sodc-legacy-user/v1",
    sourceChecksum: "a".repeat(64),
    generatedAt: "2026-07-19T14:00:00Z",
    overall: cohort(3),
    byOldUid: { set: cohort(2), missing: cohort(1) },
    ...overrides,
  };
}

describe("parseLegacyPreflightReport", () => {
  it("parses a well-formed preflight report", () => {
    const parsed = parseLegacyPreflightReport(preflight());
    expect(parsed.overall.recordCount).toBe(3);
    expect(parsed.byOldUid.set.recordCount).toBe(2);
    expect(parsed.byOldUid.missing.recordCount).toBe(1);
  });

  it("rejects a non-object input", () => {
    expect(() => parseLegacyPreflightReport("not an object")).toThrow(/JSON object/);
    expect(() => parseLegacyPreflightReport(null)).toThrow(/JSON object/);
  });

  it("rejects an unsupported schema version", () => {
    expect(() =>
      parseLegacyPreflightReport({ ...preflight(), schemaVersion: "sodc-legacy-user-preflight/v1" })
    ).toThrow(/unsupported preflight schemaVersion/);
  });

  it("rejects an unsupported record schema version", () => {
    expect(() =>
      parseLegacyPreflightReport({ ...preflight(), recordSchemaVersion: "sodc-legacy-user/v0" })
    ).toThrow(/unsupported preflight recordSchemaVersion/);
  });

  it("rejects a missing generatedAt", () => {
    const { generatedAt: _generatedAt, ...rest } = preflight();
    expect(() => parseLegacyPreflightReport(rest)).toThrow(/generatedAt/);
  });

  it("rejects a malformed cohort", () => {
    const malformed = preflight();
    // @ts-expect-error intentionally malformed for the test
    malformed.overall.requiredFields = undefined;
    expect(() => parseLegacyPreflightReport(malformed)).toThrow(/requiredFields is malformed/);
  });

  it("rejects a missing byOldUid section", () => {
    const { byOldUid: _byOldUid, ...rest } = preflight();
    expect(() => parseLegacyPreflightReport(rest)).toThrow(/byOldUid is missing/);
  });
});

describe("buildLegacyPreflightReviewWorksheet", () => {
  it("includes the record count and every approved rank/status row", () => {
    const worksheet = buildLegacyPreflightReviewWorksheet(preflight());
    expect(worksheet).toContain("**Total exportable records:** 3");
    for (const rank of APPROVED_LEGACY_RANK_TARGETS) {
      expect(worksheet).toContain(`| ${rank} |`);
    }
    for (const status of APPROVED_LEGACY_MEMBERSHIP_STATUSES) {
      expect(worksheet).toContain(`| ${status} |`);
    }
  });

  it("flags rank values outside the approved list instead of silently dropping them", () => {
    const withUnexpectedRank = preflight();
    withUnexpectedRank.overall.fields.rank.values["Group Captain (legacy typo)"] = 1;
    const worksheet = buildLegacyPreflightReviewWorksheet(withUnexpectedRank);
    expect(worksheet).toContain("Unexpected:");
    expect(worksheet).toContain("Group Captain (legacy typo)");
  });

  it("flags membership status values outside the approved set", () => {
    const withUnexpectedStatus = preflight();
    withUnexpectedStatus.overall.fields.membershipStatus.RESERVE = 1;
    const worksheet = buildLegacyPreflightReviewWorksheet(withUnexpectedStatus);
    expect(worksheet).toContain("Unexpected:");
    expect(worksheet).toContain("RESERVE");
  });

  it("reports required-field gaps per field", () => {
    const worksheet = buildLegacyPreflightReviewWorksheet(preflight());
    expect(worksheet).toContain("| firstName | 1 |");
  });

  it("does not claim to detect duplicate emails from the preflight alone", () => {
    const worksheet = buildLegacyPreflightReviewWorksheet(preflight());
    expect(worksheet).toContain("but not duplicate-email");
  });

  it("notes that admin claims cannot be derived from this artifact", () => {
    const worksheet = buildLegacyPreflightReviewWorksheet(preflight());
    expect(worksheet).toContain("no `roles` field");
  });
});

describe("buildLegacyMigrationApprovalStub", () => {
  it("carries the record schema version and expected count, unapproved by default", () => {
    const checksum = legacyPreflightChecksum(JSON.stringify(preflight()));
    const stub = buildLegacyMigrationApprovalStub(preflight(), "sodc-web-production", checksum);
    expect(stub).toEqual({
      schemaVersion: "sodc-legacy-user-migration-approval/v2",
      issue: 420,
      approved: false,
      projectId: "sodc-web-production",
      sourceChecksum: expect.stringContaining("fill in"),
      preflightChecksum: checksum,
      recordSchemaVersion: "sodc-legacy-user/v1",
      expectedRecordCount: 3,
    });
  });

  it("rejects an approval stub without a valid preflight digest", () => {
    expect(() => buildLegacyMigrationApprovalStub(preflight(), "sodc-web-production", "bad"))
      .toThrow(/preflightChecksum/);
  });
});
