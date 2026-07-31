import type { UserRecord } from "firebase-admin/auth";
import {
  hasMigrationStage,
  type MigrationLedger,
} from "./legacyUserMigrationLedger";
import {
  LEGACY_RECORD_SCHEMA_VERSION,
  LEGACY_SOURCE_SYSTEM,
  sha256Hex,
  type NormalizedLegacyUser,
} from "./legacyUserMigration";
import { isNonRestrictedStatus } from "./validation";

export const LEGACY_POSTFLIGHT_SCHEMA_VERSION =
  "sodc-legacy-user-postflight/v1";

export interface PostflightIdentity {
  sourceSystem: string;
  legacyUserId: string;
  oldUid?: number | null;
  migrationBatchId: string;
  recordSchemaVersion: string;
  sourceChecksum: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    mobileNumber?: string | null;
    postNominals?: string | null;
    rank?: string | null;
    membershipStatus: string;
    shareContactInfo?: boolean | null;
    announcementOptOutAll: boolean;
    legacyPasswordMigrated?: boolean | null;
    profileReviewedAt?: string | null;
  };
}

export type PostflightReason =
  | "source-record-missing-from-ledger"
  | "ledger-record-missing-from-source"
  | "ledger-stage-incomplete"
  | "identity-mapping-missing"
  | "identity-mapping-additional"
  | "identity-provenance-mismatch"
  | "canonical-uid-mismatch"
  | "auth-user-missing"
  | "auth-email-mismatch"
  | "auth-access-claim-mismatch"
  | "auth-disabled-state-mismatch"
  | "auth-email-verification-mismatch"
  | "profile-field-mismatch";

export interface PostflightDifference {
  correlationId: string;
  reasons: PostflightReason[];
}

export interface PostflightReport {
  schemaVersion: typeof LEGACY_POSTFLIGHT_SCHEMA_VERSION;
  outcome: "match" | "mismatch";
  projectId: string;
  migrationBatchId: string;
  recordSchemaVersion: string;
  sourceChecksum: string;
  counts: {
    rawSourceRecords: number;
    normalizedSourceRecords: number;
    sourceQuarantined: number;
    ledgerRecords: number;
    excludedRecords: number;
    identityMappings: number;
    authUsersMatched: number;
    profilesCreated: number;
    profilesLinked: number;
    compatibleBcryptPlanned: number;
    passwordResetRequired: number;
    credentialHashesDirectlyVerifiable: 0;
    differences: number;
  };
  reasonCounts: Partial<Record<PostflightReason, number>>;
  differences: PostflightDifference[];
  limitations: string[];
}

function correlationId(sourceChecksum: string, legacyUserId: string): string {
  return sha256Hex(`${sourceChecksum}:${legacyUserId}`).slice(0, 20);
}

function sameNullable(left: unknown, right: unknown): boolean {
  return (left ?? null) === (right ?? null);
}

function expectedProfile(
  record: NormalizedLegacyUser,
  legacyPasswordMigrated: boolean | null
): Record<string, unknown> {
  return {
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    serviceNumber: record.serviceNumber,
    mobileNumber: record.mobileNumber,
    postNominals: record.postNominals,
    rank: record.rank,
    membershipStatus: record.membershipStatus,
    shareContactInfo: record.shareContactInfo,
    announcementOptOutAll: record.announcementOptOutAll,
    legacyPasswordMigrated,
    profileReviewedAt: null,
  };
}

function profileMatches(
  actual: PostflightIdentity["user"],
  expected: NormalizedLegacyUser,
  legacyPasswordMigrated: boolean | null
): boolean {
  return Object.entries(
    expectedProfile(expected, legacyPasswordMigrated)
  ).every(([field, value]) =>
      sameNullable(actual[field as keyof typeof actual], value)
    );
}

export function buildLegacyUserPostflightReport(input: {
  projectId: string;
  rawSourceRecords: number;
  normalizedRecords: readonly NormalizedLegacyUser[];
  sourceQuarantined: number;
  ledger: MigrationLedger;
  identities: readonly PostflightIdentity[];
  authUsers: ReadonlyMap<string, UserRecord>;
  bcryptProven: boolean;
}): PostflightReport {
  const differences = new Map<string, Set<PostflightReason>>();
  const add = (legacyUserId: string, reason: PostflightReason): void => {
    const existing = differences.get(legacyUserId) ?? new Set();
    existing.add(reason);
    differences.set(legacyUserId, existing);
  };
  const sourceById = new Map(
    input.normalizedRecords.map((record) => [record.legacyUserId, record])
  );
  const identityById = new Map<string, PostflightIdentity>();
  for (const identity of input.identities) {
    if (identityById.has(identity.legacyUserId)) {
      add(identity.legacyUserId, "identity-provenance-mismatch");
    }
    identityById.set(identity.legacyUserId, identity);
  }

  for (const legacyUserId of sourceById.keys()) {
    if (
      !input.ledger.records[legacyUserId] &&
      !input.ledger.excludedRecords[legacyUserId]
    ) {
      add(legacyUserId, "source-record-missing-from-ledger");
    }
  }
  for (const legacyUserId of Object.keys(input.ledger.excludedRecords)) {
    if (!sourceById.has(legacyUserId)) {
      add(legacyUserId, "ledger-record-missing-from-source");
    }
  }
  for (const [legacyUserId, ledgerRecord] of Object.entries(
    input.ledger.records
  )) {
    const source = sourceById.get(legacyUserId);
    if (!source) {
      add(legacyUserId, "ledger-record-missing-from-source");
      continue;
    }
    if (!hasMigrationStage(input.ledger, legacyUserId, "access-reconciled")) {
      add(legacyUserId, "ledger-stage-incomplete");
    }
    const identity = identityById.get(legacyUserId);
    if (!identity) {
      add(legacyUserId, "identity-mapping-missing");
      continue;
    }
    if (
      identity.sourceSystem !== LEGACY_SOURCE_SYSTEM ||
      identity.migrationBatchId !== input.ledger.migrationBatchId ||
      identity.recordSchemaVersion !== LEGACY_RECORD_SCHEMA_VERSION ||
      identity.sourceChecksum !== input.ledger.sourceChecksum ||
      !sameNullable(identity.oldUid, source.oldUid)
    ) add(legacyUserId, "identity-provenance-mismatch");
    if (
      identity.user.id !== ledgerRecord.canonicalUid
    ) add(legacyUserId, "canonical-uid-mismatch");

    const auth = input.authUsers.get(ledgerRecord.canonicalUid);
    if (!auth) {
      add(legacyUserId, "auth-user-missing");
    } else {
      if ((auth.email ?? "").toLowerCase() !== source.email) {
        add(legacyUserId, "auth-email-mismatch");
      }
      const shouldBeEnabled = isNonRestrictedStatus(source.membershipStatus);
      if (auth.customClaims?.enabled !== shouldBeEnabled) {
        add(legacyUserId, "auth-access-claim-mismatch");
      }
      if (
        hasMigrationStage(input.ledger, legacyUserId, "auth-created") &&
        auth.disabled === shouldBeEnabled
      ) add(legacyUserId, "auth-disabled-state-mismatch");
      if (
        hasMigrationStage(input.ledger, legacyUserId, "auth-created") &&
        source.email &&
        auth.emailVerified
      ) add(legacyUserId, "auth-email-verification-mismatch");
    }

    if (hasMigrationStage(input.ledger, legacyUserId, "profile-created")) {
      const migrationCreatedAuth = hasMigrationStage(
        input.ledger,
        legacyUserId,
        "auth-created"
      );
      const legacyPasswordMigrated = migrationCreatedAuth
        ? Boolean(
            input.bcryptProven &&
              source.email &&
              source.passwordDisposition === "compatible-bcrypt"
          )
        : null;
      if (!profileMatches(identity.user, source, legacyPasswordMigrated)) {
        add(legacyUserId, "profile-field-mismatch");
      }
    } else if (identity.user.email.toLowerCase() !== source.email) {
      // Linked pre-existing profiles are deliberately not overwritten, but the
      // importer required their identity email to match before linking.
      add(legacyUserId, "profile-field-mismatch");
    }
  }
  for (const identity of input.identities) {
    if (!input.ledger.records[identity.legacyUserId]) {
      add(identity.legacyUserId, "identity-mapping-additional");
    }
  }

  const reportDifferences = [...differences.entries()]
    .map(([legacyUserId, reasons]) => ({
      correlationId: correlationId(input.ledger.sourceChecksum, legacyUserId),
      reasons: [...reasons].sort(),
    }))
    .sort((left, right) => left.correlationId.localeCompare(right.correlationId));
  const reasonCounts: Partial<Record<PostflightReason, number>> = {};
  for (const difference of reportDifferences) {
    for (const reason of difference.reasons) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }
  }
  const ledgerEntries = Object.entries(input.ledger.records);
  const authCreatedRecords = ledgerEntries.flatMap(([legacyUserId]) => {
    const source = sourceById.get(legacyUserId);
    return source &&
      hasMigrationStage(input.ledger, legacyUserId, "auth-created")
      ? [source]
      : [];
  });
  const authUsersMatched = ledgerEntries.filter(([, record]) =>
    input.authUsers.has(record.canonicalUid)
  ).length;

  return {
    schemaVersion: LEGACY_POSTFLIGHT_SCHEMA_VERSION,
    outcome: reportDifferences.length === 0 ? "match" : "mismatch",
    projectId: input.projectId,
    migrationBatchId: input.ledger.migrationBatchId,
    recordSchemaVersion: input.ledger.recordSchemaVersion,
    sourceChecksum: input.ledger.sourceChecksum,
    counts: {
      rawSourceRecords: input.rawSourceRecords,
      normalizedSourceRecords: input.normalizedRecords.length,
      sourceQuarantined: input.sourceQuarantined,
      ledgerRecords: ledgerEntries.length,
      excludedRecords: Object.keys(input.ledger.excludedRecords).length,
      identityMappings: input.identities.length,
      authUsersMatched,
      profilesCreated: ledgerEntries.filter(([id]) =>
        hasMigrationStage(input.ledger, id, "profile-created")
      ).length,
      profilesLinked: ledgerEntries.filter(([id]) =>
        hasMigrationStage(input.ledger, id, "identity-linked")
      ).length,
      compatibleBcryptPlanned: input.bcryptProven
        ? authCreatedRecords.filter(
            (record) =>
              Boolean(record.email) &&
              record.passwordDisposition === "compatible-bcrypt"
          ).length
        : 0,
      passwordResetRequired: authCreatedRecords.filter(
        (record) =>
          Boolean(record.email) &&
          (!input.bcryptProven ||
            record.passwordDisposition !== "compatible-bcrypt")
      ).length,
      credentialHashesDirectlyVerifiable: 0,
      differences: reportDifferences.length,
    },
    reasonCounts,
    differences: reportDifferences,
    limitations: [
      "Firebase Authentication does not expose imported password hashes; credential hash presence cannot be directly re-read.",
      "Fields on linked pre-existing profiles are not compared because the importer deliberately does not overwrite them.",
    ],
  };
}
