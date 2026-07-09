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
  getSectionAnnouncementOptOuts,
  createAnnouncementSend,
  createAnnouncementRecipient,
  getAnnouncementRecipientCount,
  getAnnouncementSendHistory as dcGetAnnouncementSendHistory,
  getAnnouncementSendRecipients as dcGetAnnouncementSendRecipients,
} from "@dataconnect/admin-generated";
import { requireAuth, requireString } from "./helpers";
import { govNotifyApiKey } from "./mailer";
import { FUNCTIONS_REGION } from "./constants";
import { signUnsubscribeToken, unsubscribeSecret } from "./unsubscribe";

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

interface Recipient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: string;
}

interface ResolveResult {
  recipients: Recipient[];
  sectionName: string;
}

async function resolveRecipients(sectionId: string, callerUid: string): Promise<ResolveResult> {
  const [membersResult, callerGroupsResult, userStatusResult] = await Promise.all([
    getSectionMembers({ sectionId }),
    getUserAccessGroupsById({ userId: callerUid }),
    getUserMembershipStatus({ id: callerUid }),
  ]);

  const sectionData = membersResult.data?.section;
  if (!sectionData) throw new HttpsError("not-found", "Section not found");

  const purposeLinks = sectionData.purposeLinks ?? [];
  const accessGroupIds = new Set(
    purposeLinks
      .filter((pl) => linkHasPurpose(pl, "ACCESS") || linkHasPurpose(pl, "MODERATOR"))
      .map((pl) => pl.userGroup.id)
  );

  const callerGroupIds = new Set(
    (callerGroupsResult.data?.user?.userGroups ?? []).map(
      (ug: { userGroup: { id: string } }) => ug.userGroup.id
    )
  );

  // Explicit group members
  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  for (const link of purposeLinks) {
    if (!accessGroupIds.has(link.userGroup.id)) continue;
    for (const { user } of link.userGroup.users) {
      if (!seen.has(user.id)) {
        seen.add(user.id);
        recipients.push({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          serviceNumber: user.serviceNumber,
          membershipStatus: user.membershipStatus,
        });
      }
    }
  }

  // Status-derived members (those whose membership status grants access)
  const userStatus = userStatusResult.data?.user?.membershipStatus;
  const hasCallerDirectAccess = [...accessGroupIds].some((id) => callerGroupIds.has(id));
  if (!hasCallerDirectAccess && userStatus) {
    const grantedByStatus = purposeLinks.some(
      (pl) =>
        accessGroupIds.has(pl.userGroup.id) &&
        (pl.userGroup.membershipStatuses?.includes(userStatus) ?? false)
    );
    if (grantedByStatus && !seen.has(callerUid)) {
      // Status-derived members are handled by the existing groups; we trust getSectionMembers
      // includes them via membershipStatuses. No extra action needed here.
    }
  }

  return { recipients, sectionName: sectionData.name ?? sectionId };
}

// ── Personalisation helpers ───────────────────────────────────────────────────

function extractTemplateVariables(body: string, subject: string): string[] {
  const text = `${body} ${subject}`;
  const matches = [...text.matchAll(/\(\(([^)]+)\)\)/g)];
  return [...new Set(matches.map((m) => m[1].trim()))];
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
    requireAuth(request);
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
    requireAuth(request);
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");

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
  status: "skipped" | "sent" | "failed";
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
  templateUuid: string;
}

export const sendSectionAnnouncement = onCall(
  { region: FUNCTIONS_REGION, secrets: [unsubscribeSecret] },
  async (request): Promise<SendAnnouncementResult> => {
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    const templateName: string | null = typeof request.data?.templateName === "string"
      ? request.data.templateName
      : null;
    const callerUid = request.auth!.uid;

    await requireSectionModerator(callerUid, sectionId, request.auth!.token?.admin === true);

    const [{ recipients, sectionName }, optOutResult] = await Promise.all([
      resolveRecipients(sectionId, callerUid),
      getSectionAnnouncementOptOuts({ sectionId }),
    ]);

    const sectionOptOutIds = new Set(
      (optOutResult.data?.sectionAnnouncementOptOuts ?? []).map(
        (r: { user: { id: string } }) => r.user.id
      )
    );

    const secret = unsubscribeSecret.value();
    const skippedRecipients: { userId: string; email: string; firstName: string; lastName: string }[] = [];
    const tasks: AnnouncementEmailTask[] = [];

    for (const recipient of recipients) {
      if (sectionOptOutIds.has(recipient.id)) {
        skippedRecipients.push({
          userId: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
        });
        continue;
      }

      const personalisation: Record<string, string> = {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
        serviceNumber: recipient.serviceNumber,
        membershipStatus: recipient.membershipStatus,
        section: sectionName,
        unsubscribeUrl: `${APP_BASE_URL}/unsubscribe?token=${signUnsubscribeToken(
          {
            userId: recipient.id,
            sectionId,
            sectionName,
            exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
          },
          secret
        )}`,
      };

      tasks.push({
        sendId: "",  // filled in after createAnnouncementSend
        recipientId: recipient.id,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
        personalisation,
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
    const { sendId, recipientId, firstName, lastName, email, personalisation, templateUuid } = req.data;

    const client = new NotifyClient(govNotifyApiKey.value());
    let status: "sent" | "failed" = "sent";
    let failureReason: string | null = null;

    try {
      await client.sendEmail(templateUuid, email, {
        personalisation,
        reference: `announcement-${sendId}-${recipientId}`,
        oneClickUnsubscribeURL: personalisation.unsubscribeUrl,
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
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const result = await dcGetAnnouncementSendHistory({ sectionId });
    const rawSends = result.data?.announcementSends ?? [];

    const processedCounts = await Promise.all(
      rawSends.map((s) =>
        getAnnouncementRecipientCount({ sendId: s.id })
          .then((r) => r.data?.announcementRecipients?.length ?? 0)
          .catch(() => 0)
      )
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
    requireAuth(request);
    const sendId = requireString(request.data?.sendId, "sendId");
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const result = await dcGetAnnouncementSendRecipients({ sendId });
    const recipients: AnnouncementRecipient[] = (result.data?.announcementRecipients ?? []).map((r) => ({
      id: r.id,
      sendId,
      userId: r.userId,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      status: r.status as "skipped" | "sent" | "failed",
      skippedReason: r.skippedReason ?? undefined,
      sentAt: r.sentAt ?? undefined,
      failureReason: r.failureReason ?? undefined,
    }));

    return { recipients };
  }
);
