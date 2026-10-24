import { pendingApprovalUidDeliveryKey } from "./notificationDeliveryKeys";
export { pendingApprovalDeliveryKey, pendingApprovalUidDeliveryKey } from "./notificationDeliveryKeys";
import type { NotificationRecoveryClaim } from "./notificationRecoveryClaim";
import * as logger from "firebase-functions/logger";
import { serviceGetUserById as getUserById, NotificationChannel } from "@dataconnect/admin-generated";
import {
  createConfiguredGovNotifyMailer,
  GOV_NOTIFY_PROVIDER,
} from "./mailer";
import { normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendPrivilegedNotification } from "./privilegedNotificationDelivery";
import { selectPrivilegedNotificationRecipientIds } from "./privilegedNotificationRecipient";
import { getAdminUsers } from "./helpers";
import { isUserPendingApproval } from "./pendingUserApproval";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";

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
  recipientUserIds?: readonly string[];
  recoveryDeliveryKey?: string;
  getMailer?: () => ReturnType<typeof createPendingApprovalAlertMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
  recoveryClaim?: NotificationRecoveryClaim;
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

    const recipients = args.recipientUserIds
      ? Array.from(new Set(args.recipientUserIds))
      : await selectPrivilegedNotificationRecipientIds((await getAdminUsers()).map((user) => user.uid), { kind: "ADMIN" });
    if (recipients.length === 0) {
      logger.warn("pending approval admin alert skipped (no admin recipients)", { userId: args.userId });
      return;
    }

    const mailer = (args.getMailer ?? createPendingApprovalAlertMailer)();
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const approveUsersUrl = `${base}/admin/users/approvals`;

    const personalisation: PendingApprovalAlertTemplates["newUserPendingApprovalAlert"] = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      serviceNumber: profile.serviceNumber,
      serviceBackgroundSummary: summarizeServiceBackground(profile),
      requestedMembershipStatus: profile.requestedMembershipStatus ?? profile.membershipStatus ?? "—",
      approveUsersUrl,
    };

    for (const recipientUserId of recipients) {
      const deliveryKey = args.recoveryDeliveryKey ?? pendingApprovalUidDeliveryKey(args.userId, recipientUserId);
      try {
        await sendPrivilegedNotification({
          channel: NotificationChannel.EMAIL,
          notificationType: "USER_PENDING_APPROVAL",
          deliveryKey: args.recoveryClaim?.deliveryKey ?? deliveryKey,
          preserveDeliveryKey: Boolean(args.recoveryClaim || args.recoveryDeliveryKey),
          recipientUserId,
          scope: { kind: "ADMIN" },
          event: { kind: "APPLICANT", subjectUserId: args.userId },
          userId: args.userId,
          provider: GOV_NOTIFY_PROVIDER,
          deliveryMode: args.deliveryMode,
          recoveryClaim: args.recoveryClaim,
          recoveryPayload: {
            version: 2,
            kind: "USER_PENDING_APPROVAL",
            userId: args.userId,
            emailVerified: args.emailVerified,
            recipientUserId,
          },
          sendAuthorized: async (email, deliveryMode) => {
            const r = await mailer.sendEmail({
              templateName: "newUserPendingApprovalAlert",
              to: email,
              personalisation,
              reference: pendingApprovalUidDeliveryKey(args.userId, recipientUserId),
              requestedDeliveryMode: deliveryMode,
            });
            return {
              providerMessageId: r.providerNotificationId ?? null,
              deliveryMode: r.deliveryMode?.effectiveMode,
            };
          },
        });
      } catch (error) {
        logger.error("pending approval admin alert delivery failed", {
          userId: args.userId,
          recipientUserId,
          errorType: error instanceof Error ? error.name : typeof error,
        });
      }
    }
  } catch (error) {
    logger.error("pending approval admin alert failed", {
      userId: args.userId,
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }
}
