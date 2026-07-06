import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { NotifyClient } from "notifications-node-client";
import {
  getSectionById,
  getSectionMembers,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  getSectionAnnouncementOptOuts,
} from "@dataconnect/admin-generated";
import { requireAuth, requireString } from "./helpers";
import { govNotifyApiKey } from "./mailer";
import { FUNCTIONS_REGION } from "./constants";

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
  sectionId: string
): Promise<void> {
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
  email: string;
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
        recipients.push({ id: user.id, firstName: user.firstName, email: user.email });
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
    await requireSectionModerator(request.auth!.uid, sectionId);

    const apiKey = govNotifyApiKey.value();
    if (!apiKey) throw new HttpsError("failed-precondition", "GOV_NOTIFY_API_KEY not configured");

    const client = new NotifyClient(apiKey);
    const response = await client.getAllTemplates("email");
    const all = (response.data as { templates: { id: string; name: string; updated_at: string }[] })
      .templates ?? [];

    const templates: AnnouncementTemplate[] = all
      .filter((t) => t.name.startsWith(BULK_PREFIX))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map((t) => ({ id: t.id, name: t.name, updatedAt: t.updated_at }));

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

export const sendSectionAnnouncement = onCall(
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] },
  async (request): Promise<SendAnnouncementResult> => {
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const templateUuid = requireString(request.data?.templateUuid, "templateUuid");
    const callerUid = request.auth!.uid;

    await requireSectionModerator(callerUid, sectionId);

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

    for (const recipient of recipients) {
      if (sectionOptOutIds.has(recipient.id)) {
        skippedCount++;
        continue;
      }

      try {
        await client.sendEmail(templateUuid, recipient.email, {
          personalisation: {
            firstName: recipient.firstName,
            section: sectionName,
            // TODO(#311): replace with a per-user, per-section opt-out deep link
            unsubscribeUrl: `${APP_BASE_URL}/account`,
          },
          reference: `announcement-${sectionId}-${recipient.id}`,
        });
        sentCount++;
      } catch (err) {
        failureCount++;
        logger.error(`Failed to send announcement to ${recipient.id}`, { err, sectionId, templateUuid });
      }
    }

    // Audit record
    await getFirestore()
      .collection("announcementSends")
      .add({
        templateUuid,
        sectionId,
        sentBy: callerUid,
        sentAt: Timestamp.now(),
        recipientCount: sentCount,
        skippedCount,
        failureCount,
      });

    logger.info("Announcement sent", { sectionId, templateUuid, sentCount, skippedCount, failureCount });
    return { sentCount, skippedCount, failureCount };
  }
);
