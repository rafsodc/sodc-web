import * as logger from "firebase-functions/logger";
import {
  getGuestTicketRequestForNotification,
  GuestTicketRequestStatus,
  NotificationChannel,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { createConfiguredGovNotifyMailer, GOV_NOTIFY_PROVIDER } from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import { normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";
import { resolveGuestTicketModeratorEmails } from "./guestTicketRequestModerators";

export const GUEST_TICKET_MAIL_TEMPLATE_KEYS = [
  "guestTicketRequestSubmittedModerator",
  "guestTicketRequestApproved",
  "guestTicketRequestRejected",
] as const;

export type GuestTicketEmailTemplates = {
  guestTicketRequestSubmittedModerator: {
    eventTitle: string;
    sectionName: string;
    bookerDisplay: string;
    guestDisplayName: string;
    requestedGuestCount: number;
    guestTicketTypeTitle: string;
    dietaryNote: string;
    moderationUrl: string;
  };
  guestTicketRequestApproved: {
    customerFirstName: string;
    eventTitle: string;
    guestDisplayName: string;
    requestedGuestCount: number;
    decisionLabel: string;
    moderatorNote: string;
    myBookingsUrl: string;
  };
  guestTicketRequestRejected: {
    customerFirstName: string;
    eventTitle: string;
    guestDisplayName: string;
    requestedGuestCount: number;
    decisionLabel: string;
    moderatorNote: string;
    myBookingsUrl: string;
  };
};

export function formatModeratorNote(note: string | null | undefined): string {
  const trimmed = note?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "—";
}

export function bookerDisplayName(firstName: string, lastName: string, email: string): string {
  const name = `${firstName} ${lastName}`.trim();
  return name.length > 0 ? `${name} <${email}>` : email;
}

export function guestTicketModeratorDeliveryKey(requestId: string, moderatorEmail: string): string {
  return `guest-request-mod:${requestId}:${moderatorEmail}`;
}

export function guestTicketBookerDeliveryKey(requestId: string, decision: "APPROVED" | "REJECTED"): string {
  return `guest-request-booker:${requestId}:${decision}`;
}

export function createGuestTicketRequestMailer(): ReturnType<
  typeof createConfiguredGovNotifyMailer<GuestTicketEmailTemplates>
> {
  return createConfiguredGovNotifyMailer([...GUEST_TICKET_MAIL_TEMPLATE_KEYS]);
}

export async function notifyModeratorsGuestTicketRequestSubmitted(args: {
  requestId: UUIDString;
  appBaseUrl: string;
  recipientEmails?: readonly string[];
  getMailer?: () => ReturnType<typeof createGuestTicketRequestMailer>;
}): Promise<void> {
  try {
    const row = await getGuestTicketRequestForNotification({ id: args.requestId });
    const request = row.data?.guestTicketRequest;
    if (!request?.booking) {
      logger.warn("guest ticket moderator alert skipped (request not found)", { requestId: args.requestId });
      return;
    }

    const section = request.booking.event.section;
    const booker = request.booking.booker;
    const recipients = args.recipientEmails
      ? Array.from(
          new Set(
            args.recipientEmails
              .map((email) => email.trim().toLowerCase())
              .filter((email) => email.length > 0)
          )
        )
      : await resolveGuestTicketModeratorEmails({
          sectionId: section.id,
          excludeUserId: booker.id,
        });
    if (recipients.length === 0) {
      logger.warn("guest ticket moderator alert skipped (no recipients)", {
        requestId: args.requestId,
        sectionId: section.id,
      });
      return;
    }

    const mailer = (args.getMailer ?? createGuestTicketRequestMailer)();
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const moderationUrl = `${base}/admin/sections`;
    const reference = `GUEST_REQUEST_SUBMITTED:${args.requestId}`;
    const bookerDisplay = bookerDisplayName(booker.firstName, booker.lastName, booker.email);

    const personalisation: GuestTicketEmailTemplates["guestTicketRequestSubmittedModerator"] = {
      eventTitle: request.booking.event.title ?? "—",
      sectionName: section.name ?? "—",
      bookerDisplay,
      guestDisplayName: request.guestDisplayName ?? "—",
      requestedGuestCount: request.requestedGuestCount,
      guestTicketTypeTitle: request.guestTicketType?.title ?? "—",
      dietaryNote: request.dietaryNote?.trim() || "—",
      moderationUrl,
    };

    for (const to of recipients) {
      const deliveryKey = guestTicketModeratorDeliveryKey(args.requestId, to);
      try {
        await sendNotificationOnce({
          channel: NotificationChannel.EMAIL,
          notificationType: "GUEST_REQUEST_SUBMITTED_MODERATOR",
          deliveryKey,
          bookingId: request.booking.id,
          userId: null,
          provider: GOV_NOTIFY_PROVIDER,
          recoveryPayload: {
            version: 1,
            kind: "GUEST_REQUEST_MODERATORS",
            requestId: args.requestId,
            recipientEmail: to,
          },
          send: async () => {
            const r = await mailer.sendEmail({
              templateName: "guestTicketRequestSubmittedModerator",
              to,
              personalisation,
              reference,
            });
            return { providerMessageId: r.providerNotificationId ?? null };
          },
        });
      } catch (error) {
        logger.error("guest ticket moderator alert delivery failed", {
          requestId: args.requestId,
          to,
          error: sanitizeMailerError(error),
        });
      }
    }
  } catch (error) {
    logger.error("guest ticket moderator alert failed", {
      requestId: args.requestId,
      error: sanitizeMailerError(error),
    });
  }
}

export async function notifyBookerGuestTicketRequestReviewed(args: {
  requestId: UUIDString;
  status: GuestTicketRequestStatus.APPROVED | GuestTicketRequestStatus.REJECTED;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createGuestTicketRequestMailer>;
}): Promise<void> {
  try {
    const row = await getGuestTicketRequestForNotification({ id: args.requestId });
    const request = row.data?.guestTicketRequest;
    if (!request?.booking) {
      logger.warn("guest ticket booker alert skipped (request not found)", { requestId: args.requestId });
      return;
    }

    const booker = request.booking.booker;
    const email = booker.email?.trim().toLowerCase();
    if (!email) {
      logger.warn("guest ticket booker alert skipped (no email)", { requestId: args.requestId });
      return;
    }

    const mailer = (args.getMailer ?? createGuestTicketRequestMailer)();
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const sectionId = request.booking.event.section.id;
    const myBookingsUrl = `${base}/sections/${sectionId}`;
    const fn = booker.firstName?.trim();
    const customerFirstName = fn && fn.length > 0 ? fn : "there";
    const decisionLabel = args.status === GuestTicketRequestStatus.APPROVED ? "Approved" : "Rejected";
    const notificationType =
      args.status === GuestTicketRequestStatus.APPROVED ? "GUEST_REQUEST_APPROVED" : "GUEST_REQUEST_REJECTED";
    const templateName =
      args.status === GuestTicketRequestStatus.APPROVED
        ? "guestTicketRequestApproved"
        : "guestTicketRequestRejected";
    const deliveryKey = guestTicketBookerDeliveryKey(
      args.requestId,
      args.status === GuestTicketRequestStatus.APPROVED ? "APPROVED" : "REJECTED"
    );
    const reference = `GUEST_REQUEST_${args.status}:${args.requestId}`;

    const personalisation = {
      customerFirstName,
      eventTitle: request.booking.event.title ?? "—",
      guestDisplayName: request.guestDisplayName ?? "—",
      requestedGuestCount: request.requestedGuestCount,
      decisionLabel,
      moderatorNote: formatModeratorNote(request.moderatorNote),
      myBookingsUrl,
    };

    await sendNotificationOnce({
      channel: NotificationChannel.EMAIL,
      notificationType,
      deliveryKey,
      bookingId: request.booking.id,
      userId: booker.id,
      provider: GOV_NOTIFY_PROVIDER,
      recoveryPayload: {
        version: 1,
        kind: "GUEST_REQUEST_BOOKER",
        requestId: args.requestId,
        status: args.status,
      },
      send: async () => {
        const r = await mailer.sendEmail({
          templateName,
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: r.providerNotificationId ?? null };
      },
    });
  } catch (error) {
    logger.error("guest ticket booker alert failed", {
      requestId: args.requestId,
      status: args.status,
      error: sanitizeMailerError(error),
    });
  }
}
