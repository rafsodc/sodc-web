import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  BookingApprovalStatus,
  BookingStatus,
  getBookingRevisionForApprovalFromCallable,
  getBookingsForBookerAndEvent,
  updateBookingApprovalFromCallable,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import type {
  GetBookingRevisionForApprovalFromCallableData,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { enforceRateLimit } from "./rateLimiter";
import {
  handleFunctionError,
  MAX_DESCRIPTION_LENGTH,
  requireAdmin,
  requireString,
  validateUUID,
} from "./helpers";
import { bookingIdsEqual } from "./bookingCheckout";
import { hydrateBookingsWithTicketOrders, type HydratedBookingRow } from "./bookingQueryHydration";
import { computeBookingPaymentDelta, type BookingPaymentDelta } from "./bookingPaymentAdjustments";
import { activateApprovedBookingRevision } from "./bookingSubmissionPersistence";
import {
  notifyBookingChangesRequestedEmail,
  notifyBookingApprovedEmail,
  notifyBookingRevisionEmail,
} from "./bookingEmailDispatcher";
import { govNotifySecrets } from "./mailer";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

type BookingDecision = typeof BookingApprovalStatus.APPROVED | typeof BookingApprovalStatus.REJECTED;

function parseDecision(value: unknown): BookingDecision {
  if (value === BookingApprovalStatus.APPROVED || value === BookingApprovalStatus.REJECTED) {
    return value;
  }
  throw new HttpsError("invalid-argument", "decision must be APPROVED or REJECTED");
}

function parseExpectedRevisionNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new HttpsError("invalid-argument", "expectedRevisionNumber must be a positive integer");
  }
  return parsed;
}

function parseApprovalNote(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "moderatorNote must be a string");
  }
  const note = value.trim();
  if (note.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `moderatorNote must be no more than ${MAX_DESCRIPTION_LENGTH} characters`
    );
  }
  return note || null;
}

function approvalConflict(): HttpsError {
  return new HttpsError(
    "aborted",
    "This booking revision has changed or has already been reviewed. Refresh and try again.",
    { code: "BOOKING_APPROVAL_CONFLICT" }
  );
}

function isApprovalConflict(error: unknown): boolean {
  return /BOOKING_APPROVAL_CONFLICT|check constraint/i.test(
    error instanceof Error ? error.message : String(error)
  );
}

type ApprovalTarget = NonNullable<GetBookingRevisionForApprovalFromCallableData["booking"]>;
type BookerBooking = HydratedBookingRow;

export function resolveBookingApprovalReview(args: {
  target: ApprovalTarget;
  revisions: readonly BookerBooking[];
  expectedRevisionNumber: number;
  decision: BookingDecision;
}): { activeBooking: BookerBooking | null; paymentDelta?: BookingPaymentDelta } {
  const { target, expectedRevisionNumber, decision } = args;
  if (
    target.revisionNumber !== expectedRevisionNumber ||
    target.approvalStatus !== BookingApprovalStatus.PENDING ||
    target.supersededAt != null ||
    (target.status !== BookingStatus.SUBMITTED && target.status !== BookingStatus.CONFIRMED)
  ) {
    throw approvalConflict();
  }
  const revisions = args.revisions.filter((booking) =>
    bookingIdsEqual(booking.revisionGroupId, target.revisionGroupId)
  );
  if (revisions.some((booking) => booking.supersededAt == null && booking.revisionNumber > target.revisionNumber)) {
    throw approvalConflict();
  }
  const activeBooking = revisions
    .filter(
      (booking) =>
        !bookingIdsEqual(booking.id, target.id) &&
        booking.supersededAt == null &&
        (booking.approvalStatus === BookingApprovalStatus.NOT_REQUIRED ||
          booking.approvalStatus === BookingApprovalStatus.APPROVED)
    )
    .sort((left, right) => right.revisionNumber - left.revisionNumber)[0] ?? null;
  if (decision === BookingApprovalStatus.APPROVED && target.supersedesBooking && !activeBooking) {
    throw approvalConflict();
  }
  return {
    activeBooking,
    paymentDelta:
      decision === BookingApprovalStatus.APPROVED && activeBooking
        ? computeBookingPaymentDelta(activeBooking, target)
        : undefined,
  };
}

/** One admin decision targets one exact, current pending booking revision. */
export const reviewBookingRevision = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request) => {
    requireAdmin(request);
    const reviewerId = request.auth!.uid;
    await enforceRateLimit("reviewBookingRevision", reviewerId);

    const bookingId = validateUUID(
      requireString(request.data?.bookingId, "bookingId"),
      "bookingId"
    ) as UUIDString;
    const expectedRevisionNumber = parseExpectedRevisionNumber(request.data?.expectedRevisionNumber);
    const decision = parseDecision(request.data?.decision);
    const approvalNote = parseApprovalNote(request.data?.moderatorNote);

    try {
      const targetResult = await getBookingRevisionForApprovalFromCallable({ id: bookingId });
      const target = targetResult.data?.booking;
      if (!target) throw new HttpsError("not-found", "Booking revision not found");

      const allResult = await getBookingsForBookerAndEvent({
        bookerId: target.booker.id,
        eventId: target.event.id as UUIDString,
      });
      const review = resolveBookingApprovalReview({
        target,
        revisions: hydrateBookingsWithTicketOrders(allResult.data),
        expectedRevisionNumber,
        decision,
      });
      const { activeBooking, paymentDelta } = review;
      if (decision === BookingApprovalStatus.APPROVED && activeBooking && paymentDelta) {
        await activateApprovedBookingRevision({
          bookingId,
          revisionGroupId: target.revisionGroupId as UUIDString,
          activeBookingId: activeBooking.id as UUIDString,
          reviewedById: reviewerId,
          approvalNote,
          deltaAmountMinor: paymentDelta.deltaAmountMinor,
          adjustmentStatus: paymentDelta.status,
        });
      } else {
        await updateBookingApprovalFromCallable({
          id: bookingId,
          expectedRevisionNumber,
          status: decision,
          reviewedById: reviewerId,
          approvalNote,
        });
      }

      if (decision === BookingApprovalStatus.REJECTED) {
        await notifyBookingChangesRequestedEmail({ bookingId, appBaseUrl: APP_BASE_URL });
      } else if (paymentDelta) {
        await notifyBookingRevisionEmail({
          bookingId,
          idempotencyKey: `approval:${bookingId}`,
          appBaseUrl: APP_BASE_URL,
          paymentDelta,
        });
      } else {
        await notifyBookingApprovedEmail({
          bookingId,
          appBaseUrl: APP_BASE_URL,
        });
      }

      logger.info("Booking revision reviewed", {
        bookingId,
        revisionNumber: expectedRevisionNumber,
        decision,
        reviewerId,
      });
      return {
        success: true,
        bookingId,
        revisionNumber: expectedRevisionNumber,
        approvalStatus: decision,
        paymentDelta: paymentDelta?.deltaAmountMinor ?? null,
      };
    } catch (error: unknown) {
      if (isApprovalConflict(error)) throw approvalConflict();
      handleFunctionError(error, "reviewing booking revision");
    }
  }
);
