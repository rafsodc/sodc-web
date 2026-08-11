import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  adminReviewGuestTicketRequestFromCallable,
  createGuestTicketRequestFromCallable,
  getBookingForGuestTicketCallable,
  getGuestTicketRequestByIdForCallable,
  GuestTicketRequestStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireAdmin, requireEnabled, validateUUID, handleFunctionError, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { govNotifySecrets } from "./mailer";
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
import {
  IdempotencyConflictError,
  guestTicketRequestId,
  runIdempotentAtomicBatch,
} from "./guestTicketRequestIdempotency";
import { persistLegacyGuestTicketRequests } from "./bookingSubmissionPersistence";

const MAX_GUEST_REQUEST_BATCH = 20;

const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try { new URL(url); } catch { throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`); }
  return url;
})();

export async function sendGuestTicketRequestSubmittedEmails(args: {
  requestId: string;
  appBaseUrl: string;
}): Promise<void> {
  await notifyModeratorsGuestTicketRequestSubmitted({
    requestId: args.requestId,
    appBaseUrl: args.appBaseUrl,
  });
}

export async function sendGuestTicketRequestReviewedEmails(args: {
  requestId: string;
  status: typeof GuestTicketRequestStatus.APPROVED | typeof GuestTicketRequestStatus.REJECTED;
  appBaseUrl: string;
}): Promise<void> {
  await notifyBookerGuestTicketRequestReviewed({
    requestId: args.requestId,
    status: args.status,
    appBaseUrl: args.appBaseUrl,
  });
}

export const submitGuestTicketRequest = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request) => {
    requireEnabled(request);
    const callerUid = request.auth!.uid;
    await enforceRateLimit("submitGuestTicketRequest", callerUid);

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
    if (guestDisplayName.length > MAX_NAME_LENGTH) {
      throw new HttpsError("invalid-argument", `guestDisplayName must be no more than ${MAX_NAME_LENGTH} characters`);
    }
    const rawDietaryNote = typeof request.data?.dietaryNote === "string" ? request.data.dietaryNote.trim() : null;
    if (rawDietaryNote && rawDietaryNote.length > MAX_DESCRIPTION_LENGTH) {
      throw new HttpsError("invalid-argument", `dietaryNote must be no more than ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    const dietaryNote = rawDietaryNote || null;

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
        id: randomUUID() as UUIDString,
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
        await sendGuestTicketRequestSubmittedEmails({
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

type GuestSubmission = { guestDisplayName: string; dietaryNote: string | null };
type ExistingGuestRequest = NonNullable<
  Awaited<ReturnType<typeof getGuestTicketRequestByIdForCallable>>["data"]["guestTicketRequest"]
>;

function validateGuestSubmission(value: unknown, index: number): GuestSubmission {
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", `guests[${index}] must be an object`);
  }
  const raw = value as { guestDisplayName?: unknown; dietaryNote?: unknown };
  const guestDisplayName = typeof raw.guestDisplayName === "string" ? raw.guestDisplayName.trim() : "";
  if (!guestDisplayName) {
    throw new HttpsError("invalid-argument", `guests[${index}].guestDisplayName is required`);
  }
  if (guestDisplayName.length > MAX_NAME_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `guests[${index}].guestDisplayName must be no more than ${MAX_NAME_LENGTH} characters`,
    );
  }
  const rawDietaryNote = typeof raw.dietaryNote === "string" ? raw.dietaryNote.trim() : null;
  if (rawDietaryNote && rawDietaryNote.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `guests[${index}].dietaryNote must be no more than ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }
  return { guestDisplayName, dietaryNote: rawDietaryNote || null };
}

function existingRequestMatches(
  existing: ExistingGuestRequest | undefined,
  expected: { bookingId: string; guestTicketTypeId: string; guest: GuestSubmission },
): boolean {
  return Boolean(
    existing &&
      validateUUID(existing.booking.id, "bookingId") === expected.bookingId &&
      existing.guestTicketType?.id &&
      validateUUID(existing.guestTicketType.id, "guestTicketTypeId") === expected.guestTicketTypeId &&
      existing.requestedGuestCount === 1 &&
      existing.guestDisplayName?.trim() === expected.guest.guestDisplayName &&
      (existing.dietaryNote?.trim() || null) === expected.guest.dietaryNote,
  );
}

export const submitAdditionalGuestTicketRequests = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request) => {
    requireEnabled(request);
    const callerUid = request.auth!.uid;
    const bookingId = validateUUID(request.data?.bookingId, "bookingId") as UUIDString;
    const guestTicketTypeId = validateUUID(request.data?.guestTicketTypeId, "guestTicketTypeId") as UUIDString;
    const idempotencyKey = validateUUID(request.data?.idempotencyKey, "idempotencyKey");
    if (!Array.isArray(request.data?.guests) || request.data.guests.length < 1) {
      throw new HttpsError("invalid-argument", "guests must contain at least one guest");
    }
    if (request.data.guests.length > MAX_GUEST_REQUEST_BATCH) {
      throw new HttpsError(
        "invalid-argument",
        `guests must contain no more than ${MAX_GUEST_REQUEST_BATCH} guests`,
      );
    }
    const guests: GuestSubmission[] = request.data.guests.map(validateGuestSubmission);
    await enforceRateLimit("submitAdditionalGuestTicketRequests", callerUid, guests.length);

    try {
      const bookingRow = await getBookingForGuestTicketCallable({ bookingId });
      const booking = bookingRow.data?.booking;
      if (!booking) throw new HttpsError("not-found", "Booking not found");
      if (booking.booker.id !== callerUid) {
        throw new HttpsError("permission-denied", "You can only submit guest requests for your own booking");
      }

      let { approvedPool, pendingPool } = consumeGuestRequestPoolsForExistingRequests(
        buildApprovedGuestTicketRequestPool(booking.supersedesBooking?.guestTicketRequests),
        buildPendingGuestTicketRequestPool(booking.supersedesBooking?.guestTicketRequests),
        booking.guestTicketRequests,
      );
      const ids = guests.map((_guest, index) =>
        guestTicketRequestId({ callerUid, bookingId, idempotencyKey, index })
      );
      let results: Array<{ success: true; requestId: string }>;
      try {
        const loadAll = () => Promise.all(ids.map(async (id) =>
          (await getGuestTicketRequestByIdForCallable({ id: id as UUIDString })).data.guestTicketRequest
        ));
        const existing = await runIdempotentAtomicBatch({
          items: guests,
          loadAll,
          matches: (requestRow, guest) =>
            existingRequestMatches(requestRow, { bookingId, guestTicketTypeId, guest }),
          buildMissingRows: (loaded) => {
            const rows = [];
            for (const [index, guest] of guests.entries()) {
              if (loaded[index]) continue;
              const id = ids[index]!;
              const resolved = resolveGuestTicketRequestSubmission({
                approvedPool,
                pendingPool,
                guestDisplayName: guest.guestDisplayName,
                guestTicketTypeId,
              });
              approvedPool = resolved.remainingApprovedPool;
              pendingPool = resolved.remainingPendingPool;
              const decision = resolved.decision;
              const status =
                decision.kind === "carry_forward_approved"
                  ? GuestTicketRequestStatus.APPROVED
                  : GuestTicketRequestStatus.PENDING;
              rows.push({
                id,
                bookingId,
                requestedGuestCount: 1,
                guestTicketTypeId,
                guestDisplayName: guest.guestDisplayName,
                dietaryNote: guest.dietaryNote,
                status,
                reviewedById: decision.kind === "carry_forward_approved" ? decision.reviewedById : null,
                reviewedAt: decision.kind === "carry_forward_approved" ? decision.reviewedAt : null,
                moderatorNote: decision.kind === "carry_forward_approved" ? decision.moderatorNote : null,
                createdBy: "system",
                updatedBy: "system",
              });
            }
            return rows;
          },
          insertMany: async (rows) => {
            await persistLegacyGuestTicketRequests(rows);
          },
        });
        for (const [index, requestRow] of existing.entries()) {
          if (requestRow.status === GuestTicketRequestStatus.PENDING) {
            await sendGuestTicketRequestSubmittedEmails({ requestId: ids[index]!, appBaseUrl: APP_BASE_URL });
          }
        }
        results = ids.map((id) => ({ success: true as const, requestId: id }));
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          throw new HttpsError("already-exists", "idempotencyKey is already bound to different guest details");
        }
        throw error;
      }

      logger.info("additional guest ticket request batch submitted", {
        bookingId,
        bookerId: callerUid,
        idempotencyKey,
        requestCount: results.length,
      });
      return { success: true, requests: results };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e, "submitting additional guest ticket requests");
    }
  },
);

export const reviewGuestTicketRequest = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request) => {
    requireAdmin(request);
    await enforceRateLimit("reviewGuestTicketRequest", request.auth!.uid);

    const id = validateUUID(request.data?.id, "id") as UUIDString;
    const status = request.data?.status;
    if (status !== GuestTicketRequestStatus.APPROVED && status !== GuestTicketRequestStatus.REJECTED) {
      throw new HttpsError("invalid-argument", "status must be APPROVED or REJECTED");
    }
    const rawModeratorNote = typeof request.data?.moderatorNote === "string" ? request.data.moderatorNote.trim() : null;
    if (rawModeratorNote && rawModeratorNote.length > MAX_DESCRIPTION_LENGTH) {
      throw new HttpsError("invalid-argument", `moderatorNote must be no more than ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    const moderatorNote = rawModeratorNote || null;

    try {
      await adminReviewGuestTicketRequestFromCallable({
        id,
        status,
        moderatorNote,
        reviewedById: request.auth!.uid,
      });

      await sendGuestTicketRequestReviewedEmails({
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
