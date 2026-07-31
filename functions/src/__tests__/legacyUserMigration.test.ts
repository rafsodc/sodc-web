import { describe, expect, it } from "vitest";
import {
  batchesOf,
  LegacyRecordError,
  normalizeLegacyRecord,
  normalizeMobileNumber,
  parseLegacyRecord,
  passwordDisposition,
  reconcileLegacyRecord,
  validateJsonLines,
} from "../legacyUserMigration";

function sourceRecord(overrides: Record<string, unknown> = {}) {
  return {
    legacyUserId: "5b8e45ba-13cf-4bea-b1b0-362b02f9eb7a",
    oldUid: 123,
    email: " Member@Example.MOD.UK ",
    firstName: " Jane ",
    lastName: " Doe ",
    mobileNumber: "07700 900123",
    postNominals: " MBE ",
    serviceNumber: " 123456 ",
    rank: "Wing Commander",
    membershipStatus: "REGULAR",
    isShared: true,
    hasSubscriptions: false,
    passwordHash:
      "$2b$12$.....................................................",
    ...overrides,
  };
}

describe("legacy user migration validation", () => {
  it("applies the approved canonical transformations", () => {
    const normalized = normalizeLegacyRecord(parseLegacyRecord(sourceRecord()));

    expect(normalized).toMatchObject({
      email: "member@example.mod.uk",
      firstName: "Jane",
      lastName: "Doe",
      mobileNumber: "+447700900123",
      postNominals: "MBE",
      serviceNumber: "123456",
      rank: "Wing Commander",
      membershipStatus: "REGULAR",
      shareContactInfo: true,
      announcementOptOutAll: true,
      passwordDisposition: "compatible-bcrypt",
    });
  });

  it("uses approved placeholders and fail-closed sharing defaults", () => {
    const normalized = normalizeLegacyRecord(
      parseLegacyRecord(
        sourceRecord({
          mobileNumber: " ",
          postNominals: "",
          serviceNumber: null,
          rank: null,
          isShared: null,
          passwordHash: "",
        })
      )
    );

    expect(normalized.mobileNumber).toBeNull();
    expect(normalized.postNominals).toBeNull();
    expect(normalized.serviceNumber).toBe("N/A");
    expect(normalized.rank).toBe("Not specified");
    expect(normalized.shareContactInfo).toBe(false);
    expect(normalized.passwordHash).toBeNull();
    expect(normalized.warnings).toContain("null-sharing-defaulted");
  });

  it("allows an explicitly approved email-less LOST member", () => {
    const parsed = parseLegacyRecord(
      sourceRecord({
        legacyUserId: "c9a84048-6513-4d96-a237-e7ec36229589",
        email: null,
        membershipStatus: "LOST",
      })
    );

    expect(() => normalizeLegacyRecord(parsed)).toThrow(/email/);
    expect(
      normalizeLegacyRecord(parsed, { allowEmailLessLostMember: true })
    ).toMatchObject({
      email: "",
      membershipStatus: "LOST",
      passwordHash: expect.any(String),
      warnings: expect.arrayContaining(["email-less-lost-member"]),
    });
  });

  it("never allows the email-less exception for an enabled status", () => {
    const parsed = parseLegacyRecord(
      sourceRecord({ email: null, membershipStatus: "REGULAR" })
    );

    expect(() =>
      normalizeLegacyRecord(parsed, { allowEmailLessLostMember: true })
    ).toThrow(/email/);
  });

  it("does not treat multiple approved email-less LOST members as collisions", () => {
    const first = sourceRecord({
      email: null,
      membershipStatus: "LOST",
    });
    const second = sourceRecord({
      legacyUserId: "8508928c-bb13-45cc-bd3c-e228f46a7309",
      email: null,
      membershipStatus: "LOST",
    });
    const allowed = new Set([
      first.legacyUserId,
      second.legacyUserId,
    ]);

    const result = validateJsonLines(
      [JSON.stringify(first), JSON.stringify(second)],
      { allowEmailLessLegacyUserIds: allowed }
    );

    expect(result.records).toHaveLength(2);
    expect(result.quarantined).toEqual([]);
  });

  it.each([
    ["07700 900123", "+447700900123"],
    ["+44 (7700) 900-123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
    ["44 7700 900123", "+447700900123"],
  ])("normalizes %s to E.164", (input, expected) => {
    expect(normalizeMobileNumber(input)).toBe(expected);
  });

  it("quarantines invalid non-empty phone numbers", () => {
    expect(() => normalizeMobileNumber("not-a-phone")).toThrowError(
      LegacyRecordError
    );
  });

  it("rejects unexpected fields and non-canonical statuses", () => {
    expect(() => parseLegacyRecord(sourceRecord({ active: true }))).toThrowError(
      /unexpected field/
    );
    expect(() =>
      parseLegacyRecord(sourceRecord({ membershipStatus: "ACTIVE" }))
    ).toThrowError(/not canonical/);
  });

  it("classifies only structurally compatible bcrypt hashes for import", () => {
    expect(
      passwordDisposition(
        "$2a$10$....................................................."
      )
    ).toBe("compatible-bcrypt");
    expect(passwordDisposition("$argon2id$v=19$bad")).toBe("unsupported");
    expect(passwordDisposition(" ")).toBe("missing");
  });

  it("quarantines both sides of normalized email and UUID collisions", () => {
    const lines = [
      JSON.stringify(sourceRecord()),
      JSON.stringify(
        sourceRecord({
          legacyUserId: "3c488358-d893-44fb-a80c-2c89377dc8a3",
          email: "member@example.mod.uk",
        })
      ),
      JSON.stringify(
        sourceRecord({
          email: "other@example.mod.uk",
        })
      ),
    ];

    const result = validateJsonLines(lines);

    expect(result.records).toHaveLength(0);
    expect(result.quarantined).toEqual(
      expect.arrayContaining([
        { line: 1, reason: "duplicate-email" },
        { line: 2, reason: "duplicate-email" },
        { line: 1, reason: "duplicate-legacy-user-id" },
        { line: 3, reason: "duplicate-legacy-user-id" },
      ])
    );
  });

  it("keeps diagnostics non-sensitive", () => {
    const result = validateJsonLines([
      JSON.stringify(sourceRecord({ email: "not-an-email" })),
    ]);

    expect(result.quarantined).toEqual([{ line: 1, reason: "invalid-email" }]);
    expect(JSON.stringify(result)).not.toContain("not-an-email");
  });

  it("enforces Firebase's 1,000-user import batch maximum", () => {
    expect(batchesOf([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(() => batchesOf([], 1001)).toThrow(/between 1 and 1000/);
  });
});

describe("legacy identity reconciliation", () => {
  const record = normalizeLegacyRecord(parseLegacyRecord(sourceRecord()));
  const noEvidence = {
    authByLegacyUid: null,
    authByEmail: [],
    dataConnectByLegacyUid: null,
    dataConnectByEmail: [],
    legacyIdentity: null,
  };
  const provenance = {
    recordSchemaVersion: "sodc-legacy-user/v1",
    sourceChecksum: "a".repeat(64),
  };

  it("uses the legacy UUID only for a wholly new identity", () => {
    expect(reconcileLegacyRecord(record, noEvidence, provenance)).toMatchObject({
      outcome: "planned",
      plan: {
        canonicalUid: record.legacyUserId,
        createAuthUser: true,
        profileAction: "create-profile-and-identity",
      },
    });
  });

  it("reconciles an email-less LOST identity by its legacy UUID only", () => {
    const emailLessRecord = normalizeLegacyRecord(
      parseLegacyRecord(
        sourceRecord({ email: null, membershipStatus: "LOST" })
      ),
      { allowEmailLessLostMember: true }
    );

    expect(
      reconcileLegacyRecord(
        emailLessRecord,
        {
          ...noEvidence,
          authByLegacyUid: {
            uid: emailLessRecord.legacyUserId,
            email: null,
          },
        },
        provenance
      )
    ).toMatchObject({
      outcome: "planned",
      plan: {
        canonicalUid: emailLessRecord.legacyUserId,
        createAuthUser: false,
        profileAction: "create-profile-and-identity",
      },
    });
  });

  it("retains a proven existing Auth UID and creates only the missing profile", () => {
    expect(
      reconcileLegacyRecord(
        record,
        {
          ...noEvidence,
          authByEmail: [{ uid: "canonical-auth-uid", email: record.email }],
        },
        provenance
      )
    ).toMatchObject({
      outcome: "planned",
      plan: {
        canonicalUid: "canonical-auth-uid",
        createAuthUser: false,
        profileAction: "create-profile-and-identity",
      },
    });
  });

  it("links an existing profile without changing it", () => {
    expect(
      reconcileLegacyRecord(
        record,
        {
          ...noEvidence,
          authByEmail: [{ uid: "canonical-uid", email: record.email }],
          dataConnectByEmail: [{ id: "canonical-uid", email: record.email }],
        },
        provenance
      )
    ).toMatchObject({
      outcome: "planned",
      plan: {
        canonicalUid: "canonical-uid",
        createAuthUser: false,
        profileAction: "link-existing-profile",
      },
    });
  });

  it("quarantines contradictory Auth and Data Connect identities", () => {
    expect(
      reconcileLegacyRecord(
        record,
        {
          ...noEvidence,
          authByEmail: [{ uid: "auth-uid", email: record.email }],
          dataConnectByEmail: [{ id: "profile-uid", email: record.email }],
        },
        provenance
      )
    ).toEqual({
      outcome: "quarantined",
      reason: "identity-mapping-conflict",
    });
  });

  it("recognizes only an input-bound existing mapping as idempotent", () => {
    const compatible = reconcileLegacyRecord(
      record,
      {
        ...noEvidence,
        legacyIdentity: {
          userId: "canonical-uid",
          migrationBatchId: "batch",
          ...provenance,
        },
      },
      provenance
    );
    const conflicting = reconcileLegacyRecord(
      record,
      {
        ...noEvidence,
        legacyIdentity: {
          userId: "canonical-uid",
          migrationBatchId: "batch",
          recordSchemaVersion: provenance.recordSchemaVersion,
          sourceChecksum: "b".repeat(64),
        },
      },
      provenance
    );

    expect(compatible).toMatchObject({
      outcome: "planned",
      plan: { profileAction: "already-mapped" },
    });
    expect(conflicting).toEqual({
      outcome: "quarantined",
      reason: "identity-mapping-conflict",
    });
  });
});
