import { createHash, randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { getFunctions } from "firebase-admin/functions";
import * as logger from "firebase-functions/logger";
import { NotifyClient } from "notifications-node-client";
import {
  getSectionById,
  getSectionMembers,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  listUsers,
  getSectionAnnouncementOptOuts,
  createAnnouncementSend,
  createAnnouncementRecipient,
  getAnnouncementRecipientProgress,
  getAnnouncementRecipientsForResume,
  getAnnouncementSendById,
  tryMarkAnnouncementRecipientEnqueueFailed,
  tryUpdateAnnouncementRecipientProcessingStatus,
  getAnnouncementSendHistory as dcGetAnnouncementSendHistory,
  getAnnouncementSendRecipients as dcGetAnnouncementSendRecipients,
} from "@dataconnect/admin-generated";
import { requireEnabled, requireString } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { govNotifyApiKey } from "./mailer";
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
} from "./announcementRecipients";

const BULK_PREFIX = "BULK:";

const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try { new URL(url); } catch { throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`); }
  return url.replace(/\/$/, "");
})();


// ── Auth helper ──────────────────────────────────────────────────────────────

function linkHasPurpose(
  link: { purpose?: string; purposes?: string[] | null },
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
  const membersResult = await getSectionMembers({ sectionId });

  const sectionData = membersResult.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");

  const purposeLinks = (sectionData.purposeLinks ?? []) as AnnouncementPurposeLink[];
  const statusFilters = getAnnouncementStatusFilters(purposeLinks);
  const statusCandidates = statusFilters.size > 0
    ? (await listUsers()).data?.users ?? []
    : [];
  const recipients = mergeAnnouncementRecipients(purposeLinks, statusCandidates);

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
    const start = text.indexOf("((", index);
    if (start === -1) break;
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

export const getAnnouncementTemplates = onCall(
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] },
  async (request): Promise<{ templates: AnnouncementTemplate[] }> => {
    requireEnabled(request);
    await enforceRateLimit("getAnnouncementTemplates", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const apiKey = govNotifyApiKey.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "GOV_NOTIFY_API_KEY not configured");

    const client = new NotifyClient(apiKey);
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
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] },
  async (request): Promise<{ html: string; subject: string }> => {
    requireEnabled(request);
    await enforceRateLimit("previewAnnouncementTemplate", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const apiKey = govNotifyApiKey.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "GOV_NOTIFY_API_KEY not configured");

    const client = new NotifyClient(apiKey);
    // GOV Notify ignores extra personalisation keys — pass all placeholders so any template variable is satisfied
    const response = await client.previewTemplateById(templateUuid, PREVIEW_PLACEHOLDERS);
    const data = response.data as { html: string; subject: string };
    return { html: data.html ?? "", subject: data.subject ?? "" };
  }
);

export interface SendAnnouncementResult {
  sendId: string;
  queuedCount: number;
  failedToEnqueueCount: number;
  skippedCount: number;
  resumed: boolean;
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
  processedCount: number;
  failureCount: number;
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
}

interface SkippedAnnouncementRecipient {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AnnouncementRecipientSnapshot {
  version: 1;
  tasks: AnnouncementEmailTask[];
  skippedRecipients: SkippedAnnouncementRecipient[];
}

const WRITE_CHUNK_SIZE = 10;
const ENQUEUE_CHUNK_SIZE = 20;
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

export function announcementTaskId(sendId: string, recipientId: string): string {
  return createHash("sha256").update(`${sendId}:${recipientId}`).digest("hex");
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
  const current = await getAnnouncementRecipientsForResume({ sendId });
  const existing = new Map(
    (current.data?.announcementRecipients ?? []).map((row) => [row.userId, { id: row.id, status: row.status }]),
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
      })),
    ...snapshot.skippedRecipients
      .filter((recipient) => !existing.has(recipient.userId))
      .map((recipient) => ({
        id: randomUUID(),
        ...recipient,
        status: "skipped",
        skippedReason: "opted_out",
      })),
  ];

  for (let i = 0; i < missing.length; i += WRITE_CHUNK_SIZE) {
    const results = await Promise.allSettled(
      missing.slice(i, i + WRITE_CHUNK_SIZE).map((recipient) =>
        createAnnouncementRecipient({
          id: recipient.id,
          announcementSendId: sendId,
          userId: recipient.userId,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          status: recipient.status,
          skippedReason: recipient.skippedReason,
          sentAt: null,
          failureReason: null,
        }),
      ),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected" && !isDuplicateKeyError(result.reason),
    );
    if (failure) throw failure.reason;
  }

  const refreshed = await getAnnouncementRecipientsForResume({ sendId });
  return new Map(
    (refreshed.data?.announcementRecipients ?? []).map((row) => [row.userId, { id: row.id, status: row.status }]),
  );
}

async function enqueueSnapshot(
  sendId: string,
  snapshot: AnnouncementRecipientSnapshot,
): Promise<{ queuedCount: number; failedToEnqueueCount: number }> {
  const queue = getFunctions().taskQueue(
    `locations/${FUNCTIONS_REGION}/functions/processAnnouncementEmail`,
  );
  let rows = await ensureRecipientRows(sendId, snapshot);
  const candidates = snapshot.tasks.filter((task) => {
    const status = rows.get(task.recipientId)?.status;
    return status === "queued" || status === "enqueue_failed";
  });

  for (let i = 0; i < candidates.length; i += ENQUEUE_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + ENQUEUE_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((task) => queue.enqueue(task, {
        id: announcementTaskId(sendId, task.recipientId),
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
              providerNotificationId: null,
            });
          }
          return;
        }
        if (!row || row.status !== "queued") return;
        const message = result.reason instanceof Error ? result.reason.message : "Cloud Task enqueue failed";
        await tryMarkAnnouncementRecipientEnqueueFailed({
          id: row.id,
          failureReason: message.slice(0, 500),
        });
      }),
    );
  }

  rows = await ensureRecipientRows(sendId, snapshot);
  const failedToEnqueueCount = snapshot.tasks.filter(
    (task) => rows.get(task.recipientId)?.status === "enqueue_failed",
  ).length;
  return {
    queuedCount: snapshot.tasks.length - failedToEnqueueCount,
    failedToEnqueueCount,
  };
}

export const sendSectionAnnouncement = onCall(
  { region: FUNCTIONS_REGION, secrets: [unsubscribeSecret, govNotifyApiKey], timeoutSeconds: 120 },
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

    let resumed = false;
    let existingResult = await getAnnouncementSendById({ id: requestId });
    let existing = existingResult.data?.announcementSend;
    let snapshot: AnnouncementRecipientSnapshot;

    if (existing) {
      if (
        existing.sectionId !== sectionId ||
        existing.templateUuid !== templateUuid ||
        existing.sentBy !== callerUid
      ) {
        throw new HttpsError("already-exists", "requestId is already in use");
      }
      resumed = true;
      snapshot = parseRecipientSnapshot(existing.recipientSnapshot);
    } else {
      const apiKey = govNotifyApiKey.value();
      if (!apiKey) throw new HttpsError("failed-precondition", "GOV_NOTIFY_API_KEY not configured");
      const client = new NotifyClient(apiKey);
      const templateResponse = await client.getTemplateById(templateUuid);
      const template = templateResponse.data as { body?: string; subject?: string };
      const requiredPersonalisation = extractTemplateVariables(template.body ?? "", template.subject ?? "");

      const [{ recipients, sectionName }, optOutResult] = await Promise.all([
        resolveAnnouncementRecipients(sectionId),
        getSectionAnnouncementOptOuts({ sectionId }),
      ]);
      const sectionOptOutIds = new Set(
        (optOutResult.data?.sectionAnnouncementOptOuts ?? []).map(
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
        };
      });
      snapshot = {
        version: 1,
        tasks,
        skippedRecipients: optedOut.map((recipient) => ({
          userId: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
        })),
      };

      try {
        await createAnnouncementSend({
          id: requestId,
          sectionId,
          templateUuid,
          templateName,
          sentBy: callerUid,
          recipientCount: snapshot.tasks.length,
          skippedCount: snapshot.skippedRecipients.length,
          recipientSnapshot: JSON.stringify(snapshot),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        existingResult = await getAnnouncementSendById({ id: requestId });
        existing = existingResult.data?.announcementSend;
        if (
          !existing ||
          existing.sectionId !== sectionId ||
          existing.templateUuid !== templateUuid ||
          existing.sentBy !== callerUid
        ) {
          throw new HttpsError("already-exists", "requestId is already in use");
        }
        resumed = true;
        snapshot = parseRecipientSnapshot(existing.recipientSnapshot);
      }
    }

    const enqueueResult = await enqueueSnapshot(requestId, snapshot);

    logger.info("Announcement queued", {
      announcementSendId: requestId,
      sectionId,
      templateUuid,
      queuedCount: enqueueResult.queuedCount,
      failedToEnqueueCount: enqueueResult.failedToEnqueueCount,
      skippedCount: snapshot.skippedRecipients.length,
      resumed,
    });
    return {
      sendId: requestId,
      queuedCount: enqueueResult.queuedCount,
      failedToEnqueueCount: enqueueResult.failedToEnqueueCount,
      skippedCount: snapshot.skippedRecipients.length,
      resumed,
    };
  }
);

export const processAnnouncementEmail = onTaskDispatched<AnnouncementEmailTask>(
  {
    region: FUNCTIONS_REGION,
    secrets: [govNotifyApiKey],
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
          const result = await getAnnouncementRecipientProgress({ sendId: s.id });
          const statuses = (result.data?.announcementRecipients ?? []).map((row) => row.status);
          return {
            processedCount: statuses.filter((status) =>
              status === "sent" || status === "delivered" || status === "bounced" || status === "failed"
            ).length,
            failureCount: statuses.filter((status) =>
              status === "failed" || status === "bounced" || status === "enqueue_failed" ||
              status === "delivery_unknown"
            ).length,
          };
        } catch {
          return { processedCount: 0, failureCount: 0 };
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
    }));

    return { sends };
  }
);

export const getAnnouncementSendRecipients = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<{ recipients: AnnouncementRecipient[] }> => {
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

    let result: Awaited<ReturnType<typeof dcGetAnnouncementSendRecipients>>;
    try {
      result = await dcGetAnnouncementSendRecipients({ sendId });
    } catch (err) {
      logger.error("dcGetAnnouncementSendRecipients failed", { sendId, err });
      throw new HttpsError("internal", "Failed to load recipients");
    }
    const recipients: AnnouncementRecipient[] = (result.data?.announcementRecipients ?? []).map((r) => ({
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
    }));

    return { recipients };
  }
);
