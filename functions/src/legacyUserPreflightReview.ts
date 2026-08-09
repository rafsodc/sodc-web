import {
  LEGACY_PREFLIGHT_SCHEMA_VERSION,
  LEGACY_RECORD_SCHEMA_VERSION,
  sha256Hex,
} from "./legacyUserMigration";

/**
 * Mirrors sodc-api's LegacyUserExportSchema::RANKS target values. The exporter fails
 * closed (throws before producing a preflight) if a legacy user's rank isn't one of
 * these -- so every rank value that can appear in a real preflight is already an
 * approved mapping. Keep this list in sync with LegacyUserExportSchema.php.
 */
export const APPROVED_LEGACY_RANK_TARGETS = [
  "Squadron Leader",
  "Air Chief Marshal",
  "Air Marshal",
  "Air Vice-Marshal",
  "Air Commodore",
  "Group Captain",
  "Wing Commander",
  "Flight Lieutenant",
  "Mr",
  "Dr",
  "Flying Officer",
  "Mrs",
  "Ms",
] as const;

/**
 * Mirrors sodc-api's LegacyUserExportSchema::MEMBERSHIP_STATUSES -- the exporter's
 * role-precedence mapping (ROLE_RESIGNED > ROLE_DECEASED > ROLE_LOST > ROLE_SERVING >
 * ROLE_RETIRED, else isMember ? REGULAR : PENDING) can only ever produce these six
 * values. This is a deliberate subset of the platform's full MembershipStatus enum --
 * the legacy system has no reliable way to distinguish RESERVE, CIVIL_SERVICE, or
 * INDUSTRY, so no migrated account lands in those statuses automatically.
 */
export const APPROVED_LEGACY_MEMBERSHIP_STATUSES = [
  "PENDING",
  "REGULAR",
  "RETIRED",
  "RESIGNED",
  "LOST",
  "DECEASED",
] as const;

interface ValueCounts {
  null: number;
  blank: number;
  present: number;
}

interface PreflightCohort {
  recordCount: number;
  requiredFields: {
    usersComplete: number;
    usersMissingAny: number;
    missingByField: Record<string, number>;
  };
  fields: {
    legacyUserId: { present: number };
    oldUid: { null: number; present: number };
    email: ValueCounts;
    firstName: ValueCounts;
    lastName: ValueCounts;
    mobileNumber: ValueCounts;
    postNominals: ValueCounts;
    serviceNumber: ValueCounts;
    rank: { null: number; values: Record<string, number> };
    membershipStatus: Record<string, number>;
    isShared: { true: number; false: number; null: number };
    hasSubscriptions: { true: number; false: number };
    passwordHash: ValueCounts;
  };
}

export interface LegacyPreflightReport {
  schemaVersion: string;
  recordSchemaVersion: string;
  generatedAt: string;
  overall: PreflightCohort;
  byOldUid: { set: PreflightCohort; missing: PreflightCohort };
}

function requireValueCounts(value: unknown, path: string): ValueCounts {
  if (
    !value ||
    typeof value !== "object" ||
    !Number.isInteger((value as ValueCounts).null) ||
    !Number.isInteger((value as ValueCounts).blank) ||
    !Number.isInteger((value as ValueCounts).present)
  ) {
    throw new Error(`preflight field ${path} must have null/blank/present integer counts`);
  }
  return value as ValueCounts;
}

function requireCohort(value: unknown, path: string): PreflightCohort {
  if (!value || typeof value !== "object") {
    throw new Error(`preflight cohort ${path} must be an object`);
  }
  const cohort = value as Record<string, unknown>;
  if (!Number.isInteger(cohort.recordCount) || (cohort.recordCount as number) < 0) {
    throw new Error(`preflight cohort ${path}.recordCount must be a non-negative integer`);
  }
  const requiredFields = cohort.requiredFields as PreflightCohort["requiredFields"] | undefined;
  if (
    !requiredFields ||
    !Number.isInteger(requiredFields.usersComplete) ||
    !Number.isInteger(requiredFields.usersMissingAny) ||
    !requiredFields.missingByField ||
    typeof requiredFields.missingByField !== "object"
  ) {
    throw new Error(`preflight cohort ${path}.requiredFields is malformed`);
  }
  const fields = cohort.fields as Record<string, unknown> | undefined;
  if (!fields || typeof fields !== "object") {
    throw new Error(`preflight cohort ${path}.fields must be an object`);
  }
  const legacyUserId = fields.legacyUserId as { present?: unknown } | undefined;
  if (!legacyUserId || !Number.isInteger(legacyUserId.present)) {
    throw new Error(`preflight cohort ${path}.fields.legacyUserId is malformed`);
  }
  const oldUid = fields.oldUid as { null?: unknown; present?: unknown } | undefined;
  if (!oldUid || !Number.isInteger(oldUid.null) || !Number.isInteger(oldUid.present)) {
    throw new Error(`preflight cohort ${path}.fields.oldUid is malformed`);
  }
  for (const field of [
    "email",
    "firstName",
    "lastName",
    "mobileNumber",
    "postNominals",
    "serviceNumber",
    "passwordHash",
  ]) {
    requireValueCounts(fields[field], `${path}.fields.${field}`);
  }
  const rank = fields.rank as { null?: unknown; values?: unknown } | undefined;
  if (!rank || !Number.isInteger(rank.null) || !rank.values || typeof rank.values !== "object") {
    throw new Error(`preflight cohort ${path}.fields.rank is malformed`);
  }
  const membershipStatus = fields.membershipStatus;
  if (!membershipStatus || typeof membershipStatus !== "object") {
    throw new Error(`preflight cohort ${path}.fields.membershipStatus is malformed`);
  }
  const isShared = fields.isShared as { true?: unknown; false?: unknown; null?: unknown } | undefined;
  if (
    !isShared ||
    !Number.isInteger(isShared.true) ||
    !Number.isInteger(isShared.false) ||
    !Number.isInteger(isShared.null)
  ) {
    throw new Error(`preflight cohort ${path}.fields.isShared is malformed`);
  }
  const hasSubscriptions = fields.hasSubscriptions as { true?: unknown; false?: unknown } | undefined;
  if (!hasSubscriptions || !Number.isInteger(hasSubscriptions.true) || !Number.isInteger(hasSubscriptions.false)) {
    throw new Error(`preflight cohort ${path}.fields.hasSubscriptions is malformed`);
  }
  return cohort as unknown as PreflightCohort;
}

/** Parses and structurally validates a real sodc-api preflight report. Fails closed on any shape mismatch. */
export function parseLegacyPreflightReport(raw: unknown): LegacyPreflightReport {
  if (!raw || typeof raw !== "object") {
    throw new Error("preflight report must be a JSON object");
  }
  const report = raw as Record<string, unknown>;
  if (report.schemaVersion !== LEGACY_PREFLIGHT_SCHEMA_VERSION) {
    throw new Error(
      `unsupported preflight schemaVersion (expected ${LEGACY_PREFLIGHT_SCHEMA_VERSION})`
    );
  }
  if (report.recordSchemaVersion !== LEGACY_RECORD_SCHEMA_VERSION) {
    throw new Error(
      `unsupported preflight recordSchemaVersion (expected ${LEGACY_RECORD_SCHEMA_VERSION})`
    );
  }
  if (typeof report.generatedAt !== "string" || !report.generatedAt) {
    throw new Error("preflight report generatedAt must be a non-empty string");
  }
  const overall = requireCohort(report.overall, "overall");
  const byOldUid = report.byOldUid as Record<string, unknown> | undefined;
  if (!byOldUid) {
    throw new Error("preflight report byOldUid is missing");
  }
  return {
    schemaVersion: report.schemaVersion,
    recordSchemaVersion: report.recordSchemaVersion,
    generatedAt: report.generatedAt,
    overall,
    byOldUid: {
      set: requireCohort(byOldUid.set, "byOldUid.set"),
      missing: requireCohort(byOldUid.missing, "byOldUid.missing"),
    },
  };
}

function pct(part: number, total: number): string {
  if (total === 0) return "n/a";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function formatValueCounts(counts: ValueCounts, total: number): string {
  return (
    `present ${counts.present} (${pct(counts.present, total)}), ` +
    `blank ${counts.blank} (${pct(counts.blank, total)}), ` +
    `null ${counts.null} (${pct(counts.null, total)})`
  );
}

/**
 * Renders the non-PII preflight counts as a Markdown worksheet structured around
 * issue #420's own acceptance criteria, so a reviewer works through each decision
 * with the actual computed numbers in front of them instead of a blank checklist.
 */
export function buildLegacyPreflightReviewWorksheet(report: LegacyPreflightReport): string {
  const { overall, byOldUid } = report;
  const total = overall.recordCount;
  const lines: string[] = [];

  lines.push("# Legacy user migration -- preflight review worksheet (issue #420)");
  lines.push("");
  lines.push(
    `Generated from a \`${report.recordSchemaVersion}\` preflight report ` +
      `(\`${report.schemaVersion}\`, produced ${report.generatedAt}). Non-PII aggregate counts only.`
  );
  lines.push("");
  lines.push(`**Total exportable records:** ${total}`);
  lines.push(
    `- with a legacy \`oldUid\`: ${byOldUid.set.recordCount} (${pct(byOldUid.set.recordCount, total)})`
  );
  lines.push(
    "- without a legacy `oldUid` (provenance only, never used as an identity key): " +
      `${byOldUid.missing.recordCount} (${pct(byOldUid.missing.recordCount, total)})`
  );
  lines.push(
    "- accounts with `ROLE_DELETED` are already excluded by the exporter and never appear here"
  );
  lines.push("");

  lines.push("## 1. Every legacy rank is mapped or quarantined");
  lines.push("");
  lines.push(
    "The exporter fails closed on any rank without an approved mapping, so every value " +
      "below is already an approved target rank. Review the distribution for plausibility only."
  );
  lines.push("");
  lines.push("| Rank | Count | % |");
  lines.push("|---|---:|---:|");
  for (const rank of APPROVED_LEGACY_RANK_TARGETS) {
    const count = overall.fields.rank.values[rank] ?? 0;
    lines.push(`| ${rank} | ${count} | ${pct(count, total)} |`);
  }
  lines.push(`| _(no rank recorded)_ | ${overall.fields.rank.null} | ${pct(overall.fields.rank.null, total)} |`);
  const unexpectedRanks = Object.keys(overall.fields.rank.values).filter(
    (value) => !(APPROVED_LEGACY_RANK_TARGETS as readonly string[]).includes(value)
  );
  if (unexpectedRanks.length > 0) {
    lines.push("");
    lines.push(
      "**Unexpected:** rank value(s) not in the approved list appeared in this report: " +
        `${unexpectedRanks.join(", ")}. Stop and investigate before continuing -- this should ` +
        "not be possible if the exporter and this reviewer are on the same schema version."
    );
  }
  lines.push("");
  lines.push("- [ ] Rank distribution reviewed and looks plausible for the membership.");
  lines.push("");

  lines.push("## 2. Every account has an approved status or explicit exclusion");
  lines.push("");
  lines.push(
    "Status is already assigned by role precedence (`ROLE_RESIGNED` > `ROLE_DECEASED` > " +
      "`ROLE_LOST` > `ROLE_SERVING` > `ROLE_RETIRED`), falling back to `REGULAR` when `isMember` " +
      "is true or `PENDING` otherwise. No migrated account can land in `RESERVE`, " +
      "`CIVIL_SERVICE`, or `INDUSTRY` automatically -- the legacy system cannot distinguish them."
  );
  lines.push("");
  lines.push("| Status | Count | % |");
  lines.push("|---|---:|---:|");
  for (const status of APPROVED_LEGACY_MEMBERSHIP_STATUSES) {
    const count = overall.fields.membershipStatus[status] ?? 0;
    lines.push(`| ${status} | ${count} | ${pct(count, total)} |`);
  }
  const unexpectedStatuses = Object.keys(overall.fields.membershipStatus).filter(
    (value) => !(APPROVED_LEGACY_MEMBERSHIP_STATUSES as readonly string[]).includes(value)
  );
  if (unexpectedStatuses.length > 0) {
    lines.push("");
    lines.push(
      `**Unexpected:** status value(s) outside the approved set appeared: ${unexpectedStatuses.join(", ")}. ` +
        "Stop and investigate before continuing."
    );
  }
  lines.push("");
  lines.push(
    "- [ ] Status distribution reviewed; any status that looks disproportionate " +
      "(e.g. an unexpectedly high `PENDING` or `LOST` count) has been spot-checked."
  );
  lines.push(
    "- [ ] Accounts that should be `RESERVE`/`CIVIL_SERVICE`/`INDUSTRY` are accepted as a " +
      "post-migration manual correction, not blocking this migration."
  );
  lines.push("");

  lines.push("## 3. Email, required-field, and identity conflicts");
  lines.push("");
  lines.push(
    "Required fields (`email`, `firstName`, `lastName`, `serviceNumber`): " +
      `${overall.requiredFields.usersComplete} complete ` +
      `(${pct(overall.requiredFields.usersComplete, total)}), ` +
      `${overall.requiredFields.usersMissingAny} missing at least one ` +
      `(${pct(overall.requiredFields.usersMissingAny, total)}).`
  );
  lines.push("");
  lines.push("| Field | Missing count |");
  lines.push("|---|---:|");
  for (const [field, count] of Object.entries(overall.requiredFields.missingByField)) {
    lines.push(`| ${field} | ${count} |`);
  }
  lines.push("");
  lines.push(
    "**Note:** this preflight reports missing/blank required fields, but not duplicate-email " +
      "or duplicate-identity counts -- those are only resolved at import time, when the importer " +
      "reconciles each record against existing Firebase/Data Connect accounts and against other " +
      "rows in the same artifact. Review the importer's dry-run create/link/conflict counts " +
      "separately before approving apply."
  );
  lines.push("");
  lines.push(
    "- [ ] Missing-required-field counts reviewed; remediation plan agreed for blank " +
      "`firstName`/`lastName` (fail closed) and blank `serviceNumber` (becomes `N/A`)."
  );
  lines.push("- [ ] Dry-run's email/identity collision report reviewed separately (not derivable from this preflight alone).");
  lines.push("");

  lines.push("## 4. Sharing and communications defaults");
  lines.push("");
  lines.push(
    `\`isShared\` (-> \`shareContactInfo\`): true ${overall.fields.isShared.true} ` +
      `(${pct(overall.fields.isShared.true, total)}), false ${overall.fields.isShared.false} ` +
      `(${pct(overall.fields.isShared.false, total)}), null ${overall.fields.isShared.null} ` +
      `(${pct(overall.fields.isShared.null, total)}). Null defaults to \`shareContactInfo=false\` ` +
      "(privacy-safe) until the member confirms their profile."
  );
  lines.push("");
  lines.push(
    `\`hasSubscriptions\` (-> \`announcementOptOutAll\`, inverted): true ${overall.fields.hasSubscriptions.true} ` +
      `(${pct(overall.fields.hasSubscriptions.true, total)}) become \`announcementOptOutAll=false\`; ` +
      `false ${overall.fields.hasSubscriptions.false} (${pct(overall.fields.hasSubscriptions.false, total)}) ` +
      "become `announcementOptOutAll=true`."
  );
  lines.push("");
  lines.push("- [ ] Contact-sharing null-default (`false`) confirmed as the agreed privacy fallback.");
  lines.push("- [ ] Communications opt-out mapping confirmed; no explicit legacy opt-out is silently overridden.");
  lines.push("");

  lines.push("## 5. Admin restoration allowlist");
  lines.push("");
  lines.push(
    "Not derivable from this artifact -- the exported record schema has no `roles` field, so " +
      "`ROLE_ADMIN` never reaches this pipeline. Admin claims must come from a separately " +
      "reviewed allowlist applied after migration, never inferred from legacy data."
  );
  lines.push("");
  lines.push("- [ ] Admin allowlist prepared and reviewed separately from this worksheet.");
  lines.push("");

  lines.push("## 6. Password credentials");
  lines.push("");
  lines.push(
    `\`passwordHash\`: ${formatValueCounts(overall.fields.passwordHash, total)}. Blank/null ` +
      "hashes always follow the in-app password-reset path; a compatible-bcrypt proof in " +
      "staging is required before any hash is imported (`--bcrypt-proven`)."
  );
  lines.push("");
  lines.push("- [ ] Blank-password count reviewed (evidence of no legacy login, not automatic `LOST`).");
  lines.push("- [ ] Representative bcrypt hash format piloted against a non-production Firebase project.");
  lines.push("");

  lines.push("## Sign-off");
  lines.push("");
  lines.push(
    `- [ ] All sections above reviewed for record count **${total}** ` +
      `(schema \`${report.recordSchemaVersion}\`, generated ${report.generatedAt}).`
  );
  lines.push(
    "- [ ] Ready to run the importer dry-run and produce the `sourceChecksum` for the approval artifact."
  );
  lines.push("");

  return lines.join("\n");
}

export interface LegacyMigrationApprovalStub {
  schemaVersion: "sodc-legacy-user-migration-approval/v2";
  issue: 420;
  approved: false;
  projectId: string;
  sourceChecksum: string;
  preflightChecksum: string;
  recordSchemaVersion: string;
  expectedRecordCount: number;
}

/**
 * Produces an approval-artifact stub matching what legacy-user-import.ts's --approval
 * flag expects (see docs/operations/legacy-user-import.md). sourceChecksum cannot be
 * filled in from the preflight alone -- it is only known once the importer's dry-run
 * decrypts and hashes the real encrypted artifact -- so it's left as an explicit
 * placeholder. The operator fills it in, then flips approved to true once every
 * worksheet section above has been signed off.
 */
export function buildLegacyMigrationApprovalStub(
  report: LegacyPreflightReport,
  projectId: string,
  preflightChecksum: string,
): LegacyMigrationApprovalStub {
  if (!/^[0-9a-f]{64}$/.test(preflightChecksum)) {
    throw new Error("preflightChecksum must be a lowercase SHA-256 digest");
  }
  return {
    schemaVersion: "sodc-legacy-user-migration-approval/v2",
    issue: 420,
    approved: false,
    projectId,
    sourceChecksum: "<fill in from importer dry-run output>",
    preflightChecksum,
    recordSchemaVersion: report.recordSchemaVersion,
    expectedRecordCount: report.overall.recordCount,
  };
}

/** Binds approval to the exact preflight file bytes reviewed by the operator. */
export function legacyPreflightChecksum(content: string): string {
  return sha256Hex(content);
}
