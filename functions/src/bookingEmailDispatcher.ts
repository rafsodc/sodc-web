import * as logger from "firebase-functions/logger";
import {
  BookingPaymentAdjustmentStatus,
  getBookingForNotification,
  NotificationChannel,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { createConfiguredGovNotifyMailer, GOV_NOTIFY_PROVIDER } from "./mailer";
import { sanitizeMailerError } from "./mailerErrors";
import { formatMinorCurrency, normaliseAppBaseUrl } from "./paymentLifecycleEmailDispatcher";
import { sendNotificationOnce } from "./notificationDelivery";
import type { BookingPaymentDelta } from "./bookingPaymentAdjustments";

export const BOOKING_MAIL_TEMPLATE_KEYS = ["bookingConfirmation", "bookingRevision"] as const;

export type BookingEmailTemplates = {
  bookingConfirmation: BookingEmailPersonalisation;
  bookingRevision: BookingRevisionEmailPersonalisation;
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
  bookerDietaryNote?: string | null;
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
  customerFirstName: string;
  eventTitle: string;
  eventDateTime: string;
  eventLocation: string;
  revisionNumber: number;
  ticketLinesSummary: string;
  bookerDietaryNote: string;
  accommodationSummary: string;
  bookingTotalFormatted: string;
  sectionBookingsUrl: string;
  myPaymentsUrl: string;
};

export type BookingRevisionEmailPersonalisation = BookingEmailPersonalisation & {
  previousRevisionNumber: number;
  revisedRevisionNumber: number;
  paymentAdjustmentStatus: string;
  previousTotalFormatted: string;
  revisedTotalFormatted: string;
  deltaAmountFormatted: string;
};

export function formatBookingEventDateTime(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDateTime} – ${endDateTime}`;
  }
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${dateFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  }
  return `${dateFmt.format(start)} ${timeFmt.format(start)} – ${dateFmt.format(end)} ${timeFmt.format(end)}`;
}

function linePriceMinor(price: number): number {
  return Math.round(price * 100);
}

export function bookingTotalMinorFromLines(lines: BookingLineRow[]): number {
  return lines.reduce((acc, line) => acc + linePriceMinor(line.ticketType.price), 0);
}

export function buildTicketLinesSummary(lines: BookingLineRow[]): string {
  if (lines.length === 0) {
    return "—";
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

export function buildAccommodationSummary(requested: boolean, note: string | null | undefined): string {
  if (!requested) {
    return "Not requested";
  }
  const trimmed = note?.trim();
  return trimmed && trimmed.length > 0 ? `Requested — ${trimmed}` : "Requested";
}

export function paymentAdjustmentStatusLabel(status: BookingPaymentAdjustmentStatus): string {
  switch (status) {
    case BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE:
      return "Additional payment due";
    case BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND:
      return "Refund due";
    case BookingPaymentAdjustmentStatus.NOT_REQUIRED:
      return "No payment change required";
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
  return {
    customerFirstName: fn && fn.length > 0 ? fn : "there",
    eventTitle: booking.event.title ?? "—",
    eventDateTime: formatBookingEventDateTime(booking.event.startDateTime, booking.event.endDateTime),
    eventLocation: booking.event.location?.trim() || "—",
    revisionNumber: booking.revisionNumber,
    ticketLinesSummary: buildTicketLinesSummary(booking.lines),
    bookerDietaryNote: booking.bookerDietaryNote?.trim() || "—",
    accommodationSummary: buildAccommodationSummary(
      booking.accommodationRequested,
      booking.accommodationNote
    ),
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
      recoveryPayload: {
        version: 1,
        kind: "BOOKING_CONFIRMATION",
        bookingId: args.bookingId,
        idempotencyKey: args.idempotencyKey,
      },
      send: async () => {
        const r = await mailer.sendEmail({
          templateName: "bookingConfirmation",
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: r.providerNotificationId ?? null };
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

    const previousRevisionNumber = booking.supersedesBooking?.revisionNumber ?? booking.revisionNumber - 1;
    const mailer = (args.getMailer ?? createBookingMailer)();
    const base = buildBasePersonalisation({ booking, appBaseUrl: args.appBaseUrl });
    const personalisation: BookingRevisionEmailPersonalisation = {
      ...base,
      previousRevisionNumber,
      revisedRevisionNumber: booking.revisionNumber,
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
      recoveryPayload: {
        version: 1,
        kind: "BOOKING_REVISION",
        bookingId: args.bookingId,
        idempotencyKey: args.idempotencyKey,
        paymentDelta: args.paymentDelta,
      },
      send: async () => {
        const r = await mailer.sendEmail({
          templateName: "bookingRevision",
          to: email,
          personalisation,
          reference,
        });
        return { providerMessageId: r.providerNotificationId ?? null };
      },
    });
  } catch (error) {
    logger.error("booking revision email failed", {
      bookingId: args.bookingId,
      error: sanitizeMailerError(error),
    });
  }
}
