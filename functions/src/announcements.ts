import { randomUUID } from "node:crypto";
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
  getAnnouncementRecipientCount,
  getAnnouncementSendById,
  getAnnouncementSendHistory as dcGetAnnouncementSendHistory,
  getAnnouncementSendRecipients as dcGetAnnouncementSendRecipients,
} from "@dataconnect/admin-generated";
import { requireEnabled, requireString } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { govNotifyApiKey } from "./mailer";
import { FUNCTIONS_REGION } from "./constants";
import { signUnsubscribeToken, unsubscribeSecret } from "./unsubscribe";
import { buildAnnouncementReference } from "./announcementReference";
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
  skippedCount: number;
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
}

export interface AnnouncementRecipient {
  id: string;
  sendId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "skipped" | "sent" | "failed" | "delivered" | "bounced";
  skippedReason?: string;
  sentAt?: string;
  failureReason?: string;
}

interface AnnouncementEmailTask {
  sendId: string;
  recipientId: string;
  firstName: string;
  lastName: string;
  email: string;
  personalisation: Record<string, string>;
  /**
   * Always present regardless of whether the template's visible text references
   * ((unsubscribeUrl)) — GOV Notify requires a one-click-unsubscribe URL for bulk email
   * independent of what the template body displays. Kept separate from `personalisation`
   * (which is filtered down to only what the template references) so filtering can never
   * silently disable this.
   */
  unsubscribeUrl: string;
  templateUuid: string;
}

export const sendSectionAnnouncement = onCall(
  { region: FUNCTIONS_REGION, secrets: [unsubscribeSecret, govNotifyApiKey] },
  async (request): Promise<SendAnnouncementResult> => {
    requireEnabled(request);
    await enforceRateLimit("sendSectionAnnouncement", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    const templateName: string | null = typeof request.data?.templateName === "string"
      ? request.data.templateName
      : null;
    const callerUid = request.auth!.uid;

    await requireSectionModerator(callerUid, sectionId, request.auth!.token?.admin === true);

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
        (r: { user: { id: string } }) => r.user.id
      )
    );
    const { deliverable, optedOut } = partitionAnnouncementRecipients(
      recipients,
      sectionOptOutIds
    );

    const secret = unsubscribeSecret.value();
    const skippedRecipients = optedOut.map((recipient) => ({
      userId: recipient.id,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
    }));
    const tasks: AnnouncementEmailTask[] = [];

    for (const recipient of deliverable) {
      const unsubscribeUrl = `${APP_BASE_URL}/unsubscribe?token=${signUnsubscribeToken(
        {
          userId: recipient.id,
          sectionId,
          sectionName,
          exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
        },
        secret
      )}`;

      const personalisation = buildRecipientPersonalisation(
        recipient,
        sectionName,
        unsubscribeUrl,
        requiredPersonalisation
      );

      tasks.push({
        sendId: "",  // filled in after createAnnouncementSend
        recipientId: recipient.id,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
        personalisation,
        unsubscribeUrl,
        templateUuid,
      });
    }

    const announcementSendId = randomUUID();
    await createAnnouncementSend({
      id: announcementSendId,
      sectionId,
      templateUuid,
      templateName,
      sentBy: callerUid,
      recipientCount: tasks.length,
      skippedCount: skippedRecipients.length,
      failureCount: 0,
    });

    // Write skipped recipients
    const CHUNK_SIZE = 10;
    for (let i = 0; i < skippedRecipients.length; i += CHUNK_SIZE) {
      await Promise.all(
        skippedRecipients.slice(i, i + CHUNK_SIZE).map((r) =>
          createAnnouncementRecipient({
            announcementSendId,
            userId: r.userId,
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            status: "skipped",
            skippedReason: "opted_out",
            sentAt: null,
            failureReason: null,
          })
        )
      );
    }

    // Enqueue one task per recipient
    const queue = getFunctions().taskQueue(
      `locations/${FUNCTIONS_REGION}/functions/processAnnouncementEmail`
    );
    await Promise.all(
      tasks.map((t) => queue.enqueue({ ...t, sendId: announcementSendId }))
    );

    logger.info("Announcement queued", {
      announcementSendId,
      sectionId,
      templateUuid,
      queuedCount: tasks.length,
      skippedCount: skippedRecipients.length,
    });
    return { sendId: announcementSendId, queuedCount: tasks.length, skippedCount: skippedRecipients.length };
  }
);

export const processAnnouncementEmail = onTaskDispatched<AnnouncementEmailTask>(
  {
    region: FUNCTIONS_REGION,
    secrets: [govNotifyApiKey],
    rateLimits: { maxDispatchesPerSecond: 20 },
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 10, maxBackoffSeconds: 60 },
  },
  async (req) => {
    const { sendId, recipientId, firstName, lastName, email, personalisation, unsubscribeUrl, templateUuid } = req.data;

    const client = new NotifyClient(govNotifyApiKey.value());
    let status: "sent" | "failed" = "sent";
    let failureReason: string | null = null;

    try {
      await client.sendEmail(templateUuid, email, {
        personalisation,
        reference: buildAnnouncementReference(sendId, recipientId),
        oneClickUnsubscribeURL: unsubscribeUrl,
      } as Parameters<typeof client.sendEmail>[2]);
    } catch (err) {
      status = "failed";
      failureReason = err instanceof Error ? err.message : "Unknown error";
      logger.error("Failed to send announcement email", { sendId, recipientId, err });
    }

    await createAnnouncementRecipient({
      announcementSendId: sendId,
      userId: recipientId,
      email,
      firstName,
      lastName,
      status,
      skippedReason: null,
      sentAt: status === "sent" ? new Date().toISOString() : null,
      failureReason,
    });

    // Re-throw on failure so Cloud Tasks retries (recipient record will be duplicate on retry,
    // but GOV Notify's idempotent reference prevents duplicate sends)
    if (status === "failed") throw new Error(failureReason ?? "Send failed");
  }
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

    const processedCounts = await Promise.all(
      rawSends.map(async (s) => {
        try {
          const r = await getAnnouncementRecipientCount({ sendId: s.id });
          return r.data?.announcementRecipients?.length ?? 0;
        } catch {
          return 0;
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
      processedCount: processedCounts[i],
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
      status: r.status as "skipped" | "sent" | "failed" | "delivered" | "bounced",
      skippedReason: r.skippedReason ?? undefined,
      sentAt: r.sentAt ?? undefined,
      failureReason: r.failureReason ?? undefined,
    }));

    return { recipients };
  }
);
