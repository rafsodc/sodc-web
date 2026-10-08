import * as db from "@dataconnect/admin-generated";
import * as logger from "firebase-functions/logger";
import { createBookingMailer } from "./bookingEmailDispatcher";
import { guestFinancialPosition } from "./organiserGuestFinancialPosition";
import { formatMinorCurrency } from "./paymentLifecycleEmailDispatcher";
import { GOV_NOTIFY_PROVIDER } from "./mailer";
import { sendNotificationOnce } from "./notificationDelivery";
import type { GovNotifyDeliveryMode } from "./govNotifyDeliveryMode";

export interface GuestAmendmentEmailSnapshot {
  recipientEmail: string | null;
  firstName: string;
  eventTitle: string;
  eventDateTime: string;
  eventLocation: string;
  previousTicket: string;
  updatedTicket: string;
  previousTotalMinor: number;
  revisedTotalMinor: number;
  refundDueMinor: number;
  refundedBeforeMinor: number;
  guestLink: string;
}

export const guestAmendmentDeliveryKey = (amendmentId: string) => `organiser-guest-amendment:${amendmentId}`;

export async function notifyOrganiserGuestAmendment(args: {
  amendmentId: string;
  deliveryMode?: GovNotifyDeliveryMode;
  getMailer?: typeof createBookingMailer;
}) {
  const amendment = (await db.getOrganiserGuestAmendment({ id: args.amendmentId })).data.organiserGuestAmendment;
  if (!amendment) throw new Error("Guest amendment notification record is missing");
  if (amendment.notificationStatus === "SENT") return { outcome: "duplicate" as const };
  const snapshot = JSON.parse(amendment.payload) as GuestAmendmentEmailSnapshot;
  if (!snapshot.recipientEmail) {
    await db.setOrganiserGuestAmendmentNotificationStatus({ id: amendment.id, status: "NOT_REQUIRED" });
    return { outcome: "no_email" as const };
  }
  const guest = (await db.getOrganiserGuest({ id: amendment.guestId })).data.organiserGuests[0];
  if (!guest) throw new Error("Guest amendment recipient is missing");
  const position = guestFinancialPosition(guest);
  const due = guest.cancelledAt ? 0 : position.paymentRequiredMinor;
  const money = (minor: number) => formatMinorCurrency(minor, "GBP");
  const refundSummary = snapshot.refundDueMinor <= 0 ? "" :
    position.refundedAmountMinor - snapshot.refundedBeforeMinor >= snapshot.refundDueMinor
      ? `A refund of ${money(snapshot.refundDueMinor)} has been completed.`
      : position.refundFailureReason
        ? "The refund needs organiser attention and can be retried. Check your ticket for the latest status."
        : position.refundPendingMinor > 0
          ? "Your refund is being processed. It has not yet been confirmed as completed."
          : `A refund of ${money(snapshot.refundDueMinor)} is due. Check your ticket for the latest status.`;
  // Replacing a guest link revokes amendment links too. Recovery must not revive
  // a revoked capability, or include it in a later notification.
  const guestLink = amendment.tokenHash ? snapshot.guestLink : "Please use the latest personal link from your organiser.";
  const result = await sendNotificationOnce({
    channel: db.NotificationChannel.EMAIL,
    notificationType: "ORGANISER_GUEST_AMENDMENT",
    deliveryKey: guestAmendmentDeliveryKey(amendment.id),
    provider: GOV_NOTIFY_PROVIDER,
    deliveryMode: args.deliveryMode,
    recoveryPayload: { version: 1, kind: "ORGANISER_GUEST_AMENDMENT", amendmentId: amendment.id },
    send: async (deliveryMode) => {
      const mailer = (args.getMailer ?? createBookingMailer)();
      const sent = await mailer.sendEmail({
        templateName: "bookingRevision",
        to: snapshot.recipientEmail!,
        reference: guestAmendmentDeliveryKey(amendment.id),
        requestedDeliveryMode: deliveryMode,
        personalisation: {
          firstName: snapshot.firstName,
          eventTitle: snapshot.eventTitle,
          eventDateTime: snapshot.eventDateTime,
          eventLocation: snapshot.eventLocation,
          ticketLinesSummary: `Previous: ${snapshot.previousTicket}\nUpdated: ${snapshot.updatedTicket}`,
          accommodationRequested: "no",
          bookingTotalFormatted: money(snapshot.revisedTotalMinor),
          previousTotalFormatted: money(snapshot.previousTotalMinor),
          revisedTotalFormatted: money(snapshot.revisedTotalMinor),
          paymentRemainingFormatted: money(due),
          financialEffectSummary: [
            due > 0 ? `Payment required—please pay as soon as possible. Amount due: ${money(due)}.` : "No further payment is required.",
            refundSummary,
          ].filter(Boolean).join(" "),
          sectionBookingsUrl: guestLink,
          myPaymentsUrl: guestLink,
        },
      });
      return { providerMessageId: sent.providerNotificationId ?? null, deliveryMode: sent.deliveryMode?.effectiveMode };
    },
  });
  if (result.outcome !== "duplicate" || result.reason === "already_sent") {
    await db.setOrganiserGuestAmendmentNotificationStatus({ id: amendment.id, status: result.outcome === "failed" ? "FAILED" : "SENT" });
  }
  return result;
}

/** Covers a crash after the atomic amendment save but before the delivery ledger exists. */
export async function recoverPendingGuestAmendmentNotifications(before: string, limit: number) {
  const result = await db.listPendingOrganiserGuestAmendments({ before, limit });
  for (const amendment of result.data.organiserGuestAmendments) {
    try {
      await notifyOrganiserGuestAmendment({ amendmentId: amendment.id });
    } catch {
      logger.error("Guest amendment notification recovery failed", { amendmentId: amendment.id });
    }
  }
}
