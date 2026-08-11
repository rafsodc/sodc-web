import * as logger from "firebase-functions/logger";
import {
  BookingPaymentAdjustmentStatus,
  getBookingForNotification,
  NotificationChannel,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  createConfiguredGovNotifyMailer,
  GOV_NOTIFY_PROVIDER,
  recipientScopedNotifyReference,
} from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import {
  formatMinorCurrency,
  formatTransactionalEventDateTime,
  normaliseAppBaseUrl,
} from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";
import type { BookingPaymentDelta } from "./bookingPaymentAdjustments";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";
import { resolveBookingModeratorEmails } from "./bookingModerators";

export const BOOKING_MAIL_TEMPLATE_KEYS = [
  "bookingConfirmation",
  "bookingRevision",
  "bookingPendingApproval",
  "bookingPendingApprovalModerator",
  "bookingApproved",
  "bookingChangesRequested",
] as const;

export type BookingEmailTemplates = {
  bookingConfirmation: BookingEmailPersonalisation;
  bookingRevision: BookingRevisionEmailPersonalisation;
  bookingPendingApproval: BookingEmailPersonalisation;
  bookingPendingApprovalModerator: BookingPendingApprovalModeratorPersonalisation;
  bookingApproved: BookingEmailPersonalisation;
  bookingChangesRequested: BookingChangesRequestedEmailPersonalisation;
};

type BookingLineRow = {
  sortOrder: number;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
  ticketType: { title: string; audience: string; price: number };
  guestUser?: { firstName: string; lastName: string } | null;
};

type BookingNotificationRow = {
  id: UUIDString;
  revisionNumber: number;
  approvalStatus: string;
  approvalNote?: string | null;
  sitNextToUserIds?: string[] | null;
  accommodationRequested: boolean;
  accommodationNote?: string | null;
  booker: { id: string; firstName: string; lastName: string; email: string };
  event: {
    id: UUIDString;
    title: string;
    location?: string | null;
    startDateTime: string;
    endDateTime: string;
    section: { id: UUIDString; name: string };
  };
  lines: BookingLineRow[];
  supersedesBooking?: { id: UUIDString; revisionNumber: number } | null;
};

export type BookingEmailPersonalisation = {
  firstName: string;
  eventTitle: string;
  eventDateTime: string;
  eventLocation: string;
  ticketLinesSummary: string;
  memberDietaryNote: string;
  // GOV.UK Notify optional-content condition -- must be the literal string
  // "yes"/"no", not a boolean, and its ((var??text)) text cannot itself
  // contain a placeholder, so the accommodation note isn't shown here.
  accommodationRequested: "yes" | "no";
  bookingTotalFormatted: string;
  sectionBookingsUrl: string;
  myPaymentsUrl: string;
};

export type BookingRevisionEmailPersonalisation = BookingEmailPersonalisation & {
  paymentAdjustmentStatus: string;
  previousTotalFormatted: string;
  revisedTotalFormatted: string;
  deltaAmountFormatted: string;
};

export type BookingChangesRequestedEmailPersonalisation = BookingEmailPersonalisation & {
  moderatorNote: string;
};

export type BookingPendingApprovalModeratorPersonalisation = {
  eventTitle: string;
  sectionName: string;
  bookerDisplay: string;
  guestCount: number;
  ticketLinesSummary: string;
  moderationUrl: string;
};

export function formatBookingEventDateTime(startDateTime: string, endDateTime: string): string {
  return formatTransactionalEventDateTime(startDateTime, endDateTime);
}

function linePriceMinor(price: number): number {
  return Math.round(price * 100);
}

export function bookingTotalMinorFromLines(lines: BookingLineRow[]): number {
  return lines.reduce((acc, line) => acc + linePriceMinor(line.ticketType.price), 0);
}

export function buildTicketLinesSummary(lines: BookingLineRow[]): string {
  if (lines.length === 0) {
    return "No tickets recorded";
  }
  return lines
    .map((line) => {
      const title = line.ticketType.title?.trim() || "Ticket";
      const guestName = line.guestDisplayName?.trim();
      const linkedGuest = line.guestUser
        ? `${line.guestUser.firstName} ${line.guestUser.lastName}`.trim()
        : "";
      const who = guestName || linkedGuest || (line.ticketType.audience === "GUEST" ? "Guest" : "Member");
      const dietary = line.dietaryNote?.trim();
      const dietaryPart = dietary ? `; dietary: ${dietary}` : "";
      return `• ${title} — ${who}${dietaryPart}`;
    })
    .join("\n");
}

/** GOV.UK Notify optional-content conditions must be the literal string "yes"/"no". */
export function accommodationRequestedCondition(requested: boolean): "yes" | "no" {
  return requested ? "yes" : "no";
}

export function paymentAdjustmentStatusLabel(status: BookingPaymentAdjustmentStatus): string {
  switch (status) {
    case BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE:
      return "Additional payment due";
    case BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND:
      return "Refund due";
    case BookingPaymentAdjustmentStatus.NOT_REQUIRED:
      return "No payment change required";
    case BookingPaymentAdjustmentStatus.SETTLED:
      return "Payment change completed";
    default:
      return String(status);
  }
}

export function formatSignedDeltaAmount(deltaAmountMinor: number): string {
  const abs = Math.abs(deltaAmountMinor);
  const formatted = formatMinorCurrency(abs, "GBP");
  if (deltaAmountMinor > 0) {
    return `+${formatted}`;
  }
  if (deltaAmountMinor < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

function buildBasePersonalisation(args: {
  booking: BookingNotificationRow;
  appBaseUrl: string;
}): BookingEmailPersonalisation {
  const { booking, appBaseUrl } = args;
  const base = normaliseAppBaseUrl(appBaseUrl);
  const fn = booking.booker.firstName?.trim();
  const totalMinor = bookingTotalMinorFromLines(booking.lines);
  const memberDietaryNote = booking.lines.find(
    (line) => line.ticketType.audience === "MEMBER"
  )?.dietaryNote;
  return {
    firstName: fn && fn.length > 0 ? fn : "Member",
    eventTitle: booking.event.title ?? "—",
    eventDateTime: formatBookingEventDateTime(booking.event.startDateTime, booking.event.endDateTime),
    eventLocation: booking.event.location?.trim() || "To be confirmed",
    ticketLinesSummary: buildTicketLinesSummary(booking.lines),
    memberDietaryNote: memberDietaryNote?.trim() || "None provided",
    accommodationRequested: accommodationRequestedCondition(booking.accommodationRequested),
    bookingTotalFormatted: formatMinorCurrency(totalMinor, "GBP"),
    sectionBookingsUrl: `${base}/sections/${booking.event.section.id}`,
    myPaymentsUrl: `${base}/payments`,
  };
}

export function bookingConfirmationDeliveryKey(bookingId: string, idempotencyKey: string): string {
  return `booking-confirm:${bookingId}:${idempotencyKey}`;
}

export function bookingRevisionDeliveryKey(bookingId: string, idempotencyKey: string): string {
  return `booking-revision:${bookingId}:${idempotencyKey}`;
}

export function bookingPendingMemberDeliveryKey(bookingId: string, idempotencyKey: string): string {
  return `booking-pending-member:${bookingId}:${idempotencyKey}`;
}

export function bookingPendingModeratorDeliveryKey(bookingId: string, moderatorEmail: string): string {
  return `booking-pending-mod:${bookingId}:${moderatorEmail.trim().toLowerCase()}`;
}

export function bookingChangesRequestedDeliveryKey(bookingId: string): string {
  return `booking-changes-requested:${bookingId}`;
}

export function bookingApprovedDeliveryKey(bookingId: string): string {
  return `booking-approved:${bookingId}`;
}

export function createBookingMailer(): ReturnType<typeof createConfiguredGovNotifyMailer<BookingEmailTemplates>> {
  return createConfiguredGovNotifyMailer([...BOOKING_MAIL_TEMPLATE_KEYS]);
}

async function loadBookingForEmail(bookingId: UUIDString): Promise<BookingNotificationRow | null> {
  const row = await getBookingForNotification({ bookingId });
  const booking = row.data?.booking;
  if (!booking) {
    return null;
  }
  return booking as BookingNotificationRow;
}

export async function notifyBookingConfirmationEmail(args: {
  bookingId: UUIDString;
  idempotencyKey: string;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createBookingMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
}): Promise<void> {
  try {
    const booking = await loadBookingForEmail(args.bookingId);
    if (!booking) {
      logger.warn("booking confirmation email skipped (booking not found)", { bookingId: args.bookingId });
      return;
    }
    const email = booking.booker.email?.trim().toLowerCase();
    if (!email) {
      logger.warn("booking confirmation email skipped (no booker email)", { bookingId: args.bookingId });
      return;
    }

    const mailer = (args.getMailer ?? createBookingMailer)();
    const personalisation = buildBasePersonalisation({ booking, appBaseUrl: args.appBaseUrl });
    const reference = `BOOKING_CONFIRMATION:${args.bookingId}:${args.idempotencyKey}`;
    const deliveryKey = bookingConfirmationDeliveryKey(args.bookingId, args.idempotencyKey);

    await sendNotificationOnce({
      channel: NotificationChannel.EMAIL,
      notificationType: "BOOKING_CONFIRMATION",
      deliveryKey,
      bookingId: args.bookingId,
      userId: booking.booker.id,
      provider: GOV_NOTIFY_PROVIDER,
      deliveryMode: args.deliveryMode,
      recoveryPayload: {
        version: 1,
        kind: "BOOKING_CONFIRMATION",
        bookingId: args.bookingId,
        idempotencyKey: args.idempotencyKey,
      },
      send: async (deliveryMode) => {
        const r = await mailer.sendEmail({
          templateName: "bookingConfirmation",
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
    logger.error("booking confirmation email failed", {
      bookingId: args.bookingId,
      error: sanitizeMailerError(error),
    });
  }
}

export async function notifyBookingRevisionEmail(args: {
  bookingId: UUIDString;
  idempotencyKey: string;
  appBaseUrl: string;
  paymentDelta: BookingPaymentDelta;
  getMailer?: () => ReturnType<typeof createBookingMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
}): Promise<void> {
  try {
    const booking = await loadBookingForEmail(args.bookingId);
    if (!booking) {
      logger.warn("booking revision email skipped (booking not found)", { bookingId: args.bookingId });
      return;
    }
    const email = booking.booker.email?.trim().toLowerCase();
    if (!email) {
      logger.warn("booking revision email skipped (no booker email)", { bookingId: args.bookingId });
      return;
    }

    const mailer = (args.getMailer ?? createBookingMailer)();
    const base = buildBasePersonalisation({ booking, appBaseUrl: args.appBaseUrl });
    const personalisation: BookingRevisionEmailPersonalisation = {
      ...base,
      paymentAdjustmentStatus: paymentAdjustmentStatusLabel(args.paymentDelta.status),
      previousTotalFormatted: formatMinorCurrency(args.paymentDelta.previousTotalMinor, "GBP"),
      revisedTotalFormatted: formatMinorCurrency(args.paymentDelta.revisedTotalMinor, "GBP"),
      deltaAmountFormatted: formatSignedDeltaAmount(args.paymentDelta.deltaAmountMinor),
    };
    const reference = `BOOKING_REVISION:${args.bookingId}:${args.idempotencyKey}`;
    const deliveryKey = bookingRevisionDeliveryKey(args.bookingId, args.idempotencyKey);

    await sendNotificationOnce({
      channel: NotificationChannel.EMAIL,
      notificationType: "BOOKING_REVISION",
      deliveryKey,
      bookingId: args.bookingId,
      userId: booking.booker.id,
      provider: GOV_NOTIFY_PROVIDER,
      deliveryMode: args.deliveryMode,
      recoveryPayload: {
        version: 1,
        kind: "BOOKING_REVISION",
        bookingId: args.bookingId,
        idempotencyKey: args.idempotencyKey,
        paymentDelta: args.paymentDelta,
      },
      send: async (deliveryMode) => {
        const r = await mailer.sendEmail({
          templateName: "bookingRevision",
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
    logger.error("booking revision email failed", {
      bookingId: args.bookingId,
      error: sanitizeMailerError(error),
    });
  }
}

export async function notifyBookingPendingApprovalEmails(args: {
  bookingId: UUIDString;
  idempotencyKey: string;
  appBaseUrl: string;
  recipientEmails?: readonly string[];
  notifyMember?: boolean;
  getMailer?: () => ReturnType<typeof createBookingMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
}): Promise<void> {
  try {
    const booking = await loadBookingForEmail(args.bookingId);
    if (!booking) {
      logger.warn("booking pending approval emails skipped (booking not found)", { bookingId: args.bookingId });
      return;
    }
    const mailer = (args.getMailer ?? createBookingMailer)();
    const personalisation = buildBasePersonalisation({ booking, appBaseUrl: args.appBaseUrl });
    const bookerEmail = booking.booker.email?.trim().toLowerCase();
    if (bookerEmail && args.notifyMember !== false) {
      try {
        await sendNotificationOnce({
          channel: NotificationChannel.EMAIL,
          notificationType: "BOOKING_PENDING_APPROVAL_MEMBER",
          deliveryKey: bookingPendingMemberDeliveryKey(args.bookingId, args.idempotencyKey),
          bookingId: args.bookingId,
          userId: booking.booker.id,
          provider: GOV_NOTIFY_PROVIDER,
          deliveryMode: args.deliveryMode,
          recoveryPayload: {
            version: 1,
            kind: "BOOKING_PENDING_MEMBER",
            bookingId: args.bookingId,
            idempotencyKey: args.idempotencyKey,
          },
          send: async (deliveryMode) => {
            const result = await mailer.sendEmail({
              templateName: "bookingPendingApproval",
              to: bookerEmail,
              personalisation,
              reference: `BOOKING_PENDING:${args.bookingId}`,
              requestedDeliveryMode: deliveryMode,
            });
            return {
              providerMessageId: result.providerNotificationId ?? null,
              deliveryMode: result.deliveryMode?.effectiveMode,
            };
          },
        });
      } catch (error) {
        logger.error("booking pending member email failed", {
          bookingId: args.bookingId,
          error: sanitizeMailerError(error),
        });
      }
    }

    const recipients = args.recipientEmails
      ? Array.from(new Set(args.recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)))
      : await resolveBookingModeratorEmails({
          sectionId: booking.event.section.id,
          excludeUserId: booking.booker.id,
        });
    const base = normaliseAppBaseUrl(args.appBaseUrl);
    const moderatorPersonalisation: BookingPendingApprovalModeratorPersonalisation = {
      eventTitle: booking.event.title,
      sectionName: booking.event.section.name,
      bookerDisplay: `${booking.booker.firstName} ${booking.booker.lastName} <${booking.booker.email}>`.trim(),
      guestCount: booking.lines.filter((line) => line.ticketType.audience === "GUEST").length,
      ticketLinesSummary: buildTicketLinesSummary(booking.lines),
      moderationUrl: `${base}/admin/sections`,
    };
    for (const recipientEmail of recipients) {
      try {
        await sendNotificationOnce({
          channel: NotificationChannel.EMAIL,
          notificationType: "BOOKING_PENDING_APPROVAL_MODERATOR",
          deliveryKey: bookingPendingModeratorDeliveryKey(args.bookingId, recipientEmail),
          bookingId: args.bookingId,
          userId: null,
          provider: GOV_NOTIFY_PROVIDER,
          deliveryMode: args.deliveryMode,
          recoveryPayload: {
            version: 1,
            kind: "BOOKING_PENDING_MODERATOR",
            bookingId: args.bookingId,
            recipientEmail,
          },
          send: async (deliveryMode) => {
            const result = await mailer.sendEmail({
              templateName: "bookingPendingApprovalModerator",
              to: recipientEmail,
              personalisation: moderatorPersonalisation,
              reference: recipientScopedNotifyReference(`BOOKING_PENDING_MODERATOR:${args.bookingId}`, recipientEmail),
              requestedDeliveryMode: deliveryMode,
            });
            return {
              providerMessageId: result.providerNotificationId ?? null,
              deliveryMode: result.deliveryMode?.effectiveMode,
            };
          },
        });
      } catch (error) {
        logger.error("booking pending moderator email failed", {
          bookingId: args.bookingId,
          recipientEmail,
          error: sanitizeMailerError(error),
        });
      }
    }
  } catch (error) {
    logger.error("booking pending approval emails failed", {
      bookingId: args.bookingId,
      error: sanitizeMailerError(error),
    });
  }
}

export async function notifyBookingChangesRequestedEmail(args: {
  bookingId: UUIDString;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createBookingMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
}): Promise<void> {
  try {
    const booking = await loadBookingForEmail(args.bookingId);
    if (!booking) return;
    const email = booking.booker.email?.trim().toLowerCase();
    if (!email) return;
    const mailer = (args.getMailer ?? createBookingMailer)();
    const personalisation: BookingChangesRequestedEmailPersonalisation = {
      ...buildBasePersonalisation({ booking, appBaseUrl: args.appBaseUrl }),
      moderatorNote: booking.approvalNote?.trim() || "No additional note",
    };
    await sendNotificationOnce({
      channel: NotificationChannel.EMAIL,
      notificationType: "BOOKING_CHANGES_REQUESTED",
      deliveryKey: bookingChangesRequestedDeliveryKey(args.bookingId),
      bookingId: args.bookingId,
      userId: booking.booker.id,
      provider: GOV_NOTIFY_PROVIDER,
      deliveryMode: args.deliveryMode,
      recoveryPayload: { version: 1, kind: "BOOKING_CHANGES_REQUESTED", bookingId: args.bookingId },
      send: async (deliveryMode) => {
        const result = await mailer.sendEmail({
          templateName: "bookingChangesRequested",
          to: email,
          personalisation,
          reference: `BOOKING_CHANGES_REQUESTED:${args.bookingId}`,
          requestedDeliveryMode: deliveryMode,
        });
        return {
          providerMessageId: result.providerNotificationId ?? null,
          deliveryMode: result.deliveryMode?.effectiveMode,
        };
      },
    });
  } catch (error) {
    logger.error("booking changes requested email failed", {
      bookingId: args.bookingId,
      error: sanitizeMailerError(error),
    });
  }
}

export async function notifyBookingApprovedEmail(args: {
  bookingId: UUIDString;
  appBaseUrl: string;
  getMailer?: () => ReturnType<typeof createBookingMailer>;
  deliveryMode?: GovNotifyDeliveryMode;
}): Promise<void> {
  try {
    const booking = await loadBookingForEmail(args.bookingId);
    if (!booking) return;
    const email = booking.booker.email?.trim().toLowerCase();
    if (!email) return;
    const mailer = (args.getMailer ?? createBookingMailer)();
    await sendNotificationOnce({
      channel: NotificationChannel.EMAIL,
      notificationType: "BOOKING_APPROVED",
      deliveryKey: bookingApprovedDeliveryKey(args.bookingId),
      bookingId: args.bookingId,
      userId: booking.booker.id,
      provider: GOV_NOTIFY_PROVIDER,
      deliveryMode: args.deliveryMode,
      recoveryPayload: { version: 1, kind: "BOOKING_APPROVED", bookingId: args.bookingId },
      send: async (deliveryMode) => {
        const result = await mailer.sendEmail({
          templateName: "bookingApproved",
          to: email,
          personalisation: buildBasePersonalisation({ booking, appBaseUrl: args.appBaseUrl }),
          reference: `BOOKING_APPROVED:${args.bookingId}`,
          requestedDeliveryMode: deliveryMode,
        });
        return {
          providerMessageId: result.providerNotificationId ?? null,
          deliveryMode: result.deliveryMode?.effectiveMode,
        };
      },
    });
  } catch (error) {
    logger.error("booking approved email failed", {
      bookingId: args.bookingId,
      error: sanitizeMailerError(error),
    });
  }
}
