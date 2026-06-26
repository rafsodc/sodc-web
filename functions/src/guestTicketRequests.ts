import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  adminReviewGuestTicketRequestFromCallable,
  createGuestTicketRequestFromCallable,
  getBookingForGuestTicketCallable,
  GuestTicketRequestStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireAdmin, requireEnabled, validateUUID, handleFunctionError } from "./helpers";
import { govNotifyApiKey } from "./mailer";
import {
  notifyBookerGuestTicketRequestReviewed,
  notifyModeratorsGuestTicketRequestSubmitted,
} from "./guestTicketRequestEmails";
import {
  buildApprovedGuestTicketRequestPool,
  buildPendingGuestTicketRequestPool,
  consumeGuestRequestPoolsForExistingRequests,
  resolveGuestTicketRequestSubmission,
} from "./guestTicketRequestCarryForward";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

export function scheduleGuestTicketRequestSubmittedEmails(args: {
  requestId: string;
  appBaseUrl: string;
}): void {
  void notifyModeratorsGuestTicketRequestSubmitted({
    requestId: args.requestId,
    appBaseUrl: args.appBaseUrl,
  });
}

export function scheduleGuestTicketRequestReviewedEmails(args: {
  requestId: string;
  status: typeof GuestTicketRequestStatus.APPROVED | typeof GuestTicketRequestStatus.REJECTED;
  appBaseUrl: string;
}): void {
  void notifyBookerGuestTicketRequestReviewed({
    requestId: args.requestId,
    status: args.status,
    appBaseUrl: args.appBaseUrl,
  });
}

export const submitGuestTicketRequest = onCall(
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] },
  async (request) => {
    requireEnabled(request);
    const callerUid = request.auth!.uid;

    const bookingId = validateUUID(request.data?.bookingId, "bookingId") as UUIDString;
    const guestTicketTypeId = validateUUID(request.data?.guestTicketTypeId, "guestTicketTypeId") as UUIDString;
    const requestedGuestCount = Number(request.data?.requestedGuestCount);
    if (!Number.isInteger(requestedGuestCount) || requestedGuestCount < 1) {
      throw new HttpsError("invalid-argument", "requestedGuestCount must be a positive integer");
    }
    const guestDisplayName =
      typeof request.data?.guestDisplayName === "string" ? request.data.guestDisplayName.trim() : "";
    if (!guestDisplayName) {
      throw new HttpsError("invalid-argument", "guestDisplayName is required");
    }
    const dietaryNote =
      typeof request.data?.dietaryNote === "string" && request.data.dietaryNote.trim().length > 0
        ? request.data.dietaryNote.trim()
        : null;

    try {
      const bookingRow = await getBookingForGuestTicketCallable({ bookingId });
      const booking = bookingRow.data?.booking;
      if (!booking) {
        throw new HttpsError("not-found", "Booking not found");
      }
      if (booking.booker.id !== callerUid) {
        throw new HttpsError("permission-denied", "You can only submit guest requests for your own booking");
      }

      const { approvedPool, pendingPool } = consumeGuestRequestPoolsForExistingRequests(
        buildApprovedGuestTicketRequestPool(booking.supersedesBooking?.guestTicketRequests),
        buildPendingGuestTicketRequestPool(booking.supersedesBooking?.guestTicketRequests),
        booking.guestTicketRequests
      );
      const { decision } = resolveGuestTicketRequestSubmission({
        approvedPool,
        pendingPool,
        guestDisplayName,
        guestTicketTypeId,
      });

      const status =
        decision.kind === "carry_forward_approved"
          ? GuestTicketRequestStatus.APPROVED
          : GuestTicketRequestStatus.PENDING;

      const insertResult = await createGuestTicketRequestFromCallable({
        bookingId,
        requestedGuestCount,
        guestTicketTypeId,
        guestDisplayName,
        dietaryNote,
        status,
        reviewedById: decision.kind === "carry_forward_approved" ? decision.reviewedById : null,
        reviewedAt: decision.kind === "carry_forward_approved" ? decision.reviewedAt : null,
        moderatorNote: decision.kind === "carry_forward_approved" ? decision.moderatorNote : null,
      });
      const requestId = insertResult.data?.guestTicketRequest_insert?.id;
      if (!requestId) {
        throw new HttpsError("internal", "Guest ticket request was not created");
      }

      if (decision.kind === "create_pending") {
        scheduleGuestTicketRequestSubmittedEmails({
          requestId,
          appBaseUrl: APP_BASE_URL,
        });
      }

      logger.info("guest ticket request submitted", {
        requestId,
        bookingId,
        bookerId: callerUid,
        submissionKind: decision.kind,
      });
      return { success: true, requestId };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e, "submitting guest ticket request");
    }
  }
);

export const reviewGuestTicketRequest = onCall(
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] },
  async (request) => {
    requireAdmin(request);
    if (request.auth!.token.enabled !== true) {
      throw new HttpsError("permission-denied", "Account must be enabled");
    }

    const id = validateUUID(request.data?.id, "id") as UUIDString;
    const status = request.data?.status;
    if (status !== GuestTicketRequestStatus.APPROVED && status !== GuestTicketRequestStatus.REJECTED) {
      throw new HttpsError("invalid-argument", "status must be APPROVED or REJECTED");
    }
    const moderatorNote =
      typeof request.data?.moderatorNote === "string" && request.data.moderatorNote.trim().length > 0
        ? request.data.moderatorNote.trim()
        : null;

    try {
      await adminReviewGuestTicketRequestFromCallable({
        id,
        status,
        moderatorNote,
        reviewedById: request.auth!.uid,
      });

      scheduleGuestTicketRequestReviewedEmails({
        requestId: id,
        status,
        appBaseUrl: APP_BASE_URL,
      });

      logger.info("guest ticket request reviewed", {
        requestId: id,
        status,
        reviewerId: request.auth!.uid,
      });
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e, "reviewing guest ticket request");
    }
  }
);
