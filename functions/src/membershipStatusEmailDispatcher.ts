import { classifyMembershipStatusEmailTransition, membershipStatusDeliveryKey, type MembershipStatusEmailKind } from "./notificationDeliveryKeys";
export { classifyMembershipStatusEmailTransition, membershipStatusDeliveryKey } from "./notificationDeliveryKeys";
import type { NotificationRecoveryClaim } from "./notificationRecoveryClaim";
import * as logger from "firebase-functions/logger";
import { getUserMembershipStatus, NotificationChannel } from "@dataconnect/admin-generated";
import { createConfiguredGovNotifyMailer, GOV_NOTIFY_PROVIDER } from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import { normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";
import {
  type MembershipStatus,
} from "./validation";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";

export const MEMBERSHIP_MAIL_TEMPLATE_KEYS = ["membershipActivated", "membershipAccessRestricted"] as const;

export type MembershipEmailTemplates = {
  membershipActivated: {
    firstName: string;
    membershipStatusLabel: string;
    appUrl: string;
    profileUrl: string;
  };
  membershipAccessRestricted: {
    firstName: string;
    membershipStatusLabel: string;
    previousStatusLabel: string;
    appUrl: string;
  };
};

export type { MembershipStatusEmailKind } from "./notificationDeliveryKeys";

const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  PENDING: "Pending",
  REGULAR: "Regular",
  RESERVE: "Reserve",
  CIVIL_SERVICE: "Civil Service",
  INDUSTRY: "Industry",
  RETIRED: "Retired",
  RESIGNED: "Resigned",
  LOST: "Lost",
  DECEASED: "Deceased",
};

export function membershipStatusCustomerLabel(status: MembershipStatus): string {
  return MEMBERSHIP_STATUS_LABELS[status] ?? status;
}

export function membershipStatusNotifyReference(args: {
  kind: MembershipStatusEmailKind;
  userId: string;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
}): string {
  const from = args.previousStatus ?? "UNKNOWN";
  const typeLabel = args.kind === "activation" ? "MEMBERSHIP_ACTIVATED" : "MEMBERSHIP_ACCESS_RESTRICTED";
  return `${typeLabel}:${args.userId}:${from}:${args.newStatus}`;
}

export function createMembershipStatusMailer(): ReturnType<
  typeof createConfiguredGovNotifyMailer<MembershipEmailTemplates>
> {
  return createConfiguredGovNotifyMailer([...MEMBERSHIP_MAIL_TEMPLATE_KEYS]);
}

/**
 * Best-effort membership status email, awaited by the originating callable.
 */
export async function notifyMembershipStatusEmailIfNeeded(args: {
  userId: string;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createMembershipStatusMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
  recoveryClaim?: NotificationRecoveryClaim;
}): Promise<void> {
  const kind = classifyMembershipStatusEmailTransition(args.previousStatus, args.newStatus);
  if (!kind) {
    return;
  }

  try {
    const row = await getUserMembershipStatus({ id: args.userId });
    const user = row.data?.user;
    if (!user?.email?.trim()) {
      logger.warn("membership status email skipped (user or email missing)", {
        userId: args.userId,
        kind,
      });
      return;
    }

    const email = user.email.trim().toLowerCase();
    const fn = user.firstName?.trim();
    const firstName = fn && fn.length > 0 ? fn : "Member";
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const appUrl = base;
    const membershipStatusLabel = membershipStatusCustomerLabel(args.newStatus);
    const mailer = (args.getMailer ?? createMembershipStatusMailer)();
    const reference = membershipStatusNotifyReference({
      kind,
      userId: args.userId,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
    });
    const deliveryKey = membershipStatusDeliveryKey({
      userId: args.userId,
      kind,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
    });
    const notificationType = kind === "activation" ? "MEMBERSHIP_ACTIVATED" : "MEMBERSHIP_ACCESS_RESTRICTED";

    await sendNotificationOnce({
      channel: NotificationChannel.EMAIL,
      notificationType,
      deliveryKey: args.recoveryClaim?.deliveryKey ?? deliveryKey,
      preserveDeliveryKey: Boolean(args.recoveryClaim),
      userId: args.userId,
      provider: GOV_NOTIFY_PROVIDER,
      deliveryMode: args.deliveryMode,
      recoveryClaim: args.recoveryClaim,
      recoveryPayload: {
        version: 1,
        kind: "MEMBERSHIP_STATUS",
        userId: args.userId,
        previousStatus: args.previousStatus,
        newStatus: args.newStatus,
      },
      send: async (deliveryMode) => {
        if (kind === "activation") {
          const personalisation: MembershipEmailTemplates["membershipActivated"] = {
            firstName,
            membershipStatusLabel,
            appUrl,
            profileUrl: `${base}/profile`,
          };
          const r = await mailer.sendEmail({
            templateName: "membershipActivated",
            to: email,
            personalisation,
            reference,
            requestedDeliveryMode: deliveryMode,
          });
          return {
            providerMessageId: r.providerNotificationId ?? null,
            deliveryMode: r.deliveryMode?.effectiveMode,
          };
        }
        const previousStatusLabel = args.previousStatus
          ? membershipStatusCustomerLabel(args.previousStatus)
          : "Unknown";
        const personalisation: MembershipEmailTemplates["membershipAccessRestricted"] = {
          firstName,
          membershipStatusLabel,
          previousStatusLabel,
          appUrl,
        };
        const r = await mailer.sendEmail({
          templateName: "membershipAccessRestricted",
          to: email,
          personalisation,
          reference,
          requestedDeliveryMode: deliveryMode,
        });
        return {
          providerMessageId: r.providerNotificationId ?? null,
          deliveryMode: r.deliveryMode?.effectiveMode,
        };
      },
    });
  } catch (error) {
    logger.error("membership status email failed", {
      userId: args.userId,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
      error: sanitizeMailerError(error),
    });
  }
}
