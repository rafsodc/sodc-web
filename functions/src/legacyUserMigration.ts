import { createHash } from "node:crypto";
import type { MembershipStatus } from "./validation";

export const LEGACY_SOURCE_SYSTEM = "sodc-legacy";
export const LEGACY_RECORD_SCHEMA_VERSION = "sodc-legacy-user/v1";
export const LEGACY_PREFLIGHT_SCHEMA_VERSION = "sodc-legacy-user-preflight/v3";

const SOURCE_FIELDS = [
  "legacyUserId",
  "oldUid",
  "email",
  "firstName",
  "lastName",
  "mobileNumber",
  "postNominals",
  "serviceNumber",
  "rank",
  "membershipStatus",
  "isShared",
  "hasSubscriptions",
  "passwordHash",
] as const;

const SOURCE_FIELD_SET = new Set<string>(SOURCE_FIELDS);
const LEGACY_MEMBERSHIP_STATUSES = new Set<MembershipStatus>([
  "PENDING",
  "REGULAR",
  "RETIRED",
  "RESIGNED",
  "LOST",
  "DECEASED",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export type LegacyPasswordDisposition =
  | "compatible-bcrypt"
  | "missing"
  | "unsupported";

export interface LegacyUserRecord {
  legacyUserId: string;
  oldUid: number | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  mobileNumber: string | null;
  postNominals: string | null;
  serviceNumber: string | null;
  rank: string | null;
  membershipStatus: MembershipStatus;
  isShared: boolean | null;
  hasSubscriptions: boolean;
  passwordHash: string | null;
}

export interface NormalizedLegacyUser {
  legacyUserId: string;
  oldUid: number | null;
  email: string;
  firstName: string;
  lastName: string;
  mobileNumber: string | null;
  postNominals: string | null;
  serviceNumber: string;
  rank: string;
  membershipStatus: MembershipStatus;
  shareContactInfo: boolean;
  announcementOptOutAll: boolean;
  passwordHash: string | null;
  passwordDisposition: LegacyPasswordDisposition;
  warnings: MigrationReason[];
}

export type MigrationReason =
  | "additional-field"
  | "duplicate-email"
  | "duplicate-legacy-user-id"
  | "invalid-email"
  | "invalid-field-type"
  | "invalid-json"
  | "invalid-mobile-number"
  | "invalid-membership-status"
  | "invalid-old-uid"
  | "invalid-uuid"
  | "missing-required-value"
  | "placeholder-email"
  | "email-less-lost-member"
  | "null-sharing-defaulted"
  | "unsupported-password-hash"
  | "auth-uid-email-conflict"
  | "ambiguous-auth-email"
  | "dataconnect-uid-email-conflict"
  | "ambiguous-dataconnect-email"
  | "identity-mapping-conflict"
  | "existing-auth-without-profile";

export class LegacyRecordError extends Error {
  constructor(
    readonly reason: MigrationReason,
    message: string
  ) {
    super(message);
    this.name = "LegacyRecordError";
  }
}

function requireNullableString(
  record: Record<string, unknown>,
  field: keyof LegacyUserRecord
): string | null {
  const value = record[field];
  if (value !== null && typeof value !== "string") {
    throw new LegacyRecordError(
      "invalid-field-type",
      `${field} must be a string or null`
    );
  }
  return value;
}

function requireTrimmed(
  value: string | null,
  field: string
): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new LegacyRecordError(
      "missing-required-value",
      `${field} must not be blank`
    );
  }
  return normalized;
}

function isPlaceholderEmail(email: string): boolean {
  const [local, domain = ""] = email.split("@");
  return (
    /^(no-?email|unknown|none|n\/a)([+._-].*)?$/i.test(local) ||
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net" ||
    domain.endsWith(".invalid")
  );
}

export function normalizeEmail(value: string | null): string {
  const email = requireTrimmed(value, "email").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new LegacyRecordError("invalid-email", "email is malformed");
  }
  if (isPlaceholderEmail(email)) {
    throw new LegacyRecordError(
      "placeholder-email",
      "email is a placeholder address"
    );
  }
  return email;
}

/**
 * Normalizes the legacy UK-centric phone data without guessing an international
 * country code for an otherwise ambiguous number.
 */
export function normalizeMobileNumber(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  let compact = trimmed.replace(/[\s().-]/g, "");
  if (compact.startsWith("00")) {
    compact = `+${compact.slice(2)}`;
  } else if (compact.startsWith("0")) {
    compact = `+44${compact.slice(1)}`;
  } else if (compact.startsWith("44")) {
    compact = `+${compact}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
    throw new LegacyRecordError(
      "invalid-mobile-number",
      "mobileNumber cannot be normalized to E.164"
    );
  }
  return compact;
}

export function passwordDisposition(
  value: string | null
): LegacyPasswordDisposition {
  const hash = value?.trim() ?? "";
  if (!hash) {
    return "missing";
  }
  return BCRYPT_PATTERN.test(hash) ? "compatible-bcrypt" : "unsupported";
}

export function parseLegacyRecord(value: unknown): LegacyUserRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new LegacyRecordError(
      "invalid-field-type",
      "record must be a JSON object"
    );
  }
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter((field) => !SOURCE_FIELD_SET.has(field));
  if (extra.length > 0) {
    throw new LegacyRecordError(
      "additional-field",
      `record contains unexpected field: ${extra[0]}`
    );
  }
  for (const field of SOURCE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      throw new LegacyRecordError(
        "missing-required-value",
        `record is missing ${field}`
      );
    }
  }

  const legacyUserId = record.legacyUserId;
  if (typeof legacyUserId !== "string" || !UUID_PATTERN.test(legacyUserId)) {
    throw new LegacyRecordError("invalid-uuid", "legacyUserId must be a UUID");
  }
  const oldUid = record.oldUid;
  if (
    oldUid !== null &&
    (typeof oldUid !== "number" ||
      !Number.isSafeInteger(oldUid) ||
      oldUid < 0)
  ) {
    throw new LegacyRecordError(
      "invalid-old-uid",
      "oldUid must be a non-negative integer or null"
    );
  }
  const membershipStatus = record.membershipStatus;
  if (
    typeof membershipStatus !== "string" ||
    !LEGACY_MEMBERSHIP_STATUSES.has(membershipStatus as MembershipStatus)
  ) {
    throw new LegacyRecordError(
      "invalid-membership-status",
      "membershipStatus is not canonical"
    );
  }
  if (record.isShared !== null && typeof record.isShared !== "boolean") {
    throw new LegacyRecordError(
      "invalid-field-type",
      "isShared must be a boolean or null"
    );
  }
  if (typeof record.hasSubscriptions !== "boolean") {
    throw new LegacyRecordError(
      "invalid-field-type",
      "hasSubscriptions must be a boolean"
    );
  }

  return {
    legacyUserId: legacyUserId.toLowerCase(),
    oldUid,
    email: requireNullableString(record, "email"),
    firstName: requireNullableString(record, "firstName"),
    lastName: requireNullableString(record, "lastName"),
    mobileNumber: requireNullableString(record, "mobileNumber"),
    postNominals: requireNullableString(record, "postNominals"),
    serviceNumber: requireNullableString(record, "serviceNumber"),
    rank: requireNullableString(record, "rank"),
    membershipStatus: membershipStatus as MembershipStatus,
    isShared: record.isShared,
    hasSubscriptions: record.hasSubscriptions,
    passwordHash: requireNullableString(record, "passwordHash"),
  };
}

export function normalizeLegacyRecord(
  input: LegacyUserRecord,
  options: { allowEmailLessLostMember?: boolean } = {}
): NormalizedLegacyUser {
  const disposition = passwordDisposition(input.passwordHash);
  const warnings: MigrationReason[] = [];
  if (input.isShared === null) {
    warnings.push("null-sharing-defaulted");
  }
  if (disposition === "unsupported") {
    warnings.push("unsupported-password-hash");
  }
  const emailLessLostMember =
    options.allowEmailLessLostMember === true &&
    input.membershipStatus === "LOST" &&
    !input.email?.trim();
  if (emailLessLostMember) {
    warnings.push("email-less-lost-member");
  }

  return {
    legacyUserId: input.legacyUserId,
    oldUid: input.oldUid,
    email: emailLessLostMember ? "" : normalizeEmail(input.email),
    firstName: requireTrimmed(input.firstName, "firstName"),
    lastName: requireTrimmed(input.lastName, "lastName"),
    mobileNumber: normalizeMobileNumber(input.mobileNumber),
    postNominals: input.postNominals?.trim() || null,
    serviceNumber: input.serviceNumber?.trim() || "N/A",
    rank: input.rank?.trim() || "Not specified",
    membershipStatus: input.membershipStatus,
    shareContactInfo: input.isShared ?? false,
    announcementOptOutAll: !input.hasSubscriptions,
    passwordHash:
      disposition === "compatible-bcrypt" ? input.passwordHash!.trim() : null,
    passwordDisposition: disposition,
    warnings,
  };
}

export interface ArtifactValidationResult {
  recordCount: number;
  records: NormalizedLegacyUser[];
  quarantined: Array<{ line: number; reason: MigrationReason }>;
}

export function validateJsonLines(
  lines: Iterable<string>,
  options: { allowEmailLessLegacyUserIds?: ReadonlySet<string> } = {}
): ArtifactValidationResult {
  const accepted: Array<{ line: number; record: NormalizedLegacyUser }> = [];
  const quarantined: Array<{ line: number; reason: MigrationReason }> = [];
  const legacyIds = new Map<string, number>();
  const emails = new Map<string, number>();

  let lineNumber = 0;
  let recordCount = 0;
  for (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) {
      continue;
    }
    recordCount += 1;
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new LegacyRecordError("invalid-json", "line is not valid JSON");
      }
      const parsedRecord = parseLegacyRecord(parsed);
      const normalized = normalizeLegacyRecord(parsedRecord, {
        allowEmailLessLostMember:
          options.allowEmailLessLegacyUserIds?.has(
            parsedRecord.legacyUserId
          ) ?? false,
      });
      const previousIdLine = legacyIds.get(normalized.legacyUserId);
      if (previousIdLine !== undefined) {
        quarantined.push({
          line: previousIdLine,
          reason: "duplicate-legacy-user-id",
        });
        throw new LegacyRecordError(
          "duplicate-legacy-user-id",
          "legacyUserId appears more than once"
        );
      }
      if (normalized.email) {
        const previousEmailLine = emails.get(normalized.email);
        if (previousEmailLine !== undefined) {
          quarantined.push({
            line: previousEmailLine,
            reason: "duplicate-email",
          });
          throw new LegacyRecordError(
            "duplicate-email",
            "normalized email appears more than once"
          );
        }
        emails.set(normalized.email, lineNumber);
      }
      legacyIds.set(normalized.legacyUserId, lineNumber);
      accepted.push({ line: lineNumber, record: normalized });
    } catch (error) {
      if (!(error instanceof LegacyRecordError)) {
        throw error;
      }
      quarantined.push({ line: lineNumber, reason: error.reason });
    }
  }

  const quarantinedLines = new Set(quarantined.map(({ line }) => line));
  return {
    recordCount,
    records: accepted
      .filter(({ line }) => !quarantinedLines.has(line))
      .map(({ record }) => record),
    quarantined: Array.from(
      new Map(
        quarantined.map((item) => [`${item.line}:${item.reason}`, item])
      ).values()
    ).sort((left, right) => left.line - right.line),
  };
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function batchesOf<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1 || size > 1000) {
    throw new Error("batch size must be between 1 and 1000");
  }
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export interface ExistingAuthUser {
  uid: string;
  email: string | null;
}

export interface ExistingDataConnectUser {
  id: string;
  email: string;
}

export interface ExistingLegacyIdentity {
  userId: string;
  migrationBatchId: string;
  recordSchemaVersion: string;
  sourceChecksum: string;
}

export interface ReconciliationEvidence {
  authByLegacyUid: ExistingAuthUser | null;
  authByEmail: ExistingAuthUser[];
  dataConnectByLegacyUid: ExistingDataConnectUser | null;
  dataConnectByEmail: ExistingDataConnectUser[];
  legacyIdentity: ExistingLegacyIdentity | null;
}

export type MigrationProfileAction =
  | "create-profile-and-identity"
  | "link-existing-profile"
  | "already-mapped";

export interface PlannedMigrationRecord {
  record: NormalizedLegacyUser;
  canonicalUid: string;
  createAuthUser: boolean;
  profileAction: MigrationProfileAction;
  preExistingAuthUser: boolean;
}

export type ReconciliationResult =
  | { outcome: "planned"; plan: PlannedMigrationRecord }
  | { outcome: "quarantined"; reason: MigrationReason };

function normalizedExistingEmail(value: string | null): string | null {
  return value?.trim().toLowerCase() || null;
}

function uniqueIdentityId<T>(
  matches: readonly T[],
  id: (match: T) => string
): string | null {
  const ids = new Set(matches.map(id));
  return ids.size === 1 ? ids.values().next().value ?? null : null;
}

/**
 * Chooses a canonical UID only from exact UID/email evidence. It never uses the
 * nullable numeric oldUid and never mutates an existing profile while linking.
 */
export function reconcileLegacyRecord(
  record: NormalizedLegacyUser,
  evidence: ReconciliationEvidence,
  provenance: {
    recordSchemaVersion: string;
    sourceChecksum: string;
  }
): ReconciliationResult {
  const recordEmail = record.email || null;
  const mapping = evidence.legacyIdentity;
  if (mapping) {
    if (
      mapping.recordSchemaVersion !== provenance.recordSchemaVersion ||
      mapping.sourceChecksum !== provenance.sourceChecksum
    ) {
      return { outcome: "quarantined", reason: "identity-mapping-conflict" };
    }
    const conflictingAuthMatch = evidence.authByEmail.some(
      (user) => user.uid !== mapping.userId
    );
    if (conflictingAuthMatch) {
      return { outcome: "quarantined", reason: "identity-mapping-conflict" };
    }
    return {
      outcome: "planned",
      plan: {
        record,
        canonicalUid: mapping.userId,
        createAuthUser: evidence.authByLegacyUid === null,
        profileAction: "already-mapped",
        preExistingAuthUser: evidence.authByLegacyUid !== null,
      },
    };
  }

  if (
    evidence.authByLegacyUid &&
    normalizedExistingEmail(evidence.authByLegacyUid.email) !== recordEmail
  ) {
    return { outcome: "quarantined", reason: "auth-uid-email-conflict" };
  }
  const matchingAuthUsers = evidence.authByEmail.filter(
    (user) => normalizedExistingEmail(user.email) === recordEmail
  );
  const authEmailUid = uniqueIdentityId(matchingAuthUsers, (user) => user.uid);
  if (matchingAuthUsers.length > 0 && authEmailUid === null) {
    return { outcome: "quarantined", reason: "ambiguous-auth-email" };
  }
  if (
    evidence.authByLegacyUid &&
    authEmailUid &&
    evidence.authByLegacyUid.uid !== authEmailUid
  ) {
    return { outcome: "quarantined", reason: "auth-uid-email-conflict" };
  }

  if (
    evidence.dataConnectByLegacyUid &&
    normalizedExistingEmail(evidence.dataConnectByLegacyUid.email) !==
      recordEmail
  ) {
    return {
      outcome: "quarantined",
      reason: "dataconnect-uid-email-conflict",
    };
  }
  const matchingProfiles = evidence.dataConnectByEmail.filter(
    (user) => normalizedExistingEmail(user.email) === recordEmail
  );
  const profileEmailUid = uniqueIdentityId(
    matchingProfiles,
    (user) => user.id
  );
  if (matchingProfiles.length > 0 && profileEmailUid === null) {
    return {
      outcome: "quarantined",
      reason: "ambiguous-dataconnect-email",
    };
  }
  if (
    evidence.dataConnectByLegacyUid &&
    profileEmailUid &&
    evidence.dataConnectByLegacyUid.id !== profileEmailUid
  ) {
    return {
      outcome: "quarantined",
      reason: "dataconnect-uid-email-conflict",
    };
  }

  const authUid = evidence.authByLegacyUid?.uid ?? authEmailUid ?? null;
  const profileUid =
    evidence.dataConnectByLegacyUid?.id ?? profileEmailUid ?? null;
  if (authUid && profileUid && authUid !== profileUid) {
    return { outcome: "quarantined", reason: "identity-mapping-conflict" };
  }

  const canonicalUid = authUid ?? profileUid ?? record.legacyUserId;
  return {
    outcome: "planned",
    plan: {
      record,
      canonicalUid,
      createAuthUser: authUid === null,
      profileAction: profileUid
        ? "link-existing-profile"
        : "create-profile-and-identity",
      preExistingAuthUser: authUid !== null,
    },
  };
}
