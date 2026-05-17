import * as logger from "firebase-functions/logger";
import { getUserMembershipStatus, NotificationChannel } from "@dataconnect/admin-generated";
import { createConfiguredGovNotifyMailer, GOV_NOTIFY_PROVIDER } from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import { normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";
import {
  isNonRestrictedStatus,
  isRestrictedStatus,
  type MembershipStatus,
} from "./validation";

export const MEMBERSHIP_MAIL_TEMPLATE_KEYS = ["membershipActivated", "membershipAccessRestricted"] as const;

export type MembershipEmailTemplates = {
  membershipActivated: {
    customerFirstName: string;
    membershipStatusLabel: string;
    appUrl: string;
    profileUrl: string;
  };
  membershipAccessRestricted: {
    customerFirstName: string;
    membershipStatusLabel: string;
    previousStatusLabel: string;
    appUrl: string;
  };
};

export type MembershipStatusEmailKind = "activation" | "restricted";

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

/**
 * Determines whether a successful status update should trigger a user-facing email.
 */
export function classifyMembershipStatusEmailTransition(
  previousStatus: MembershipStatus | null,
  newStatus: MembershipStatus
): MembershipStatusEmailKind | null {
  if (previousStatus === newStatus) {
    return null;
  }
  const wasRestricted = previousStatus === null || isRestrictedStatus(previousStatus);
  const wasNonRestricted = previousStatus !== null && isNonRestrictedStatus(previousStatus);

  if (wasRestricted && isNonRestrictedStatus(newStatus)) {
    return "activation";
  }
  if (wasNonRestricted && isRestrictedStatus(newStatus)) {
    return "restricted";
  }
  return null;
}

export function membershipStatusDeliveryKey(args: {
  userId: string;
  kind: MembershipStatusEmailKind;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
}): string {
  const from = args.previousStatus ?? "UNKNOWN";
  return `membership-${args.kind}:${args.userId}:${from}:${args.newStatus}`;
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
 * Non-blocking membership status emails after a successful callable update.
 */
export async function notifyMembershipStatusEmailIfNeeded(args: {
  userId: string;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createMembershipStatusMailer>;
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
    const customerFirstName = fn && fn.length > 0 ? fn : "there";
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
      deliveryKey,
      userId: args.userId,
      provider: GOV_NOTIFY_PROVIDER,
      send: async () => {
        if (kind === "activation") {
          const personalisation: MembershipEmailTemplates["membershipActivated"] = {
            customerFirstName,
            membershipStatusLabel,
            appUrl,
            profileUrl: `${base}/profile`,
          };
          const r = await mailer.sendEmail({
            templateName: "membershipActivated",
            to: email,
            personalisation,
            reference,
          });
          return { providerMessageId: r.providerNotificationId ?? null };
        }
        const previousStatusLabel = args.previousStatus
          ? membershipStatusCustomerLabel(args.previousStatus)
          : "Unknown";
        const personalisation: MembershipEmailTemplates["membershipAccessRestricted"] = {
          customerFirstName,
          membershipStatusLabel,
          previousStatusLabel,
          appUrl,
        };
        const r = await mailer.sendEmail({
          templateName: "membershipAccessRestricted",
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: r.providerNotificationId ?? null };
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
