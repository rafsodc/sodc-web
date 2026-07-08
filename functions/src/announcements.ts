import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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

// ── Cloud Functions ──────────────────────────────────────────────────────────

export interface AnnouncementTemplate {
  id: string;
  name: string;
  updatedAt: string;
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
    const all = (response.data as { templates: { id: string; name: string; updated_at: string | null; created_at: string }[] })
      .templates ?? [];

    const templates: AnnouncementTemplate[] = all
      .filter((t) => t.name.startsWith(BULK_PREFIX))
      .sort((a, b) => {
        const dateA = new Date(a.updated_at ?? a.created_at).getTime();
        const dateB = new Date(b.updated_at ?? b.created_at).getTime();
        return dateB - dateA;
      })
      .map((t) => ({ id: t.id, name: t.name, updatedAt: t.updated_at ?? t.created_at }));

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
    const response = await client.previewTemplateById(templateUuid, { firstName: "there" });
    const data = response.data as { html: string; subject: string };
    return { html: data.html ?? "", subject: data.subject ?? "" };
  }
);

export interface SendAnnouncementResult {
  sentCount: number;
  skippedCount: number;
  failureCount: number;
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
  failureCount: number;
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

export const sendSectionAnnouncement = onCall(
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey, unsubscribeSecret] },
  async (request): Promise<SendAnnouncementResult> => {
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    const templateName: string | null = typeof request.data?.templateName === "string"
      ? request.data.templateName
      : null;
    const callerUid = request.auth!.uid;

    await requireSectionModerator(callerUid, sectionId, request.auth!.token?.admin === true);

    const apiKey = govNotifyApiKey.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "GOV_NOTIFY_API_KEY not configured");

    const [{ recipients, sectionName }, optOutResult] = await Promise.all([
      resolveRecipients(sectionId, callerUid),
      getSectionAnnouncementOptOuts({ sectionId }),
    ]);

    const sectionOptOutIds = new Set(
      (optOutResult.data?.sectionAnnouncementOptOuts ?? []).map(
        (r: { user: { id: string } }) => r.user.id
      )
    );

    const client = new NotifyClient(apiKey);
    let sentCount = 0;
    let skippedCount = 0;
    let failureCount = 0;

    interface RecipientRecord {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      status: "skipped" | "sent" | "failed";
      skippedReason?: string;
      sentAt?: string;
      failureReason?: string;
    }
    const recipientRecords: RecipientRecord[] = [];

    for (const recipient of recipients) {
      if (sectionOptOutIds.has(recipient.id)) {
        skippedCount++;
        recipientRecords.push({
          userId: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          status: "skipped",
          skippedReason: "opted_out",
        });
        continue;
      }

      const unsubscribeUrl = `${APP_BASE_URL}/unsubscribe?token=${signUnsubscribeToken(
        {
          userId: recipient.id,
          sectionId,
          sectionName,
          exp: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
        },
        unsubscribeSecret.value()
      )}`;

      try {
        await client.sendEmail(templateUuid, recipient.email, {
          personalisation: {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            email: recipient.email,
            serviceNumber: recipient.serviceNumber,
            membershipStatus: recipient.membershipStatus,
            section: sectionName,
            unsubscribeUrl,
          },
          reference: `announcement-${sectionId}-${recipient.id}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          one_click_unsubscribe_url: unsubscribeUrl,
        } as Parameters<typeof client.sendEmail>[2]);
        sentCount++;
        recipientRecords.push({
          userId: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          status: "sent",
          sentAt: new Date().toISOString(),
        });
      } catch (err) {
        failureCount++;
        logger.error(`Failed to send announcement to ${recipient.id}`, { err, sectionId, templateUuid });
        recipientRecords.push({
          userId: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          status: "failed",
          failureReason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Write the send summary to DataConnect
    const announcementSendId = randomUUID();
    await createAnnouncementSend({
      id: announcementSendId,
      sectionId,
      templateUuid,
      templateName,
      sentBy: callerUid,
      recipientCount: sentCount,
      skippedCount,
      failureCount,
    });

    // Write per-recipient records concurrently in chunks
    const CHUNK_SIZE = 10;
    for (let i = 0; i < recipientRecords.length; i += CHUNK_SIZE) {
      await Promise.all(
        recipientRecords.slice(i, i + CHUNK_SIZE).map((r) =>
          createAnnouncementRecipient({
            announcementSendId,
            userId: r.userId,
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            status: r.status,
            skippedReason: r.skippedReason ?? null,
            sentAt: r.sentAt ?? null,
            failureReason: r.failureReason ?? null,
          })
        )
      );
    }

    logger.info("Announcement sent", { sectionId, templateUuid, sentCount, skippedCount, failureCount });
    return { sentCount, skippedCount, failureCount };
  }
);

export const getAnnouncementSendHistory = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<{ sends: AnnouncementSend[] }> => {
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    await requireSectionModerator(request.auth!.uid, sectionId, request.auth!.token?.admin === true);

    const result = await dcGetAnnouncementSendHistory({ sectionId });
    const sends: AnnouncementSend[] = (result.data?.announcementSends ?? []).map((s) => ({
      id: s.id,
      templateUuid: s.templateUuid,
      templateName: s.templateName ?? null,
      sectionId,
      sentBy: s.sentBy,
      sentAt: s.sentAt,
      recipientCount: s.recipientCount,
      skippedCount: s.skippedCount,
      failureCount: s.failureCount,
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
