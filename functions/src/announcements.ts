import { createHash, randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { getFunctions } from "firebase-admin/functions";
import * as logger from "firebase-functions/logger";
import { NotifyClient } from "notifications-node-client";
import {
  getSectionById,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  getAnnouncementAudienceSection,
  getAnnouncementAudiencePurposeLinksPaged,
  getAnnouncementExplicitMembersPaged,
  getAnnouncementStatusMembersPaged,
  getSectionAnnouncementOptOutsPaged,
  createAnnouncementSendWithDeliveryMode,
  createAnnouncementRecipientWithDeliveryMode,
  getAnnouncementRecipientProgressSummary,
  getAnnouncementRecipientsForResumePaged,
  getAnnouncementSendById,
  tryMarkAnnouncementRecipientEnqueueFailed,
  tryUpdateAnnouncementRecipientProcessingStatus,
  getAnnouncementSendHistory as dcGetAnnouncementSendHistory,
  getAnnouncementSendRecipientPage as dcGetAnnouncementSendRecipientPage,
  GovNotifyDeliveryMode as DataConnectGovNotifyDeliveryMode,
  type MembershipStatus,
} from "@dataconnect/admin-generated";
import { requireEnabled, requireString, validateUUID } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import {
  govNotifyApiKeyForMode,
  govNotifySecrets,
  parseGovNotifyDeliveryMode,
  type GovNotifyDeliveryMode,
} from "./govNotifyDeliveryMode";
import { resolveRuntimeGovNotifyDeliveryMode } from "./govNotifyDeliveryConfiguration";
import {
  listAnnouncementReplyToOptions,
  NotifyReplyToSelectionError,
  resolveNotifyReplyToForAnnouncement,
} from "./notifyReplyToConfiguration";
import { FUNCTIONS_REGION } from "./constants";
import { signUnsubscribeToken, unsubscribeSecret } from "./unsubscribe";
import {
  processAnnouncementEmailTask,
  type AnnouncementEmailTask,
  type AnnouncementRecipientStatus,
} from "./announcementDelivery";
import {
  getAnnouncementStatusFilters,
  mergeAnnouncementRecipients,
  partitionAnnouncementRecipients,
  type AnnouncementPurposeLink,
  type AnnouncementAudienceRecipient,
  announcementRecipientInitial,
  announcementRecipientSearchText,
  announcementRecipientSortKey,
  isNotifyTeamOnlyFailure,
  ANNOUNCEMENT_FAILURE_CATEGORY_NONE,
  ANNOUNCEMENT_FAILURE_CATEGORY_NOTIFY_TEAM_ONLY,
} from "./announcementRecipients";
import { caseInsensitiveContainsPattern } from "./dataConnectSearch";

const BULK_PREFIX = "BULK:";

const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try { new URL(url); } catch { throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`); }
  return url.replace(/\/$/, "");
})();


// ── Auth helper ──────────────────────────────────────────────────────────────

function linkHasPurpose(
  link: { purpose?: string; purposes?: readonly string[] | null },
  target: string
): boolean {
  if (link.purposes) return link.purposes.includes(target as never);
  return link.purpose === target;
}

async function requireSectionModerator(
  callerUid: string,
  sectionId: string,
  callerIsAdmin = false
): Promise<void> {
  if (callerIsAdmin) return;
  const [sectionResult, callerGroupsResult, userStatusResult] = await Promise.all([
    getSectionById({ id: sectionId }),
    getUserAccessGroupsById({ userId: callerUid }),
    getUserMembershipStatus({ id: callerUid }),
  ]);

  const section = sectionResult.data?.section;
  if (!section) throw new HttpsError("not-found", "Section not found");

  const moderatorGroupIds = new Set(
    (section.purposeLinks ?? [])
      .filter((pl) => linkHasPurpose(pl, "MODERATOR"))
      .map((pl) => pl.userGroup.id)
  );

  const callerGroupIds = new Set(
    (callerGroupsResult.data?.user?.userGroups ?? []).map(
      (ug: { userGroup: { id: string } }) => ug.userGroup.id
    )
  );

  if ([...moderatorGroupIds].some((id) => callerGroupIds.has(id))) return;

  // Check status-derived moderator access
  const userStatus = userStatusResult.data?.user?.membershipStatus;
  if (userStatus) {
    const statusDerived = (section.purposeLinks ?? []).some(
      (pl) =>
        linkHasPurpose(pl, "MODERATOR") &&
        (pl.userGroup.membershipStatuses?.includes(userStatus) ?? false)
    );
    if (statusDerived) return;
  }

  throw new HttpsError("permission-denied", "Must be a section moderator to perform this action");
}

// ── Recipient resolution ─────────────────────────────────────────────────────

interface ResolveResult {
  recipients: AnnouncementAudienceRecipient[];
  sectionName: string;
}

export async function resolveAnnouncementRecipients(sectionId: string): Promise<ResolveResult> {
  const [sectionResult, rawPurposeLinks] = await Promise.all([
    getAnnouncementAudienceSection({ sectionId }),
    collectDataConnectPages(async (limit, offset) => {
      const result = await getAnnouncementAudiencePurposeLinksPaged({ sectionId, limit, offset });
      return result.data?.sectionUserGroupPurposeLinks ?? [];
    }),
  ]);
  const sectionData = sectionResult.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");

  const purposeLinks = rawPurposeLinks as AnnouncementPurposeLink[];
  const statusFilters = getAnnouncementStatusFilters(purposeLinks);
  const audienceGroupIds = purposeLinks
    .filter((link) => linkHasPurpose(link, "ACCESS") || linkHasPurpose(link, "MODERATOR"))
    .map((link) => link.userGroup.id);
  const [explicitMemberships, statusCandidates] = await Promise.all([
    audienceGroupIds.length > 0
      ? collectDataConnectPages(async (limit, offset) => {
        const result = await getAnnouncementExplicitMembersPaged({
          userGroupIds: audienceGroupIds,
          limit,
          offset,
        });
        return result.data?.userUserGroups ?? [];
      })
      : [],
    statusFilters.size > 0
      ? collectDataConnectPages(async (limit, offset) => {
        const result = await getAnnouncementStatusMembersPaged({
          membershipStatuses: [...statusFilters] as MembershipStatus[],
          limit,
          offset,
        });
        return result.data?.users ?? [];
      })
      : [],
  ]);
  const explicitByGroup = new Map<string, Array<{ user: AnnouncementAudienceRecipient }>>();
  for (const membership of explicitMemberships) {
    const groupUsers = explicitByGroup.get(membership.userGroupId) ?? [];
    groupUsers.push({ user: membership.user as AnnouncementAudienceRecipient });
    explicitByGroup.set(membership.userGroupId, groupUsers);
  }
  const hydratedPurposeLinks = purposeLinks.map((link) => ({
    ...link,
    userGroup: {
      ...link.userGroup,
      users: explicitByGroup.get(link.userGroup.id) ?? [],
    },
  }));
  const recipients = mergeAnnouncementRecipients(
    hydratedPurposeLinks,
    statusCandidates as AnnouncementAudienceRecipient[],
  );

  return { recipients, sectionName: sectionData.name ?? sectionId };
}

// ── Personalisation helpers ───────────────────────────────────────────────────

/**
 * Extracts GOV Notify ((placeholder)) tokens from template content. A manual scan rather than a
 * regex — `/\(\(([^)]+)\)\)/g` is vulnerable to polynomial-time backtracking on adversarial input
 * (e.g. a long run of unmatched "(" characters), and template body/subject comes from GOV Notify,
 * not something we control the format of.
 */
export function extractTemplateVariables(body: string, subject: string): string[] {
  const text = `${body} ${subject}`;
  const found = new Set<string>();
  let index = 0;
  while (index < text.length) {
    let start = text.indexOf("((", index);
    if (start === -1) break;
    // A run of more than two consecutive "(" — e.g. a placeholder URL wrapped in markdown
    // link syntax, "[Unsubscribe](((unsubscribeUrl)))" — means the genuine "((" delimiter is
    // the last pair in the run, not the first. Slide forward through the run so a leading,
    // unrelated "(" (from the markdown link itself) doesn't get swept into the extracted name.
    while (text[start + 2] === "(") {
      start += 1;
    }
    const end = text.indexOf("))", start + 2);
    if (end === -1) break;
    const name = text.slice(start + 2, end).trim();
    if (name) found.add(name);
    index = end + 2;
  }
  return [...found];
}

/**
 * Filters a recipient's full candidate personalisation down to only the keys the selected
 * template actually references. GOV Notify ignores extra personalisation keys at render time,
 * but that doesn't stop the data being sent — every field here is member PII, so we only
 * transmit what the template will actually display. See #362.
 */
export function buildRecipientPersonalisation(
  recipient: {
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    membershipStatus: string;
  },
  sectionName: string,
  unsubscribeUrl: string,
  requiredPersonalisation: string[]
): Record<string, string> {
  const candidate: Record<string, string> = {
    firstName: recipient.firstName,
    lastName: recipient.lastName,
    email: recipient.email,
    serviceNumber: recipient.serviceNumber,
    membershipStatus: recipient.membershipStatus,
    section: sectionName,
    unsubscribeUrl,
  };
  const required = new Set(requiredPersonalisation);
  return Object.fromEntries(Object.entries(candidate).filter(([key]) => required.has(key)));
}

const PREVIEW_PLACEHOLDERS: Record<string, string> = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane.smith@example.com",
  serviceNumber: "S123456",
  membershipStatus: "Regular",
  section: "Example Section",
  unsubscribeUrl: "https://example.com/unsubscribe",
};

// ── Cloud Functions ──────────────────────────────────────────────────────────

export interface AnnouncementTemplate {
  id: string;
  name: string;
  updatedAt: string;
  requiredPersonalisation: string[];
}

export const getAnnouncementDeliveryConfiguration = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<{
    siteDeliveryMode: GovNotifyDeliveryMode;
    replyToOptions: Array<{ id: string; displayLabel: string; emailAddress: string }>;
    defaultReplyToAddressId: string | null;
    replyToFallbackSource: string;
  }> => {
    requireEnabled(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);
    const [delivery, replyTo] = await Promise.all([
      resolveRuntimeGovNotifyDeliveryMode("LIVE"),
      listAnnouncementReplyToOptions(),
    ]);
    return {
      siteDeliveryMode: delivery.siteMode,
      replyToOptions: replyTo.options,
      defaultReplyToAddressId: replyTo.defaultAddressId,
      replyToFallbackSource: replyTo.fallbackSource,
    };
  },
);

export const getAnnouncementTemplates = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ templates: AnnouncementTemplate[] }> => {
    requireEnabled(request);
    await enforceRateLimit("getAnnouncementTemplates", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const mode = (await resolveRuntimeGovNotifyDeliveryMode("LIVE")).effectiveMode;
    const client = new NotifyClient(govNotifyApiKeyForMode(mode));
    const response = await client.getAllTemplates("email");
    const all = (response.data as {
      templates: {
        id: string;
        name: string;
        updated_at: string | null;
        created_at: string;
        body: string;
        subject: string;
      }[];
    }).templates ?? [];

    const templates: AnnouncementTemplate[] = all
      .filter((t) => t.name.startsWith(BULK_PREFIX))
      .sort((a, b) => {
        const dateA = new Date(a.updated_at ?? a.created_at).getTime();
        const dateB = new Date(b.updated_at ?? b.created_at).getTime();
        return dateB - dateA;
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        updatedAt: t.updated_at ?? t.created_at,
        requiredPersonalisation: extractTemplateVariables(t.body ?? "", t.subject ?? ""),
      }));

    return { templates };
  }
);

export const previewAnnouncementTemplate = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ html: string; subject: string }> => {
    requireEnabled(request);
    await enforceRateLimit("previewAnnouncementTemplate", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const mode = (await resolveRuntimeGovNotifyDeliveryMode("LIVE")).effectiveMode;
    const client = new NotifyClient(govNotifyApiKeyForMode(mode));
    // GOV Notify ignores extra personalisation keys — pass all placeholders so any template variable is satisfied
    const response = await client.previewTemplateById(templateUuid, PREVIEW_PLACEHOLDERS);
    const data = response.data as { html: string; subject: string };
    return { html: data.html ?? "", subject: data.subject ?? "" };
  }
);

export interface SendAnnouncementResult {
  sendId: string;
  recipientCount: number;
  skippedCount: number;
  preparationQueued: true;
  resumed: boolean;
  requestedDeliveryMode: GovNotifyDeliveryMode;
  siteDeliveryMode: GovNotifyDeliveryMode;
  effectiveDeliveryMode: GovNotifyDeliveryMode;
}

export interface AnnouncementSend {
  id: string;
  templateUuid: string;
  templateName: string | null;
  sectionId: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
  skippedCount: number;
  processedCount: number | null;
  failureCount: number | null;
  enqueueFailureCount: number | null;
  recordedRecipientCount: number | null;
  progressAvailable: boolean;
  preparationIncomplete: boolean;
  requestedDeliveryMode: GovNotifyDeliveryMode;
  siteDeliveryMode: GovNotifyDeliveryMode;
  effectiveDeliveryMode: GovNotifyDeliveryMode;
  replyToAddressId: string | null;
  replyToDisplayLabel: string | null;
  replyToEmailAddress: string | null;
}

export interface AnnouncementRecipient {
  id: string;
  sendId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: AnnouncementRecipientStatus;
  skippedReason?: string;
  sentAt?: string;
  failureReason?: string;
  failureCategory?: "notify_team_only";
  effectiveDeliveryMode: GovNotifyDeliveryMode;
}

export type AnnouncementRecipientStatusFilter =
  | "ALL"
  | "IN_PROGRESS"
  | "PASSED"
  | "NOT_ON_TEAM"
  | "FAILED"
  | "SKIPPED";

export type AnnouncementRecipientSurnameInitial =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"
  | "OTHER";
export type AnnouncementRecipientInitial = "ALL" | AnnouncementRecipientSurnameInitial;

export interface AnnouncementRecipientPage {
  recipients: AnnouncementRecipient[];
  totalCount: number;
  filteredCount: number;
  initialCounts: Record<string, number>;
  page: number;
  pageSize: number;
  pageCount: number;
}

interface SkippedAnnouncementRecipient {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AnnouncementRecipientSnapshot {
  version: 1;
  effectiveDeliveryMode?: GovNotifyDeliveryMode;
  tasks: AnnouncementEmailTask[];
  skippedRecipients: SkippedAnnouncementRecipient[];
}

const WRITE_CHUNK_SIZE = 10;
const ENQUEUE_CHUNK_SIZE = 20;
const RECIPIENT_HISTORY_PAGE_SIZE = 50;
const RECIPIENT_INITIAL_PAGE_SIZE = 250;
const DATA_CONNECT_PAGE_SIZE = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate|already exists|violates/i.test(message);
}

function isTaskAlreadyExists(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code === "functions/task-already-exists" || code === 6 || code === "6") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /task-already-exists|already exists/i.test(message);
}

async function collectDataConnectPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<readonly T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += DATA_CONNECT_PAGE_SIZE) {
    const page = await fetchPage(DATA_CONNECT_PAGE_SIZE, offset);
    rows.push(...page);
    if (page.length < DATA_CONNECT_PAGE_SIZE) return rows;
  }
}

export function announcementTaskId(
  sendId: string,
  recipientId: string,
  effectiveDeliveryMode: GovNotifyDeliveryMode = "LIVE",
): string {
  return createHash("sha256")
    .update(`${sendId}:${recipientId}:${effectiveDeliveryMode}`)
    .digest("hex");
}

function parseRecipientSnapshot(value: string | null | undefined): AnnouncementRecipientSnapshot {
  if (!value) throw new HttpsError("failed-precondition", "Announcement send cannot be resumed");
  try {
    const parsed = JSON.parse(value) as Partial<AnnouncementRecipientSnapshot>;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.skippedRecipients)) {
      throw new Error("Unsupported announcement recipient snapshot");
    }
    return parsed as AnnouncementRecipientSnapshot;
  } catch (error) {
    logger.error("Invalid announcement recipient snapshot", { error });
    throw new HttpsError("internal", "Announcement send snapshot is invalid");
  }
}

async function ensureRecipientRows(
  sendId: string,
  snapshot: AnnouncementRecipientSnapshot,
): Promise<Map<string, { id: string; status: string }>> {
  const current = await collectDataConnectPages(async (limit, offset) => {
    const result = await getAnnouncementRecipientsForResumePaged({ sendId, limit, offset });
    return result.data?.announcementRecipients ?? [];
  });
  const existing = new Map(
    current.map((row) => [row.userId, { id: row.id, status: row.status }]),
  );
  const missing = [
    ...snapshot.tasks
      .filter((task) => !existing.has(task.recipientId))
      .map((task) => ({
        id: randomUUID(),
        userId: task.recipientId,
        email: task.email,
        firstName: task.firstName,
        lastName: task.lastName,
        status: "queued",
        skippedReason: null,
        effectiveDeliveryMode: task.effectiveDeliveryMode ?? snapshot.effectiveDeliveryMode ?? "LIVE",
      })),
    ...snapshot.skippedRecipients
      .filter((recipient) => !existing.has(recipient.userId))
      .map((recipient) => ({
        id: randomUUID(),
        ...recipient,
        status: "skipped",
        skippedReason: "opted_out",
        effectiveDeliveryMode: snapshot.effectiveDeliveryMode ?? "LIVE",
      })),
  ];
  let sawConcurrentInsert = false;

  for (let i = 0; i < missing.length; i += WRITE_CHUNK_SIZE) {
    const chunk = missing.slice(i, i + WRITE_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((recipient) =>
        createAnnouncementRecipientWithDeliveryMode({
          id: recipient.id,
          announcementSendId: sendId,
          userId: recipient.userId,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          surnameInitial: announcementRecipientInitial(recipient.lastName),
          surnameSortKey: announcementRecipientSortKey(recipient.lastName),
          firstNameSortKey: announcementRecipientSortKey(recipient.firstName),
          searchText: announcementRecipientSearchText(recipient),
          status: recipient.status,
          skippedReason: recipient.skippedReason,
          sentAt: null,
          failureReason: null,
          effectiveDeliveryMode:
            recipient.effectiveDeliveryMode as DataConnectGovNotifyDeliveryMode,
        }),
      ),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected" && !isDuplicateKeyError(result.reason),
    );
    if (failure) throw failure.reason;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const recipient = chunk[index]!;
        existing.set(recipient.userId, { id: recipient.id, status: recipient.status });
      }
    });
    sawConcurrentInsert ||= results.some((result) => result.status === "rejected");
  }
  if (sawConcurrentInsert) {
    // A concurrent preparation inserted one or more rows first. Refresh once
    // only for that uncommon race so we use the winning row ids. All remaining
    // chunks were still attempted before this refresh.
    const refreshed = await collectDataConnectPages(async (limit, offset) => {
      const result = await getAnnouncementRecipientsForResumePaged({ sendId, limit, offset });
      return result.data?.announcementRecipients ?? [];
    });
    return new Map(
      refreshed.map((row) => [row.userId, { id: row.id, status: row.status }]),
    );
  }
  return existing;
}

async function enqueueSnapshot(
  sendId: string,
  snapshot: AnnouncementRecipientSnapshot,
): Promise<{ queuedCount: number; failedToEnqueueCount: number }> {
  const queue = getFunctions().taskQueue(
    `locations/${FUNCTIONS_REGION}/functions/processAnnouncementEmail`,
  );
  const rows = await ensureRecipientRows(sendId, snapshot);
  const candidates = snapshot.tasks.filter((task) => {
    const status = rows.get(task.recipientId)?.status;
    return status === "queued" || status === "enqueue_failed";
  });

  const failedRecipientIds = new Set<string>();
  for (let i = 0; i < candidates.length; i += ENQUEUE_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + ENQUEUE_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((task) => queue.enqueue(task, {
        id: announcementTaskId(sendId, task.recipientId, task.effectiveDeliveryMode),
        dispatchDeadlineSeconds: 60,
      })),
    );
    await Promise.all(
      results.map(async (result, index) => {
        const task = chunk[index]!;
        const row = rows.get(task.recipientId);
        if (result.status === "fulfilled" || isTaskAlreadyExists(result.reason)) {
          if (row?.status === "enqueue_failed") {
            await tryUpdateAnnouncementRecipientProcessingStatus({
              id: row.id,
              expectedStatus: "enqueue_failed",
              expectedProcessingVersion: 0,
              status: "queued",
              processingVersion: 0,
              processingStartedAt: null,
              sentAt: null,
              failureReason: null,
              failureCategory: ANNOUNCEMENT_FAILURE_CATEGORY_NONE,
              providerNotificationId: null,
            });
          }
          return;
        }
        if (!row) throw new Error(`Announcement recipient row missing for ${task.recipientId}`);
        const message = result.reason instanceof Error ? result.reason.message : "Cloud Task enqueue failed";
        if (row.status === "queued") {
          await tryMarkAnnouncementRecipientEnqueueFailed({
            id: row.id,
            failureReason: message.slice(0, 500),
          });
        }
        failedRecipientIds.add(task.recipientId);
      }),
    );
  }
  const failedToEnqueueCount = failedRecipientIds.size;
  return {
    queuedCount: snapshot.tasks.length - failedToEnqueueCount,
    failedToEnqueueCount,
  };
}

interface PrepareAnnouncementSendTask {
  sendId: string;
}

async function enqueueAnnouncementPreparation(sendId: string, attemptId: string): Promise<void> {
  const queue = getFunctions().taskQueue(
    `locations/${FUNCTIONS_REGION}/functions/prepareAnnouncementSend`,
  );
  try {
    await queue.enqueue({ sendId }, {
      id: announcementTaskId(sendId, `prepare:${attemptId}`),
      dispatchDeadlineSeconds: 300,
    });
  } catch (error) {
    // Callable retries with the same attempt id are idempotent. A moderator
    // recovery uses a new attempt id, so Cloud Tasks name retention never
    // prevents a legitimate later retry.
    if (!isTaskAlreadyExists(error)) throw error;
  }
}

export async function prepareAnnouncementSendTask(
  task: PrepareAnnouncementSendTask,
): Promise<{ queuedCount: number; failedToEnqueueCount: number }> {
  const sendResult = await getAnnouncementSendById({ id: task.sendId });
  const send = sendResult.data?.announcementSend;
  if (!send) throw new Error(`Announcement send ${task.sendId} was not found`);
  const snapshot = parseRecipientSnapshot(send.recipientSnapshot);
  const result = await enqueueSnapshot(task.sendId, snapshot);
  logger.info("Announcement recipient preparation completed", {
    announcementSendId: task.sendId,
    queuedCount: result.queuedCount,
    failedToEnqueueCount: result.failedToEnqueueCount,
    skippedCount: snapshot.skippedRecipients.length,
  });
  if (result.failedToEnqueueCount > 0) {
    throw new Error(
      `Announcement preparation left ${result.failedToEnqueueCount} recipient task(s) unqueued`,
    );
  }
  return result;
}

export const sendSectionAnnouncement = onCall(
  {
    region: FUNCTIONS_REGION,
    secrets: [unsubscribeSecret, ...govNotifySecrets],
    timeoutSeconds: 120,
  },
  async (request): Promise<SendAnnouncementResult> => {
    requireEnabled(request);
    await enforceRateLimit("sendSectionAnnouncement", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;
    await requireSectionModerator(callerUid, sectionId, request.auth!.token?.admin === true);

    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    const requestId = requireString(request.data?.requestId, "requestId");
    if (!UUID_PATTERN.test(requestId)) {
      throw new HttpsError("invalid-argument", "requestId must be a UUID");
    }
    const templateName: string | null = typeof request.data?.templateName === "string"
      ? request.data.templateName
      : null;
    let requestedDeliveryMode: GovNotifyDeliveryMode;
    try {
      requestedDeliveryMode = parseGovNotifyDeliveryMode(
        request.data?.deliveryMode,
        "deliveryMode",
      );
    } catch (error) {
      throw new HttpsError(
        "invalid-argument",
        error instanceof Error ? error.message : "deliveryMode is invalid",
      );
    }
    const deliveryMode = await resolveRuntimeGovNotifyDeliveryMode(requestedDeliveryMode);
    const selectedReplyToAddressId = typeof request.data?.replyToAddressId === "string" &&
      request.data.replyToAddressId.trim().length > 0
      ? validateUUID(request.data.replyToAddressId, "replyToAddressId")
      : undefined;

    let resumed = false;
    let existingResult = await getAnnouncementSendById({ id: requestId });
    let existing = existingResult.data?.announcementSend;
    let snapshot: AnnouncementRecipientSnapshot;

    if (existing) {
      if (
        existing.sectionId !== sectionId ||
        existing.templateUuid !== templateUuid ||
        existing.sentBy !== callerUid ||
        existing.requestedDeliveryMode !== deliveryMode.requestedMode ||
        existing.siteDeliveryMode !== deliveryMode.siteMode ||
        existing.effectiveDeliveryMode !== deliveryMode.effectiveMode
        || (selectedReplyToAddressId !== undefined && existing.replyToAddressId !== selectedReplyToAddressId)
      ) {
        throw new HttpsError("already-exists", "requestId is already in use");
      }
      resumed = true;
      snapshot = parseRecipientSnapshot(existing.recipientSnapshot);
    } else {
      let replyTo;
      try {
        replyTo = await resolveNotifyReplyToForAnnouncement(selectedReplyToAddressId);
      } catch (error) {
        if (error instanceof NotifyReplyToSelectionError) {
          throw new HttpsError("failed-precondition", error.message);
        }
        throw error;
      }
      const client = new NotifyClient(govNotifyApiKeyForMode(deliveryMode.effectiveMode));
      const templateResponse = await client.getTemplateById(templateUuid);
      const template = templateResponse.data as { body?: string; subject?: string };
      const requiredPersonalisation = extractTemplateVariables(template.body ?? "", template.subject ?? "");

      const [{ recipients, sectionName }, sectionOptOuts] = await Promise.all([
        resolveAnnouncementRecipients(sectionId),
        collectDataConnectPages(async (limit, offset) => {
          const result = await getSectionAnnouncementOptOutsPaged({ sectionId, limit, offset });
          return result.data?.sectionAnnouncementOptOuts ?? [];
        }),
      ]);
      const sectionOptOutIds = new Set(
        sectionOptOuts.map(
          (row: { user: { id: string } }) => row.user.id,
        ),
      );
      const { deliverable, optedOut } = partitionAnnouncementRecipients(recipients, sectionOptOutIds);
      const secret = unsubscribeSecret.value();
      const tasks = deliverable.map((recipient): AnnouncementEmailTask => {
        const unsubscribeUrl = `${APP_BASE_URL}/unsubscribe?token=${signUnsubscribeToken(
          {
            userId: recipient.id,
            sectionId,
            sectionName,
            exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
          },
          secret,
        )}`;
        return {
          sendId: requestId,
          recipientId: recipient.id,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          personalisation: buildRecipientPersonalisation(
            recipient,
            sectionName,
            unsubscribeUrl,
            requiredPersonalisation,
          ),
          unsubscribeUrl,
          templateUuid,
          effectiveDeliveryMode: deliveryMode.effectiveMode,
          emailReplyToId: replyTo.notifyUuid ?? null,
        };
      });
      snapshot = {
        version: 1,
        effectiveDeliveryMode: deliveryMode.effectiveMode,
        tasks,
        skippedRecipients: optedOut.map((recipient) => ({
          userId: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
        })),
      };

      try {
        await createAnnouncementSendWithDeliveryMode({
          id: requestId,
          sectionId,
          templateUuid,
          templateName,
          sentBy: callerUid,
          recipientCount: snapshot.tasks.length,
          skippedCount: snapshot.skippedRecipients.length,
          recipientSnapshot: JSON.stringify(snapshot),
          requestedDeliveryMode:
            deliveryMode.requestedMode as DataConnectGovNotifyDeliveryMode,
          siteDeliveryMode: deliveryMode.siteMode as DataConnectGovNotifyDeliveryMode,
          effectiveDeliveryMode:
            deliveryMode.effectiveMode as DataConnectGovNotifyDeliveryMode,
          replyToAddressId: replyTo.addressId ?? null,
          replyToDisplayLabel: replyTo.displayLabel ?? null,
          replyToEmailAddress: replyTo.emailAddress ?? null,
          replyToNotifyUuid: replyTo.notifyUuid ?? null,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        existingResult = await getAnnouncementSendById({ id: requestId });
        existing = existingResult.data?.announcementSend;
        if (
          !existing ||
          existing.sectionId !== sectionId ||
          existing.templateUuid !== templateUuid ||
          existing.sentBy !== callerUid ||
          existing.requestedDeliveryMode !== deliveryMode.requestedMode ||
          existing.siteDeliveryMode !== deliveryMode.siteMode ||
          existing.effectiveDeliveryMode !== deliveryMode.effectiveMode ||
          (selectedReplyToAddressId !== undefined && existing.replyToAddressId !== selectedReplyToAddressId)
        ) {
          throw new HttpsError("already-exists", "requestId is already in use");
        }
        resumed = true;
        snapshot = parseRecipientSnapshot(existing.recipientSnapshot);
      }
    }

    await enqueueAnnouncementPreparation(requestId, "initial");

    logger.info("Announcement accepted for background preparation", {
      announcementSendId: requestId,
      sectionId,
      templateUuid,
      recipientCount: snapshot.tasks.length,
      skippedCount: snapshot.skippedRecipients.length,
      resumed,
      requestedDeliveryMode: deliveryMode.requestedMode,
      siteDeliveryMode: deliveryMode.siteMode,
      effectiveDeliveryMode: deliveryMode.effectiveMode,
    });
    return {
      sendId: requestId,
      recipientCount: snapshot.tasks.length,
      skippedCount: snapshot.skippedRecipients.length,
      preparationQueued: true,
      resumed,
      requestedDeliveryMode: deliveryMode.requestedMode,
      siteDeliveryMode: deliveryMode.siteMode,
      effectiveDeliveryMode: deliveryMode.effectiveMode,
    };
  }
);

export const retryAnnouncementPreparation = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<{ preparationQueued: true }> => {
    requireEnabled(request);
    await enforceRateLimit("retryAnnouncementPreparation", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const sendId = requireString(request.data?.sendId, "sendId");
    const attemptId = requireString(request.data?.attemptId, "attemptId");
    if (!UUID_PATTERN.test(attemptId)) {
      throw new HttpsError("invalid-argument", "attemptId must be a UUID");
    }
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);
    const sendResult = await getAnnouncementSendById({ id: sendId });
    if (!sendResult.data?.announcementSend || sendResult.data.announcementSend.sectionId !== sectionId) {
      throw new HttpsError("not-found", "Announcement send not found");
    }
    await enqueueAnnouncementPreparation(sendId, attemptId);
    logger.info("Announcement preparation retry queued", { sendId, sectionId, attemptId });
    return { preparationQueued: true };
  },
);

export const prepareAnnouncementSend = onTaskDispatched<PrepareAnnouncementSendTask>(
  {
    region: FUNCTIONS_REGION,
    timeoutSeconds: 300,
    rateLimits: { maxConcurrentDispatches: 2 },
    retryConfig: { maxAttempts: 4, minBackoffSeconds: 30, maxBackoffSeconds: 120 },
  },
  async (req) => {
    await prepareAnnouncementSendTask(req.data);
  },
);

export const processAnnouncementEmail = onTaskDispatched<AnnouncementEmailTask>(
  {
    region: FUNCTIONS_REGION,
    secrets: [...govNotifySecrets],
    rateLimits: { maxDispatchesPerSecond: 20 },
    retryConfig: { maxAttempts: 4, minBackoffSeconds: 30, maxBackoffSeconds: 120 },
  },
  async (req) => processAnnouncementEmailTask(req.data, { retryCount: req.retryCount })
);

export const getAnnouncementSendHistory = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<{ sends: AnnouncementSend[] }> => {
    requireEnabled(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    let result: Awaited<ReturnType<typeof dcGetAnnouncementSendHistory>>;
    try {
      result = await dcGetAnnouncementSendHistory({ sectionId });
    } catch (err) {
      logger.error("dcGetAnnouncementSendHistory failed", { sectionId, err });
      throw new HttpsError("internal", "Failed to load send history");
    }
    const rawSends = result.data?.announcementSends ?? [];

    const progress = await Promise.all(
      rawSends.map(async (s) => {
        try {
          const result = await getAnnouncementRecipientProgressSummary({ sendId: s.id });
          const statusCounts = new Map(
            (result.data?.announcementRecipients ?? []).map((row) => [row.status, row._count]),
          );
          const count = (...statuses: string[]) => statuses.reduce(
            (total, status) => total + (statusCounts.get(status) ?? 0),
            0,
          );
          const recordedRecipientCount = count(...statusCounts.keys());
          const enqueueFailureCount = count("enqueue_failed");
          return {
            processedCount: count("sent", "delivered", "bounced", "failed"),
            failureCount: count("failed", "bounced", "enqueue_failed", "delivery_unknown"),
            enqueueFailureCount,
            recordedRecipientCount,
            progressAvailable: true,
            preparationIncomplete:
              recordedRecipientCount < s.recipientCount + s.skippedCount || enqueueFailureCount > 0,
          };
        } catch (error) {
          logger.error("Failed to load announcement send progress", {
            announcementSendId: s.id,
            error,
          });
          return {
            processedCount: null,
            failureCount: null,
            enqueueFailureCount: null,
            recordedRecipientCount: null,
            progressAvailable: false,
            preparationIncomplete: false,
          };
        }
      })
    );

    const sends: AnnouncementSend[] = rawSends.map((s, i) => ({
      id: s.id,
      templateUuid: s.templateUuid,
      templateName: s.templateName ?? null,
      sectionId,
      sentBy: s.sentBy,
      sentAt: s.sentAt,
      recipientCount: s.recipientCount,
      skippedCount: s.skippedCount,
      processedCount: progress[i]!.processedCount,
      failureCount: progress[i]!.failureCount,
      enqueueFailureCount: progress[i]!.enqueueFailureCount,
      recordedRecipientCount: progress[i]!.recordedRecipientCount,
      progressAvailable: progress[i]!.progressAvailable,
      preparationIncomplete: progress[i]!.preparationIncomplete,
      requestedDeliveryMode: s.requestedDeliveryMode as GovNotifyDeliveryMode,
      siteDeliveryMode: s.siteDeliveryMode as GovNotifyDeliveryMode,
      effectiveDeliveryMode: s.effectiveDeliveryMode as GovNotifyDeliveryMode,
      replyToAddressId: s.replyToAddressId ?? null,
      replyToDisplayLabel: s.replyToDisplayLabel ?? null,
      replyToEmailAddress: s.replyToEmailAddress ?? null,
    }));

    return { sends };
  }
);

export const getAnnouncementSendRecipients = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<AnnouncementRecipientPage> => {
    requireEnabled(request);
    await enforceRateLimit("getAnnouncementSendRecipients", request.auth!.uid);
    const sendId = requireString(request.data?.sendId, "sendId");
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    // sendId and sectionId are independent client-supplied values — confirm the send
    // actually belongs to the section the caller was just authorized against, so a
    // moderator of one section can't read another section's recipients by passing a
    // sendId that isn't theirs.
    const sendResult = await getAnnouncementSendById({ id: sendId });
    const send = sendResult.data?.announcementSend;
    if (!send || send.sectionId !== sectionId) {
      throw new HttpsError("not-found", "Announcement send not found");
    }

    const search = typeof request.data?.search === "string"
      ? request.data.search.trim().toLocaleLowerCase("en-GB").slice(0, 200)
      : "";
    const requestedFilter = typeof request.data?.statusFilter === "string"
      ? request.data.statusFilter
      : "ALL";
    const allowedFilters: AnnouncementRecipientStatusFilter[] = [
      "ALL", "IN_PROGRESS", "PASSED", "NOT_ON_TEAM", "FAILED", "SKIPPED",
    ];
    if (!allowedFilters.includes(requestedFilter as AnnouncementRecipientStatusFilter)) {
      throw new HttpsError("invalid-argument", "statusFilter is invalid");
    }
    const statusFilter = requestedFilter as AnnouncementRecipientStatusFilter;
    const requestedInitial = typeof request.data?.initial === "string"
      ? request.data.initial.toUpperCase()
      : "ALL";
    if (requestedInitial !== "ALL" && requestedInitial !== "OTHER" && !/^[A-Z]$/.test(requestedInitial)) {
      throw new HttpsError("invalid-argument", "initial is invalid");
    }
    const requestedPage = Number.isInteger(request.data?.page) && request.data.page > 0
      ? request.data.page
      : 1;

    const filterConfig = recipientFilterQueryConfig(statusFilter);
    const searchPattern = search.length > 0 ? caseInsensitiveContainsPattern(search) : ".*";
    const selectedInitials = requestedInitial === "ALL"
      ? [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "OTHER"]
      : [requestedInitial];
    const queryPage = async (limit: number, offset: number) => dcGetAnnouncementSendRecipientPage({
      sendId,
      statuses: filterConfig.statuses,
      failureCategories: filterConfig.failureCategories,
      searchPattern,
      initials: selectedInitials,
      limit,
      offset,
    });

    let result: Awaited<ReturnType<typeof dcGetAnnouncementSendRecipientPage>>;
    try {
      const requestedPageSize = requestedInitial === "ALL"
        ? RECIPIENT_HISTORY_PAGE_SIZE
        : RECIPIENT_INITIAL_PAGE_SIZE;
      const requestedOffset = (requestedPage - 1) * requestedPageSize;
      result = await queryPage(
        requestedPageSize,
        requestedOffset,
      );
    } catch (err) {
      logger.error("dcGetAnnouncementSendRecipients failed", { sendId, err });
      throw new HttpsError("internal", "Failed to load recipients");
    }
    const totalCount = result.data?.total?.[0]?._count ?? 0;
    const initialCounts = Object.fromEntries([
      ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => [letter, 0]),
      ["OTHER", 0],
    ]) as Record<string, number>;
    for (const row of result.data?.filtered ?? []) {
      initialCounts[row.surnameInitial] = row._count;
    }
    const filteredCount = Object.values(initialCounts).reduce((total, value) => total + value, 0);
    const selectedCount = requestedInitial === "ALL"
      ? filteredCount
      : initialCounts[requestedInitial] ?? 0;
    const pageSize = requestedInitial === "ALL"
      ? RECIPIENT_HISTORY_PAGE_SIZE
      : RECIPIENT_INITIAL_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(selectedCount / pageSize));
    const page = Math.min(requestedPage, pageCount);

    if (page !== requestedPage) {
      try {
        result = await queryPage(pageSize, (page - 1) * pageSize);
      } catch (err) {
        logger.error("dcGetAnnouncementSendRecipients corrected page failed", { sendId, page, err });
        throw new HttpsError("internal", "Failed to load recipients");
      }
    }
    const rawRecipients = result.data?.recipients ?? [];
    const allRecipients: AnnouncementRecipient[] = rawRecipients.map((r) => ({
      id: r.id,
      sendId,
      userId: r.userId,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      status: r.status as AnnouncementRecipientStatus,
      skippedReason: r.skippedReason ?? undefined,
      sentAt: r.sentAt ?? undefined,
      failureReason: r.failureReason ?? undefined,
      failureCategory:
        r.failureCategory === ANNOUNCEMENT_FAILURE_CATEGORY_NOTIFY_TEAM_ONLY ||
        isNotifyTeamOnlyFailure(r.failureReason)
          ? "notify_team_only"
          : undefined,
      effectiveDeliveryMode: r.effectiveDeliveryMode as GovNotifyDeliveryMode,
    }));

    return {
      recipients: allRecipients,
      totalCount,
      filteredCount,
      initialCounts,
      page,
      pageSize,
      pageCount,
    };
  }
);

function recipientFilterQueryConfig(filter: AnnouncementRecipientStatusFilter): {
  statuses: string[];
  failureCategories: string[];
} {
  const bothCategories = [
    ANNOUNCEMENT_FAILURE_CATEGORY_NONE,
    ANNOUNCEMENT_FAILURE_CATEGORY_NOTIFY_TEAM_ONLY,
  ];
  if (filter === "IN_PROGRESS") {
    return { statuses: ["queued", "sending", "retrying", "delivery_unknown"], failureCategories: bothCategories };
  }
  if (filter === "PASSED") {
    return { statuses: ["sent", "delivered"], failureCategories: bothCategories };
  }
  if (filter === "NOT_ON_TEAM") {
    // Category is the durable invariant: live writers derive it only through
    // announcementFailureCategory. Accept every status so a legacy/backfilled
    // row with an inconsistent status cannot disappear from this filter.
    return {
      statuses: ["queued", "enqueue_failed", "sending", "retrying", "delivery_unknown", "sent", "delivered", "bounced", "failed", "skipped"],
      failureCategories: [ANNOUNCEMENT_FAILURE_CATEGORY_NOTIFY_TEAM_ONLY],
    };
  }
  if (filter === "FAILED") {
    return {
      statuses: ["enqueue_failed", "bounced", "failed"],
      failureCategories: [ANNOUNCEMENT_FAILURE_CATEGORY_NONE],
    };
  }
  if (filter === "SKIPPED") {
    return { statuses: ["skipped"], failureCategories: bothCategories };
  }
  return {
    statuses: ["queued", "enqueue_failed", "sending", "retrying", "delivery_unknown", "sent", "delivered", "bounced", "failed", "skipped"],
    failureCategories: bothCategories,
  };
}
