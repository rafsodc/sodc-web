import { createHash, randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  BookingApprovalStatus,
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketAudience,
  getBookingRevisionForApprovalFromCallable,
  getBookingsForBookerAndEvent,
  getEventByIdForCallable,
  getTicketOrdersForBookerAndEvent,
  markTicketOrderFailedFromWebhook,
  settleBookingPaymentAdjustmentsFromCallable,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { govNotifySecrets } from "./mailer";
import { stripeSecret, requireStripe } from "./paymentConfig";
import { requireEnabled, validateUUID, MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from "./helpers";
import { requireSectionModerator } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";
import { bookingIdsEqual, planBookingAllocationRefunds } from "./bookingCheckout";
import { hydrateBookingsWithTicketOrders } from "./bookingQueryHydration";
import {
  MAX_ATOMIC_BOOKING_LINES,
  persistActiveBookingRevision,
  planBookingPlaces,
  type ExistingSubmissionLine,
  type SubmissionLine,
} from "./bookingSubmissionPersistence";
import { computeBookingPaymentDelta, type BookingPaymentDelta } from "./bookingPaymentAdjustments";
import { initiateBookingAllocationRefunds, type BookingRefundResult } from "./bookingRefundOrchestration";
import { notifyBookingRevisionEmail } from "./bookingEmailDispatcher";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

interface AmendmentLineInput {
  ticketTypeId: UUIDString;
  sortOrder: number;
  guestUserId: string | null;
  guestDisplayName: string | null;
  dietaryNote: string | null;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new HttpsError("invalid-argument", `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} must be no more than ${maxLength} characters`);
  }
  return trimmed || null;
}

export function parseOrganiserAmendmentLines(raw: unknown): AmendmentLineInput[] {
  if (!Array.isArray(raw)) throw new HttpsError("invalid-argument", "lines must be an array");
  if (raw.length > MAX_ATOMIC_BOOKING_LINES) {
    throw new HttpsError("invalid-argument", `lines must contain no more than ${MAX_ATOMIC_BOOKING_LINES} tickets`);
  }
  return raw.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new HttpsError("invalid-argument", `lines[${index}] must be an object`);
    }
    const line = value as Record<string, unknown>;
    const sortOrder = Number(line.sortOrder);
    if (!Number.isInteger(sortOrder)) {
      throw new HttpsError("invalid-argument", `lines[${index}].sortOrder must be an integer`);
    }
    return {
      ticketTypeId: validateUUID(String(line.ticketTypeId), `lines[${index}].ticketTypeId`) as UUIDString,
      sortOrder,
      guestUserId: optionalText(line.guestUserId, `lines[${index}].guestUserId`, 128),
      guestDisplayName: optionalText(line.guestDisplayName, `lines[${index}].guestDisplayName`, MAX_NAME_LENGTH),
      dietaryNote: optionalText(line.dietaryNote, `lines[${index}].dietaryNote`, MAX_DESCRIPTION_LENGTH),
    };
  });
}

function previewToken(args: {
  bookingId: string;
  revisionNumber: number;
  lines: SubmissionLine[];
  paymentDelta: BookingPaymentDelta;
}): string {
  return createHash("sha256").update(JSON.stringify({
    bookingId: args.bookingId.replace(/-/g, "").toLowerCase(),
    revisionNumber: args.revisionNumber,
    lines: [...args.lines].sort((a, b) => a.sortOrder - b.sortOrder).map((line) => ({
      ticketTypeId: line.ticketTypeId.replace(/-/g, "").toLowerCase(),
      audience: line.audience,
      priceMinor: line.priceMinor,
      sortOrder: line.sortOrder,
      guestUserId: line.guestUserId ?? null,
      guestDisplayName: line.guestDisplayName ?? null,
      dietaryNote: line.dietaryNote ?? null,
    })),
    paymentDelta: args.paymentDelta,
  })).digest("hex");
}

function publicPreview(delta: BookingPaymentDelta) {
  return {
    previousTotalMinor: delta.previousTotalMinor,
    revisedTotalMinor: delta.revisedTotalMinor,
    paidAfterCompletedAndPendingRefundsMinor: delta.settledAmountMinor,
    completedRefundsMinor: delta.refundedAmountMinor,
    pendingRefundsMinor: delta.pendingRefundAmountMinor,
    refundToInitiateMinor: delta.refundDueMinor,
    paymentRequiredMinor: delta.paymentRemainingMinor,
    status: delta.status,
  };
}

function normalizedId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export const amendEventBookingAsOrganiser = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret, ...govNotifySecrets] },
  async (request) => {
    requireEnabled(request);
    const callerUid = request.auth!.uid;
    await enforceRateLimit("amendEventBookingAsOrganiser", callerUid);
    const bookingId = validateUUID(String(request.data?.bookingId), "bookingId") as UUIDString;
    const expectedRevisionNumber = Number(request.data?.expectedRevisionNumber);
    if (!Number.isInteger(expectedRevisionNumber) || expectedRevisionNumber < 1) {
      throw new HttpsError("invalid-argument", "expectedRevisionNumber must be a positive integer");
    }
    const idempotencyKey = validateUUID(String(request.data?.idempotencyKey), "idempotencyKey") as UUIDString;
    const requestedLines = parseOrganiserAmendmentLines(request.data?.lines);
    const confirm = request.data?.confirm === true;

    const targetResult = await getBookingRevisionForApprovalFromCallable({ id: bookingId });
    const target = targetResult.data?.booking;
    if (!target) throw new HttpsError("not-found", "Booking not found");
    await requireSectionModerator(target.event.section.id, callerUid, request.auth!.token?.admin === true);

    const [eventResult, bookingsResult] = await Promise.all([
      getEventByIdForCallable({ id: target.event.id as UUIDString }),
      getBookingsForBookerAndEvent({ bookerId: target.booker.id, eventId: target.event.id as UUIDString }),
    ]);
    const event = eventResult.data?.event;
    if (!event) throw new HttpsError("not-found", "Event not found");
    const allBookings = hydrateBookingsWithTicketOrders(bookingsResult.data);
    const group = allBookings.filter((row) => bookingIdsEqual(row.revisionGroupId, target.revisionGroupId));
    const replay = group.find((row) => row.clientSubmissionKey === idempotencyKey);
    if (replay && confirm) {
      const replayPrevious = replay.supersedesBooking
        ? group.find((row) => bookingIdsEqual(row.id, replay.supersedesBooking!.id))
        : undefined;
      const replayDelta = computeBookingPaymentDelta(replayPrevious, replay, {
        financialHistory: group,
        includeUnpaidBalance: true,
      });
      let replayRefund: BookingRefundResult | null = null;
      if (planBookingAllocationRefunds(replay, group).length > 0) {
        replayRefund = await initiateBookingAllocationRefunds({
          booking: replay,
          financialHistory: group,
          stripeClient: requireStripe(stripeSecret.value()),
        });
        if (replayRefund.failedAmountMinor === 0 && replayRefund.pendingAmountMinor === 0) {
          await settleBookingPaymentAdjustmentsFromCallable({
            revisionBookingId: replay.id as UUIDString,
            status: BookingPaymentAdjustmentStatus.SETTLED,
          });
        } else if (replayRefund.failedAmountMinor > 0) {
          await settleBookingPaymentAdjustmentsFromCallable({
            revisionBookingId: replay.id as UUIDString,
            status: BookingPaymentAdjustmentStatus.REFUND_FAILED,
          });
        }
      }
      await notifyBookingRevisionEmail({
        bookingId: replay.id as UUIDString,
        idempotencyKey,
        appBaseUrl: APP_BASE_URL,
        paymentDelta: replayDelta,
        refundOutcome: replayRefund,
      });
      return {
        applied: true,
        idempotentReplay: true,
        bookingId: replay.id,
        revisionNumber: replay.revisionNumber,
        status: replay.status,
        preview: publicPreview(replayDelta),
        refund: replayRefund,
      };
    }
    const active = group.find((row) => bookingIdsEqual(row.id, target.id));
    const unsuperseded = group.filter((row) => row.supersededAt == null);
    if (
      !active ||
      active.revisionNumber !== expectedRevisionNumber ||
      active.supersededAt != null ||
      (active.status !== BookingStatus.SUBMITTED && active.status !== BookingStatus.CONFIRMED) ||
      unsuperseded.some((row) => !bookingIdsEqual(row.id, active.id))
    ) {
      throw new HttpsError("aborted", "This booking changed while it was being amended. Refresh and review it again.", {
        code: "BOOKING_REVISION_CONFLICT",
      });
    }

    const ticketTypes = new Map((event.ticketTypes ?? [])
      .filter((ticketType) => ticketType.audience !== TicketAudience.ORGANISER_GUEST)
      .map((ticketType) => [validateUUID(ticketType.id), ticketType]));
    const submissionLines: SubmissionLine[] = requestedLines.map((line) => {
      const ticketType = ticketTypes.get(line.ticketTypeId);
      if (!ticketType) throw new HttpsError("failed-precondition", "A selected ticket type is no longer available for this event");
      if (ticketType.audience === TicketAudience.GUEST && !line.guestUserId && !line.guestDisplayName) {
        throw new HttpsError("invalid-argument", "Guest tickets require a guest name or linked member");
      }
      return {
        ...line,
        audience: ticketType.audience,
        priceMinor: Math.round(ticketType.price * 100),
      };
    });
    if (submissionLines.filter((line) => line.audience === TicketAudience.MEMBER).length > 1) {
      throw new HttpsError("invalid-argument", "A booking can contain at most one member ticket");
    }
    const previousLines: ExistingSubmissionLine[] = active.lines.map((line) => ({
      ticketTypeId: validateUUID(line.ticketType.id) as UUIDString,
      audience: line.ticketType.audience,
      priceMinor: line.priceMinor ?? Math.round(line.ticketType.price * 100),
      sortOrder: line.sortOrder,
      guestUserId: line.guestUser?.id ?? null,
      guestDisplayName: line.guestDisplayName ?? null,
      dietaryNote: line.dietaryNote ?? null,
      bookingPlaceId: validateUUID(line.bookingPlace.id) as UUIDString,
      paymentAllocationStatuses: line.bookingPlace.paymentAllocations.map((allocation) => allocation.ticketOrder.status),
    }));
    const placePlan = planBookingPlaces({ lines: submissionLines, previousLines });
    const revisedSnapshot = {
      lines: placePlan.lines.map((line) => ({
        priceMinor: line.priceMinor,
        ticketType: { price: line.priceMinor / 100 },
      })),
    };
    const paymentDelta = computeBookingPaymentDelta(active, revisedSnapshot, {
      financialHistory: group,
      includeUnpaidBalance: true,
    });
    const token = previewToken({
      bookingId: active.id,
      revisionNumber: active.revisionNumber,
      lines: placePlan.lines,
      paymentDelta,
    });
    if (!confirm) {
      return {
        applied: false,
        previewToken: token,
        preview: publicPreview(paymentDelta),
        lines: placePlan.lines.map((line) => ({
          ticketTypeId: line.ticketTypeId,
          priceMinor: line.priceMinor,
          sortOrder: line.sortOrder,
        })),
      };
    }
    if (request.data?.previewToken !== token) {
      throw new HttpsError("aborted", "Ticket prices or booking payments changed. Review the updated financial effect before confirming.", {
        code: "BOOKING_AMENDMENT_PREVIEW_CHANGED",
      });
    }

    // A checkout created for the old revision must not remain payable after
    // the amendment. Expire it before changing capacity; if Stripe already
    // completed it, force a fresh preview so the new settlement is included.
    const pendingOrdersResult = await getTicketOrdersForBookerAndEvent({
      userId: target.booker.id,
      eventId: target.event.id as UUIDString,
    });
    const revisionGroupPlaceIds = new Set(
      group.flatMap((booking) => booking.lines.map((line) => normalizedId(line.bookingPlace.id)))
    );
    const pendingOrders = (pendingOrdersResult.data?.user?.ticketOrders ?? []).filter(
      (order) =>
        order.status === "PENDING" &&
        order.paymentAllocations.some((allocation) =>
          revisionGroupPlaceIds.has(normalizedId(allocation.bookingPlace.id))
        )
    );
    if (pendingOrders.length > 0) {
      const stripeClient = requireStripe(stripeSecret.value());
      for (const order of pendingOrders) {
        if (order.stripeCheckoutSessionId) {
          const session = await stripeClient.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
          if (session.status === "complete") {
            throw new HttpsError("aborted", "A payment completed while this booking was being amended. Refresh and review the financial effect again.", {
              code: "BOOKING_AMENDMENT_PAYMENT_CHANGED",
            });
          }
          if (session.status === "open") await stripeClient.checkout.sessions.expire(session.id);
        }
        await markTicketOrderFailedFromWebhook({
          id: order.id as UUIDString,
          webhookEventId: `amendment-supersede:${idempotencyKey}:${order.id}`,
        });
      }
    }

    const revisedBookingId = randomUUID() as UUIDString;
    const revisedStatus = placePlan.lines.length === 0
      ? BookingStatus.CANCELLED
      : paymentDelta.paymentRemainingMinor === 0 && active.status === BookingStatus.CONFIRMED
        ? BookingStatus.CONFIRMED
        : BookingStatus.SUBMITTED;
    await persistActiveBookingRevision({
      input: {
        bookingId: revisedBookingId,
        eventId: target.event.id as UUIDString,
        bookerId: target.booker.id,
        idempotencyKey,
        revisionGroupId: active.revisionGroupId as UUIDString,
        revisionNumber: active.revisionNumber + 1,
        supersedesBookingId: active.id as UUIDString,
        approvalStatus: BookingApprovalStatus.APPROVED,
        sitNextToUserIds: active.sitNextToUserIds ?? [],
        accommodationRequested: active.accommodationRequested,
        accommodationNote: active.accommodationNote,
        placePlan,
        status: revisedStatus,
        actorId: callerUid,
      },
      activeBookingId: active.id as UUIDString,
      deltaAmountMinor: paymentDelta.deltaAmountMinor,
      adjustmentStatus: paymentDelta.status,
    });

    let refundResult: BookingRefundResult | null = null;
    if (paymentDelta.refundDueMinor > 0) {
      const refreshed = await getBookingsForBookerAndEvent({
        bookerId: target.booker.id,
        eventId: target.event.id as UUIDString,
      });
      const refreshedBookings = hydrateBookingsWithTicketOrders(refreshed.data);
      const revised = refreshedBookings.find((row) => bookingIdsEqual(row.id, revisedBookingId));
      if (!revised) throw new HttpsError("internal", "The amended booking could not be reloaded for refund processing");
      refundResult = await initiateBookingAllocationRefunds({
        booking: revised,
        financialHistory: refreshedBookings.filter((row) => bookingIdsEqual(row.revisionGroupId, revised.revisionGroupId)),
        stripeClient: requireStripe(stripeSecret.value()),
      });
      if (refundResult.failedAmountMinor === 0 && refundResult.pendingAmountMinor === 0) {
        await settleBookingPaymentAdjustmentsFromCallable({
          revisionBookingId: revisedBookingId,
          status: BookingPaymentAdjustmentStatus.SETTLED,
        });
      } else if (refundResult.failedAmountMinor > 0) {
        await settleBookingPaymentAdjustmentsFromCallable({
          revisionBookingId: revisedBookingId,
          status: BookingPaymentAdjustmentStatus.REFUND_FAILED,
        });
      }
    }

    await notifyBookingRevisionEmail({
      bookingId: revisedBookingId,
      idempotencyKey,
      appBaseUrl: APP_BASE_URL,
      paymentDelta,
      refundOutcome: refundResult,
    });
    return {
      applied: true,
      idempotentReplay: false,
      bookingId: revisedBookingId,
      revisionNumber: active.revisionNumber + 1,
      status: revisedStatus,
      preview: publicPreview(paymentDelta),
      refund: refundResult,
    };
  }
);

export const retryOrganiserBookingRefund = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    requireEnabled(request);
    const callerUid = request.auth!.uid;
    await enforceRateLimit("amendEventBookingAsOrganiser", callerUid);
    const bookingId = validateUUID(String(request.data?.bookingId), "bookingId") as UUIDString;
    const targetResult = await getBookingRevisionForApprovalFromCallable({ id: bookingId });
    const target = targetResult.data?.booking;
    if (!target) throw new HttpsError("not-found", "Booking not found");
    await requireSectionModerator(target.event.section.id, callerUid, request.auth!.token?.admin === true);
    const result = await getBookingsForBookerAndEvent({
      bookerId: target.booker.id,
      eventId: target.event.id as UUIDString,
    });
    const bookings = hydrateBookingsWithTicketOrders(result.data);
    const booking = bookings.find((row) => bookingIdsEqual(row.id, bookingId));
    if (!booking) throw new HttpsError("not-found", "Booking not found");
    const history = bookings.filter((row) => bookingIdsEqual(row.revisionGroupId, booking.revisionGroupId));
    const refund = await initiateBookingAllocationRefunds({
      booking,
      financialHistory: history,
      stripeClient: requireStripe(stripeSecret.value()),
    });
    if (refund.failedAmountMinor === 0 && refund.pendingAmountMinor === 0) {
      await settleBookingPaymentAdjustmentsFromCallable({
        revisionBookingId: booking.id as UUIDString,
        status: BookingPaymentAdjustmentStatus.SETTLED,
      });
    } else if (refund.failedAmountMinor > 0) {
      await settleBookingPaymentAdjustmentsFromCallable({
        revisionBookingId: booking.id as UUIDString,
        status: BookingPaymentAdjustmentStatus.REFUND_FAILED,
      });
    }
    return { bookingId, refund };
  }
);
