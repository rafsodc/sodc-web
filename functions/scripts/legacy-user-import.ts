#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as admin from "firebase-admin";
import type { UserImportRecord, UserRecord } from "firebase-admin/auth";
import {
  createMigratedUserProfileAndIdentity,
  linkLegacyIdentityToExistingUser,
  listLegacyUserIdentitiesForMigration,
  listMigrationUsers,
  MembershipStatus as DataConnectMembershipStatus,
} from "@dataconnect/admin-generated";
import {
  LEGACY_RECORD_SCHEMA_VERSION,
  LEGACY_SOURCE_SYSTEM,
  batchesOf,
  type ExistingAuthUser,
  type ExistingDataConnectUser,
  type ExistingLegacyIdentity,
  type MigrationReason,
  type NormalizedLegacyUser,
  type PlannedMigrationRecord,
  reconcileLegacyRecord,
  validateJsonLines,
} from "../src/legacyUserMigration";
import {
  decryptLegacyArtifact,
  effectiveLegacySourceChecksum,
  emailLessLegacyUserIds,
  readLegacyPreflight,
  remediateLegacyContacts,
  type ContactRemediation,
} from "../src/legacyUserMigrationArtifact";
import {
  createMigrationLedger,
  hasMigrationStage,
  readMigrationLedger,
  recordMigrationExclusion,
  recordMigrationStage,
  writeMigrationLedger,
  type MigrationLedger,
  type MigrationLedgerBinding,
} from "../src/legacyUserMigrationLedger";
import { isNonRestrictedStatus } from "../src/validation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_IDENTITY_SNAPSHOT = 10_000;

interface CliOptions {
  inputPath: string;
  preflightPath: string;
  projectId: string;
  apply: boolean;
  migrationBatchId?: string;
  statePath?: string;
  resume: boolean;
  batchSize: number;
  confirmProject?: string;
  production: boolean;
  approvalPath?: string;
  bcryptProven: boolean;
  interactiveRemediation: boolean;
  allowQuarantineCount?: number;
}

interface ProductionApproval {
  schemaVersion: string;
  issue: number;
  approved: boolean;
  projectId: string;
  sourceChecksum: string;
  recordSchemaVersion: string;
  expectedRecordCount: number;
}

interface IdentitySnapshot {
  authByUid: Map<string, ExistingAuthUser>;
  authByEmail: Map<string, ExistingAuthUser[]>;
  dataConnectByUid: Map<string, ExistingDataConnectUser>;
  dataConnectByEmail: Map<string, ExistingDataConnectUser[]>;
  mappingsByLegacyId: Map<string, ExistingLegacyIdentity>;
}

function usage(): never {
  console.error(`Usage:
  npm run legacy-user-import -- \\
    --input ../secure/legacy-users.jsonl.gpg \\
    --preflight ../secure/preflight.json \\
    --project sodc-web

Dry-run is the default. Apply additionally requires:
  --apply --batch-id <uuid> --state <path> --confirm-project <exact-project>
  --allow-quarantine-count <exact-count>  (only when the plan quarantines rows)
  --bcrypt-proven                         (only after staging proves compatibility)
  --interactive-remediation               (secure local terminal only)

Production apply additionally requires:
  --production --approval <approved-issue-420-artifact.json>`);
  process.exit(2);
}

function parseArguments(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueOptions = new Set([
    "--input",
    "--preflight",
    "--project",
    "--batch-id",
    "--state",
    "--batch-size",
    "--confirm-project",
    "--approval",
    "--allow-quarantine-count",
  ]);
  const flagOptions = new Set([
    "--apply",
    "--dry-run",
    "--resume",
    "--production",
    "--bcrypt-proven",
    "--interactive-remediation",
    "--help",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        usage();
      }
      values.set(argument, value);
      index += 1;
    } else if (flagOptions.has(argument)) {
      flags.add(argument);
    } else {
      usage();
    }
  }
  if (flags.has("--help")) {
    usage();
  }
  const inputPath = values.get("--input");
  const preflightPath = values.get("--preflight");
  const projectId = values.get("--project");
  if (!inputPath || !preflightPath || !projectId) {
    usage();
  }
  if (flags.has("--apply") && flags.has("--dry-run")) {
    throw new Error("--apply and --dry-run are mutually exclusive");
  }
  const batchSize = Number(values.get("--batch-size") ?? "500");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("--batch-size must be an integer between 1 and 1000");
  }
  const quarantineValue = values.get("--allow-quarantine-count");
  const allowQuarantineCount =
    quarantineValue === undefined ? undefined : Number(quarantineValue);
  if (
    allowQuarantineCount !== undefined &&
    (!Number.isInteger(allowQuarantineCount) || allowQuarantineCount < 0)
  ) {
    throw new Error("--allow-quarantine-count must be a non-negative integer");
  }

  return {
    inputPath,
    preflightPath,
    projectId,
    apply: flags.has("--apply"),
    migrationBatchId: values.get("--batch-id"),
    statePath: values.get("--state"),
    resume: flags.has("--resume"),
    batchSize,
    confirmProject: values.get("--confirm-project"),
    production: flags.has("--production"),
    approvalPath: values.get("--approval"),
    bcryptProven: flags.has("--bcrypt-proven"),
    interactiveRemediation: flags.has("--interactive-remediation"),
    allowQuarantineCount,
  };
}

function firebasercPath(): string {
  const candidates = [
    path.resolve(process.cwd(), ".firebaserc"),
    path.resolve(process.cwd(), "../.firebaserc"),
    path.resolve(__dirname, "../../.firebaserc"),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) {
    throw new Error("could not find .firebaserc");
  }
  return existing;
}

function assertProjectAllowed(options: CliOptions): boolean {
  const parsed: unknown = JSON.parse(fs.readFileSync(firebasercPath(), "utf8"));
  const projects =
    parsed &&
    typeof parsed === "object" &&
    (parsed as { projects?: unknown }).projects &&
    typeof (parsed as { projects: unknown }).projects === "object"
      ? ((parsed as { projects: Record<string, unknown> }).projects)
      : {};
  const entries = Object.entries(projects).filter(
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
  return isProduction;
}

function addByEmail<T extends { email: string | null }>(
  map: Map<string, T[]>,
  value: T
): void {
  const email = value.email?.trim().toLowerCase();
  if (!email) {
    return;
  }
  map.set(email, [...(map.get(email) ?? []), value]);
}

async function snapshotAuthUsers(): Promise<{
  byUid: Map<string, ExistingAuthUser>;
  byEmail: Map<string, ExistingAuthUser[]>;
}> {
  const byUid = new Map<string, ExistingAuthUser>();
  const byEmail = new Map<string, ExistingAuthUser[]>();
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) {
      const identity = { uid: user.uid, email: user.email ?? null };
      byUid.set(identity.uid, identity);
      addByEmail(byEmail, identity);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return { byUid, byEmail };
}

async function snapshotIdentities(): Promise<IdentitySnapshot> {
  const [authUsers, usersResult, mappingsResult] = await Promise.all([
    snapshotAuthUsers(),
    listMigrationUsers({ limit: MAX_IDENTITY_SNAPSHOT + 1 }),
    listLegacyUserIdentitiesForMigration({
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      limit: MAX_IDENTITY_SNAPSHOT + 1,
    }),
  ]);
  const dataConnectUsers = usersResult.data.users;
  const mappings = mappingsResult.data.legacyUserIdentities;
  if (
    dataConnectUsers.length > MAX_IDENTITY_SNAPSHOT ||
    mappings.length > MAX_IDENTITY_SNAPSHOT
  ) {
    throw new Error("identity snapshot exceeds the safe CLI ceiling");
  }

  const dataConnectByUid = new Map<string, ExistingDataConnectUser>();
  const dataConnectByEmail = new Map<string, ExistingDataConnectUser[]>();
  for (const user of dataConnectUsers) {
    const identity = { id: user.id, email: user.email };
    dataConnectByUid.set(identity.id, identity);
    addByEmail(dataConnectByEmail, identity);
  }
  const mappingsByLegacyId = new Map<string, ExistingLegacyIdentity>();
  for (const mapping of mappings) {
    if (mappingsByLegacyId.has(mapping.legacyUserId)) {
      throw new Error("duplicate legacy identity mapping detected");
    }
    mappingsByLegacyId.set(mapping.legacyUserId, {
      userId: mapping.user.id,
      migrationBatchId: mapping.migrationBatchId,
      recordSchemaVersion: mapping.recordSchemaVersion,
      sourceChecksum: mapping.sourceChecksum,
    });
  }
  return {
    authByUid: authUsers.byUid,
    authByEmail: authUsers.byEmail,
    dataConnectByUid,
    dataConnectByEmail,
    mappingsByLegacyId,
  };
}

function reasonCounts(reasons: readonly MigrationReason[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reason of reasons) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

function planRecords(
  records: readonly NormalizedLegacyUser[],
  snapshot: IdentitySnapshot,
  sourceChecksum: string
): {
  plans: PlannedMigrationRecord[];
  quarantined: Array<{ legacyUserId: string; reason: MigrationReason }>;
} {
  const plans: PlannedMigrationRecord[] = [];
  const quarantined: Array<{
    legacyUserId: string;
    reason: MigrationReason;
  }> = [];
  for (const record of records) {
    const mapping = snapshot.mappingsByLegacyId.get(record.legacyUserId) ?? null;
    const identityUid = mapping?.userId ?? record.legacyUserId;
    const result = reconcileLegacyRecord(
      record,
      {
        authByLegacyUid: snapshot.authByUid.get(identityUid) ?? null,
        authByEmail: snapshot.authByEmail.get(record.email) ?? [],
        dataConnectByLegacyUid:
          snapshot.dataConnectByUid.get(identityUid) ?? null,
        dataConnectByEmail:
          snapshot.dataConnectByEmail.get(record.email) ?? [],
        legacyIdentity: mapping,
      },
      {
        recordSchemaVersion: LEGACY_RECORD_SCHEMA_VERSION,
        sourceChecksum,
      }
    );
    if (result.outcome === "quarantined") {
      quarantined.push({
        legacyUserId: record.legacyUserId,
        reason: result.reason,
      });
    } else {
      plans.push(result.plan);
    }
  }
  return { plans, quarantined };
}

function printPlan(
  options: CliOptions,
  recordCount: number,
  sourceChecksum: string,
  plans: readonly PlannedMigrationRecord[],
  inputQuarantines: readonly MigrationReason[],
  reconciliationQuarantines: readonly MigrationReason[],
  remediations: readonly ContactRemediation[]
): void {
  const warnings = plans.flatMap(({ record }) => record.warnings);
  const counts = {
    mode: options.apply ? "apply" : "dry-run",
    projectId: options.projectId,
    recordSchemaVersion: LEGACY_RECORD_SCHEMA_VERSION,
    sourceChecksum,
    recordCount,
    planned: plans.length,
    createAuth: plans.filter(({ createAuthUser }) => createAuthUser).length,
    createProfile: plans.filter(
      ({ profileAction }) => profileAction === "create-profile-and-identity"
    ).length,
    linkProfile: plans.filter(
      ({ profileAction }) => profileAction === "link-existing-profile"
    ).length,
    alreadyMapped: plans.filter(
      ({ profileAction }) => profileAction === "already-mapped"
    ).length,
    compatibleBcrypt: plans.filter(
      ({ record }) =>
        Boolean(record.email) &&
        record.passwordDisposition === "compatible-bcrypt"
    ).length,
    passwordResetRequired: plans.filter(
      ({ record }) =>
        Boolean(record.email) &&
        record.passwordDisposition !== "compatible-bcrypt"
    ).length,
    emailLessLost: plans.filter(
      ({ record }) => !record.email && record.membershipStatus === "LOST"
    ).length,
    interactiveRemediations: {
      emailReplaced: remediations.filter(
        ({ email }) => typeof email === "string"
      ).length,
      emailLessLost: remediations.filter(({ email }) => email === null).length,
      mobileReplaced: remediations.filter(
        ({ mobileNumber }) =>
          mobileNumber !== undefined && mobileNumber !== null
      ).length,
      mobileCleared: remediations.filter(
        ({ mobileNumber }) => mobileNumber === null
      ).length,
    },
    warningReasons: reasonCounts(warnings),
    quarantineReasons: reasonCounts([
      ...inputQuarantines,
      ...reconciliationQuarantines,
    ]),
  };
  console.log(JSON.stringify(counts, null, 2));
}

function assertApplyGuards(
  options: CliOptions,
  sourceChecksum: string,
  recordCount: number,
  quarantineCount: number,
  isProduction: boolean
): asserts options is CliOptions & {
  migrationBatchId: string;
  statePath: string;
} {
  if (!options.apply) {
    return;
  }
  if (
    !options.migrationBatchId ||
    !UUID_PATTERN.test(options.migrationBatchId)
  ) {
    throw new Error("--apply requires a valid --batch-id UUID");
  }
  if (!options.statePath) {
    throw new Error("--apply requires --state");
  }
  if (options.confirmProject !== options.projectId) {
    throw new Error("--confirm-project must exactly match the target project");
  }
  if (quarantineCount > 0 && options.allowQuarantineCount !== quarantineCount) {
    throw new Error(
      `apply quarantines ${quarantineCount} records; explicitly pass ` +
        `--allow-quarantine-count ${quarantineCount}`
    );
  }
  if (quarantineCount === 0 && options.allowQuarantineCount !== undefined) {
    throw new Error("--allow-quarantine-count is unnecessary for this plan");
  }
  if (isProduction) {
    if (!options.approvalPath) {
      throw new Error("production apply requires --approval");
    }
    const approval = JSON.parse(
      fs.readFileSync(options.approvalPath, "utf8")
    ) as ProductionApproval;
    if (
      approval.schemaVersion !==
        "sodc-legacy-user-migration-approval/v1" ||
      approval.issue !== 420 ||
      approval.approved !== true ||
      approval.projectId !== options.projectId ||
      approval.sourceChecksum !== sourceChecksum ||
      approval.recordSchemaVersion !== LEGACY_RECORD_SCHEMA_VERSION ||
      approval.expectedRecordCount !== recordCount
    ) {
      throw new Error("production approval is invalid or not input-bound");
    }
  }
}

function authImportRecord(
  plan: PlannedMigrationRecord,
  bcryptProven: boolean
): UserImportRecord {
  const record: UserImportRecord = {
    uid: plan.canonicalUid,
    displayName: `${plan.record.firstName} ${plan.record.lastName}`,
    disabled: true,
    customClaims: { enabled: false },
  };
  if (plan.record.email) {
    record.email = plan.record.email;
    record.emailVerified = false;
  }
  if (plan.record.email && bcryptProven && plan.record.passwordHash) {
    record.passwordHash = Buffer.from(plan.record.passwordHash, "utf8");
  }
  return record;
}

function checkpoint(
  statePath: string,
  ledger: MigrationLedger,
  plan: PlannedMigrationRecord,
  stage:
    | "auth-created"
    | "profile-created"
    | "identity-linked"
    | "access-reconciled"
): void {
  recordMigrationStage(
    ledger,
    plan.record.legacyUserId,
    plan.canonicalUid,
    stage
  );
  writeMigrationLedger(statePath, ledger);
}

async function importNewAuthUsers(
  plans: readonly PlannedMigrationRecord[],
  options: CliOptions & { statePath: string },
  ledger: MigrationLedger
): Promise<void> {
  const pending = plans.filter(
    (plan) =>
      plan.createAuthUser &&
      !hasMigrationStage(ledger, plan.record.legacyUserId, "auth-created")
  );
  for (const batch of batchesOf(pending, options.batchSize)) {
    const result = await admin.auth().importUsers(
      batch.map((plan) => authImportRecord(plan, options.bcryptProven)),
      { hash: { algorithm: "BCRYPT" } }
    );
    const failedIndexes = new Set(result.errors.map(({ index }) => index));
    batch.forEach((plan, index) => {
      if (!failedIndexes.has(index)) {
        checkpoint(options.statePath, ledger, plan, "auth-created");
      }
    });
    if (result.failureCount > 0) {
      throw new Error(
        `Firebase Auth import failed for ${result.failureCount} records`
      );
    }
  }
}

async function writeProfiles(
  plans: readonly PlannedMigrationRecord[],
  options: CliOptions & {
    migrationBatchId: string;
    statePath: string;
  },
  ledger: MigrationLedger,
  sourceChecksum: string
): Promise<void> {
  let failureCount = 0;
  for (const plan of plans) {
    if (plan.profileAction === "already-mapped") {
      continue;
    }
    const stage =
      plan.profileAction === "create-profile-and-identity"
        ? "profile-created"
        : "identity-linked";
    if (hasMigrationStage(ledger, plan.record.legacyUserId, stage)) {
      continue;
    }
    const now = new Date().toISOString();
    const provenance = {
      userId: plan.canonicalUid,
      legacyUserId: plan.record.legacyUserId,
      oldUid: plan.record.oldUid,
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      migrationBatchId: options.migrationBatchId,
      recordSchemaVersion: LEGACY_RECORD_SCHEMA_VERSION,
      sourceChecksum,
      now,
    };
    try {
      if (plan.profileAction === "create-profile-and-identity") {
        await createMigratedUserProfileAndIdentity({
          ...provenance,
          firstName: plan.record.firstName,
          lastName: plan.record.lastName,
          email: plan.record.email,
          serviceNumber: plan.record.serviceNumber,
          mobileNumber: plan.record.mobileNumber,
          postNominals: plan.record.postNominals,
          rank: plan.record.rank,
          membershipStatus:
            plan.record.membershipStatus as DataConnectMembershipStatus,
          shareContactInfo: plan.record.shareContactInfo,
          announcementOptOutAll: plan.record.announcementOptOutAll,
          legacyPasswordMigrated: plan.createAuthUser
            ? Boolean(
                options.bcryptProven &&
                  plan.record.email &&
                  plan.record.passwordDisposition === "compatible-bcrypt"
              )
            : null,
        });
      } else {
        await linkLegacyIdentityToExistingUser(provenance);
      }
      checkpoint(options.statePath, ledger, plan, stage);
    } catch {
      failureCount += 1;
    }
  }
  if (failureCount > 0) {
    throw new Error(
      `Data Connect profile stage failed for ${failureCount} records; ` +
        "partial accounts remain disabled"
    );
  }
}

async function reconcileAccess(
  plans: readonly PlannedMigrationRecord[],
  options: CliOptions & { statePath: string },
  ledger: MigrationLedger
): Promise<void> {
  for (const plan of plans) {
    if (
      hasMigrationStage(
        ledger,
        plan.record.legacyUserId,
        "access-reconciled"
      )
    ) {
      continue;
    }
    const authUser: UserRecord = await admin.auth().getUser(plan.canonicalUid);
    const enabled = isNonRestrictedStatus(plan.record.membershipStatus);
    await admin.auth().setCustomUserClaims(plan.canonicalUid, {
      ...(authUser.customClaims ?? {}),
      enabled,
    });
    const migrationCreatedAuth =
      plan.createAuthUser ||
      hasMigrationStage(ledger, plan.record.legacyUserId, "auth-created");
    if (migrationCreatedAuth && enabled) {
      await admin.auth().updateUser(plan.canonicalUid, { disabled: false });
    }
    checkpoint(options.statePath, ledger, plan, "access-reconciled");
  }
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const isProduction = assertProjectAllowed(options);
  const preflight = readLegacyPreflight(options.preflightPath);
  console.log("Decrypting and validating the canonical artifact in memory...");
  const decrypted = await decryptLegacyArtifact(options.inputPath);
  const remediated = options.interactiveRemediation
    ? await remediateLegacyContacts(decrypted.plaintextLines)
    : { lines: decrypted.plaintextLines, remediations: [] };
  const allowedEmailLessLegacyUserIds = emailLessLegacyUserIds(
    remediated.lines,
    remediated.remediations
  );
  const validation = validateJsonLines(remediated.lines, {
    allowEmailLessLegacyUserIds: allowedEmailLessLegacyUserIds,
  });
  const sourceChecksum = effectiveLegacySourceChecksum(
    decrypted.artifactChecksum,
    remediated.remediations
  );
  if (validation.recordCount !== preflight.overall.recordCount) {
    throw new Error("decrypted record count does not match preflight");
  }
  if (!SHA256_PATTERN.test(sourceChecksum)) {
    throw new Error("could not calculate source checksum");
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: options.projectId });
  }
  console.log("Taking read-only Auth and Data Connect identity snapshots...");
  const snapshot = await snapshotIdentities();
  const planned = planRecords(validation.records, snapshot, sourceChecksum);
  const inputReasons = validation.quarantined.map(({ reason }) => reason);
  printPlan(
    options,
    validation.recordCount,
    sourceChecksum,
    planned.plans,
    inputReasons,
    planned.quarantined.map(({ reason }) => reason),
    remediated.remediations
  );
  const quarantineCount =
    new Set(validation.quarantined.map(({ line }) => line)).size +
    planned.quarantined.length;
  assertApplyGuards(
    options,
    sourceChecksum,
    validation.recordCount,
    quarantineCount,
    isProduction
  );
  if (!options.apply) {
    console.log("Dry-run complete. No Firebase Auth or Data Connect writes made.");
    return;
  }

  const binding: MigrationLedgerBinding = {
    projectId: options.projectId,
    migrationBatchId: options.migrationBatchId,
    recordSchemaVersion: LEGACY_RECORD_SCHEMA_VERSION,
    sourceChecksum,
  };
  if (options.resume && !fs.existsSync(options.statePath)) {
    throw new Error("--resume requires an existing state file");
  }
  if (!options.resume && fs.existsSync(options.statePath)) {
    throw new Error("state file already exists; use --resume or a new path");
  }
  const ledger = options.resume
    ? readMigrationLedger(options.statePath, binding)
    : createMigrationLedger(binding);
  if (options.resume) {
    const plannedExclusions = new Map(
      planned.quarantined.map(({ legacyUserId, reason }) => [
        legacyUserId,
        reason,
      ])
    );
    const ledgerExclusions = Object.entries(ledger.excludedRecords);
    if (
      ledgerExclusions.length !== plannedExclusions.size ||
      ledgerExclusions.some(
        ([legacyUserId, { reason }]) =>
          plannedExclusions.get(legacyUserId) !== reason
      )
    ) {
      throw new Error("resume reconciliation exclusions do not match the ledger");
    }
  } else {
    for (const exclusion of planned.quarantined) {
      recordMigrationExclusion(
        ledger,
        exclusion.legacyUserId,
        exclusion.reason
      );
    }
    writeMigrationLedger(options.statePath, ledger);
  }

  await importNewAuthUsers(planned.plans, options, ledger);
  await writeProfiles(
    planned.plans,
    options,
    ledger,
    sourceChecksum
  );
  await reconcileAccess(planned.plans, options, ledger);
  console.log(
    JSON.stringify({
      outcome: "complete",
      projectId: options.projectId,
      migrationBatchId: options.migrationBatchId,
      processed: planned.plans.length,
      quarantined: quarantineCount,
    })
  );
}

main().catch((error: unknown) => {
  console.error(
    `Legacy user import stopped: ${
      error instanceof Error ? error.message : "unknown error"
    }`
  );
  process.exitCode = 1;
});
