import * as logger from "firebase-functions/logger";
import { getUserById, NotificationChannel } from "@dataconnect/admin-generated";
import { createConfiguredGovNotifyMailer, GOV_NOTIFY_PROVIDER } from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import { normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";
import { getAdminUsers } from "./helpers";
import { isUserPendingApproval } from "./pendingUserApproval";

export const PENDING_APPROVAL_ALERT_TEMPLATE_KEYS = ["newUserPendingApprovalAlert"] as const;

export type PendingApprovalAlertTemplates = {
  newUserPendingApprovalAlert: {
    firstName: string;
    lastName: string;
    email: string;
    serviceNumber: string;
    serviceBackgroundSummary: string;
    requestedMembershipStatus: string;
    approveUsersUrl: string;
  };
};

export function createPendingApprovalAlertMailer(): ReturnType<
  typeof createConfiguredGovNotifyMailer<PendingApprovalAlertTemplates>
> {
  return createConfiguredGovNotifyMailer([...PENDING_APPROVAL_ALERT_TEMPLATE_KEYS]);
}

export function pendingApprovalDeliveryKey(userId: string, adminEmail: string): string {
  return `pending-approval:${userId}:${adminEmail}`;
}

/** e.g. "Regular, Reserve" or "Not specified" if none of the flags are set. */
export function summarizeServiceBackground(profile: {
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
}): string {
  const labels: string[] = [];
  if (profile.isRegular) labels.push("Regular");
  if (profile.isReserve) labels.push("Reserve");
  if (profile.isCivilServant) labels.push("Civil Servant");
  if (profile.isIndustry) labels.push("Industry");
  return labels.length > 0 ? labels.join(", ") : "Not specified";
}

/**
 * Notifies all admins when a user enters the Approve Users queue: verified email, profile
 * submitted, membership awaiting approval, and not yet enabled (see isUserPendingApproval).
 * Safe to call from any path that might put a user into this state — no-ops if the user isn't
 * actually pending approval yet, and sendNotificationOnce dedupes per admin so retries or repeat
 * calls (e.g. syncPendingUserClaims runs at both registration and post-profile-submit) never
 * double-send. See #271.
 */
export async function notifyAdminsUserPendingApproval(args: {
  userId: string;
  emailVerified: boolean;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createPendingApprovalAlertMailer>;
}): Promise<void> {
  try {
    const row = await getUserById({ id: args.userId });
    const profile = row.data?.user;
    if (!profile) {
      return;
    }
    if (
      !isUserPendingApproval({
        emailVerified: args.emailVerified,
        authEnabled: false,
        membershipStatus: profile.membershipStatus,
      })
    ) {
      return;
    }

    const admins = await getAdminUsers();
    const recipients = Array.from(
      new Set(
        admins
          .map((a) => a.email?.trim().toLowerCase())
          .filter((email): email is string => !!email)
      )
    );
    if (recipients.length === 0) {
      logger.warn("pending approval admin alert skipped (no admin recipients)", { userId: args.userId });
      return;
    }

    const mailer = (args.getMailer ?? createPendingApprovalAlertMailer)();
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const approveUsersUrl = `${base}/admin/users/approvals`;
    const reference = `PENDING_APPROVAL:${args.userId}`;

    const personalisation: PendingApprovalAlertTemplates["newUserPendingApprovalAlert"] = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      serviceNumber: profile.serviceNumber,
      serviceBackgroundSummary: summarizeServiceBackground(profile),
      requestedMembershipStatus: profile.requestedMembershipStatus ?? profile.membershipStatus ?? "—",
      approveUsersUrl,
    };

    for (const to of recipients) {
      const deliveryKey = pendingApprovalDeliveryKey(args.userId, to);
      try {
        await sendNotificationOnce({
          channel: NotificationChannel.EMAIL,
          notificationType: "USER_PENDING_APPROVAL",
          deliveryKey,
          userId: args.userId,
          provider: GOV_NOTIFY_PROVIDER,
          send: async () => {
            const r = await mailer.sendEmail({
              templateName: "newUserPendingApprovalAlert",
              to,
              personalisation,
              reference,
            });
            return { providerMessageId: r.providerNotificationId ?? null };
          },
        });
      } catch (error) {
        logger.error("pending approval admin alert delivery failed", {
          userId: args.userId,
          to,
          error: sanitizeMailerError(error),
        });
      }
    }
  } catch (error) {
    logger.error("pending approval admin alert failed", {
      userId: args.userId,
      error: sanitizeMailerError(error),
    });
  }
}
