import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { randomUUID } from "node:crypto";
import {
  BookingApprovalStatus,
  BookingStatus,
  TicketAudience,
  getBookingsForBookerAndEvent,
  getEventByIdForCallable,
  getSectionByIdForCallable,
  getUserMembershipStatus,
  getUserUserGroupsForAdmin,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  BOOKING_RULE_ERROR_CODES,
  bookingApprovalAllowsPayment,
  deriveBookingApprovalStatus,
  deriveRevisedBookingApprovalStatus,
  evaluateBookingGatekeeping,
  evaluateBookingLines,
  type BookingRulesFailure,
  type LineInputForRules,
  type TicketTypeForRules,
} from "./bookingRules";
import { requireEnabled, requireString, validateUUID, handleFunctionError, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { FUNCTIONS_REGION } from "./constants";
import { computeRevisionPlan } from "./bookingRevisionEngine";
import { computeBookingPaymentDelta, type BookingPaymentDelta } from "./bookingPaymentAdjustments";
import { bookingIdsEqual } from "./bookingCheckout";
import { govNotifySecrets } from "./mailer";
import {
  notifyBookingConfirmationEmail,
  notifyBookingRevisionEmail,
} from "./bookingEmailDispatcher";
import {
  MAX_ATOMIC_BOOKING_LINES,
  persistActiveBookingRevision,
  persistInitialBooking,
  persistPendingBookingRevision,
  planBookingPlaces,
  type ExistingSubmissionLine,
  type SubmissionLine,
} from "./bookingSubmissionPersistence";

const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try { new URL(url); } catch { throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`); }
  return url;
})();

/** Sends confirmation or revision email after a successful submit (not on idempotent replay). */
export async function sendBookingSubmitNotificationEmails(args: {
  bookingId: UUIDString;
  idempotencyKey: string;
  appBaseUrl: string;
  supersededBookingId?: string | null;
  paymentDelta?: BookingPaymentDelta;
}): Promise<void> {
  if (args.supersededBookingId && args.paymentDelta) {
    await notifyBookingRevisionEmail({
      bookingId: args.bookingId,
      idempotencyKey: args.idempotencyKey,
      appBaseUrl: args.appBaseUrl,
      paymentDelta: args.paymentDelta,
    });
  } else {
    await notifyBookingConfirmationEmail({
      bookingId: args.bookingId,
      idempotencyKey: args.idempotencyKey,
      appBaseUrl: args.appBaseUrl,
    });
  }
}

function bookingRulesToHttps(e: BookingRulesFailure): HttpsError {
  if (
    e.code === BOOKING_RULE_ERROR_CODES.NO_SECTION_ACCESS ||
    e.code === BOOKING_RULE_ERROR_CODES.NOT_AUTHORIZED_BOOKER
  ) {
    return new HttpsError("permission-denied", e.message, { code: e.code });
  }
  return new HttpsError("failed-precondition", e.message, { code: e.code });
}

function parseBookingLines(raw: unknown): LineInputForRules[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpsError("invalid-argument", "lines must be a non-empty array");
  }
  if (raw.length > MAX_ATOMIC_BOOKING_LINES) {
    throw new HttpsError("invalid-argument", `lines must contain no more than ${MAX_ATOMIC_BOOKING_LINES} tickets`);
  }
  const out: LineInputForRules[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      throw new HttpsError("invalid-argument", `lines[${i}] must be an object`);
    }
    const o = item as Record<string, unknown>;
    const ticketTypeId =
      typeof o.ticketTypeId === "string" ? validateUUID(o.ticketTypeId, "ticketTypeId") : "";
    if (!ticketTypeId) {
      throw new HttpsError("invalid-argument", `lines[${i}].ticketTypeId is required`);
    }
    const sortOrder = Number(o.sortOrder);
    if (!Number.isInteger(sortOrder)) {
      throw new HttpsError("invalid-argument", `lines[${i}].sortOrder must be an integer`);
    }
    const rawGuestName = typeof o.guestDisplayName === "string" ? o.guestDisplayName.trim() : null;
    if (rawGuestName && rawGuestName.length > MAX_NAME_LENGTH) {
      throw new HttpsError("invalid-argument", `lines[${i}].guestDisplayName must be no more than ${MAX_NAME_LENGTH} characters`);
    }
    const rawDietaryNote = typeof o.dietaryNote === "string" ? o.dietaryNote.trim() : null;
    if (rawDietaryNote && rawDietaryNote.length > MAX_DESCRIPTION_LENGTH) {
      throw new HttpsError("invalid-argument", `lines[${i}].dietaryNote must be no more than ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    out.push({
      ticketTypeId,
      sortOrder,
      guestUserId: typeof o.guestUserId === "string" ? o.guestUserId : null,
      guestDisplayName: rawGuestName || null,
      dietaryNote: rawDietaryNote || null,
    });
  }
  return out;
}

function parseOptionalString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function parseSitNextTo(raw: unknown, uid: string): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") {
      throw new HttpsError("invalid-argument", "sitNextToUserIds must be an array of user ids");
    }
    const trimmed = v.trim();
    if (!trimmed) continue;
    const id = validateUUID(trimmed, "sitNextToUserIds");
    if (id === uid) {
      throw new HttpsError("invalid-argument", "You cannot select yourself in sit-next-to preferences");
    }
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, 10);
}

async function fetchBookingsForBookerAndEvent(bookerId: string, eventId: UUIDString) {
  const res = await getBookingsForBookerAndEvent({ bookerId, eventId });
  return res.data?.user?.bookings ?? [];
}

function isDuplicateKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique|duplicate|violates/i.test(msg);
}

function bookingSubmissionOutcome(approvalStatus: BookingApprovalStatus) {
  const paymentReady = bookingApprovalAllowsPayment(approvalStatus);
  return {
    approvalStatus,
    outcome: paymentReady ? "READY_FOR_PAYMENT" : "PENDING_APPROVAL",
    paymentReady,
  } as const;
}

/**
 * Validates booking policy and persists lines as a single SUBMITTED booking for the event.
 * Requires `idempotencyKey` (UUID) per submit attempt; enforced in DB via (event, booker, key) uniqueness.
 */
export const submitEventBooking = onCall({ region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  await enforceRateLimit("submitEventBooking", uid);

  const idempotencyKey = validateUUID(
    requireString(request.data?.idempotencyKey, "idempotencyKey"),
    "idempotencyKey"
  );
  const eventId = validateUUID(request.data?.eventId as string, "eventId") as UUIDString;
  const baseBookingId = request.data?.baseBookingId ? (validateUUID(String(request.data.baseBookingId), "baseBookingId") as UUIDString) : undefined;
  const baseRevisionNumberRaw = request.data?.baseRevisionNumber;
  const baseRevisionNumber =
    baseRevisionNumberRaw == null ? undefined : Number.isInteger(Number(baseRevisionNumberRaw)) ? Number(baseRevisionNumberRaw) : undefined;
  const lines = parseBookingLines(request.data?.lines);
  const sitNextToUserIds = parseSitNextTo(request.data?.sitNextToUserIds, uid);
  const accommodationRequested = request.data?.accommodationRequested === true;
  const accommodationNote = parseOptionalString(request.data?.accommodationNote, 500);

  try {
    const [eventResult, userStatusResult, userGroupsResult, initialBookings] = await Promise.all([
      getEventByIdForCallable({ id: eventId }),
      getUserMembershipStatus({ id: uid }),
      getUserUserGroupsForAdmin({ userId: uid }),
      fetchBookingsForBookerAndEvent(uid, eventId),
    ]);

    const event = eventResult.data?.event;
    if (!event) {
      throw new HttpsError("not-found", "Event not found");
    }

    if (!userStatusResult.data?.user) {
      throw new HttpsError("failed-precondition", "User profile is required before booking");
    }

    const membershipStatus = userStatusResult.data.user.membershipStatus;
    if (!membershipStatus) {
      throw new HttpsError("failed-precondition", "Membership status is required before booking");
    }
    if (accommodationRequested && membershipStatus !== "REGULAR" && membershipStatus !== "RESERVE") {
      throw new HttpsError("failed-precondition", "Accommodation requests are only available for REGULAR or RESERVE members");
    }

    /** Data Connect outputs UUID scalars as 32 hex chars; client/callable input is canonical hyphenated. Normalize for Set/Map lookups. */
    const explicitGroupIds = new Set(
      (userGroupsResult.data?.user?.userGroups ?? []).map((ug: { userGroup: { id: string } }) =>
        validateUUID(ug.userGroup.id, "userGroupId")
      )
    );

    const sectionId = validateUUID(event.section.id as string, "sectionId") as UUIDString;
    const sectionResult = await getSectionByIdForCallable({ id: sectionId });
    const section = sectionResult.data?.section;
    if (!section) {
      throw new HttpsError("not-found", "Section not found");
    }

    const purposeLinks = (section.purposeLinks ?? []).map(
      (link: { purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }) => ({
        purposes: link.purposes ?? [],
        userGroup: {
          id: validateUUID(link.userGroup.id, "userGroupId"),
          membershipStatuses: link.userGroup.membershipStatuses ?? null,
        },
      })
    );

    const gate = evaluateBookingGatekeeping({
      purposeLinks,
      membershipStatus,
      explicitGroupIds,
      bookingStartDateTime: event.bookingStartDateTime,
      bookingEndDateTime: event.bookingEndDateTime,
    });
    if (!gate.ok) {
      throw bookingRulesToHttps(gate);
    }

    const ticketTypes = event.ticketTypes ?? [];
    const ticketTypesById = new Map<string, TicketTypeForRules>();
    const ticketPriceById = new Map<string, number>();
    for (const tt of ticketTypes) {
      const id = validateUUID(tt.id, "ticketTypeId");
      ticketPriceById.set(id, tt.price);
      ticketTypesById.set(id, {
        id,
        audience: tt.audience,
        userGroup: {
          id: validateUUID(tt.userGroup.id, "userGroupId"),
          membershipStatuses: tt.userGroup.membershipStatuses ?? null,
        },
      });
    }

    for (const line of lines) {
      if (!ticketTypesById.has(line.ticketTypeId)) {
        throw new HttpsError("failed-precondition", `Ticket type does not belong to this event: ${line.ticketTypeId}`, {
          code: BOOKING_RULE_ERROR_CODES.TICKET_TYPE_NOT_FOUND,
        });
      }
    }

    const lineRules = evaluateBookingLines(lines, ticketTypesById, membershipStatus, explicitGroupIds, {
      maxGuestLines: Number.POSITIVE_INFINITY,
    });
    if (!lineRules.ok) {
      throw bookingRulesToHttps(lineRules);
    }

    const terminalBookings = initialBookings.filter(
      (booking) => booking.status === BookingStatus.SUBMITTED || booking.status === BookingStatus.CONFIRMED
    );
    const replayCompleted = terminalBookings.find((b) => b.clientSubmissionKey === idempotencyKey);
    if (replayCompleted) {
      return {
        bookingId: replayCompleted.id,
        status: replayCompleted.status,
        ...bookingSubmissionOutcome(replayCompleted.approvalStatus),
        idempotentReplay: true,
      };
    }
    const revisionPlan = computeRevisionPlan(
      terminalBookings.map((b) => ({
        id: b.id as UUIDString,
        status: b.status,
        revisionGroupId: b.revisionGroupId as UUIDString,
        revisionNumber: b.revisionNumber,
        clientSubmissionKey: b.clientSubmissionKey ?? null,
      })),
      { idempotencyKey, baseBookingId, baseRevisionNumber }
    );

    const legacyDrafts = initialBookings.filter((booking) => booking.status === BookingStatus.DRAFT);
    if (legacyDrafts.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "A legacy in-progress booking must be cleared before the atomic booking flow can continue.",
        { code: BOOKING_RULE_ERROR_CODES.IDEMPOTENCY_DRAFT_CONFLICT }
      );
    }

    const baseBooking = revisionPlan.supersedesBookingId
      ? terminalBookings.find((booking) => bookingIdsEqual(booking.id, revisionPlan.supersedesBookingId!))
      : undefined;
    if (revisionPlan.supersedesBookingId && !baseBooking) {
      throw new HttpsError("aborted", "Booking revision conflict: base revision changed", {
        code: "BOOKING_REVISION_CONFLICT",
      });
    }

    const submissionLines: SubmissionLine[] = lines.map((line) => ({
      ticketTypeId: line.ticketTypeId as UUIDString,
      audience: ticketTypesById.get(line.ticketTypeId)!.audience,
      sortOrder: line.sortOrder,
      guestUserId: line.guestUserId,
      guestDisplayName: line.guestDisplayName,
      dietaryNote: line.dietaryNote,
    }));
    const previousLines: ExistingSubmissionLine[] = (baseBooking?.lines ?? []).map((line) => ({
      ticketTypeId: validateUUID(line.ticketType.id, "ticketTypeId") as UUIDString,
      audience: line.ticketType.audience,
      sortOrder: line.sortOrder,
      guestUserId: line.guestUser?.id ?? null,
      guestDisplayName: line.guestDisplayName ?? null,
      dietaryNote: line.dietaryNote ?? null,
      bookingPlaceId: line.bookingPlace?.id
        ? (validateUUID(line.bookingPlace.id, "bookingPlaceId") as UUIDString)
        : null,
      paymentAllocationStatuses: (line.bookingPlace?.paymentAllocations ?? []).map(
        (allocation) => allocation.ticketOrder.status
      ),
    }));
    const placePlan = planBookingPlaces({ lines: submissionLines, previousLines });
    if (placePlan.paidRemovedBookingPlaceIds.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "Paid tickets cannot be removed or transferred yet. A refund workflow is required.",
        { code: BOOKING_RULE_ERROR_CODES.PAID_BOOKING_PLACE_REMOVAL_REQUIRES_REFUND }
      );
    }

    const revisedGuests = submissionLines.filter((line) => line.audience === TicketAudience.GUEST);
    const previousGuests = previousLines.filter((line) => line.audience === TicketAudience.GUEST);
    const approvalStatus = baseBooking
      ? deriveRevisedBookingApprovalStatus({
          previousStatus: baseBooking.approvalStatus,
          previousGuests,
          revisedGuests,
          maxGuestsWithoutModeratorApproval: event.maxGuestsWithoutModeratorApproval,
        })
      : deriveBookingApprovalStatus({
          guestTicketCount: revisedGuests.length,
          maxGuestsWithoutModeratorApproval: event.maxGuestsWithoutModeratorApproval,
        });

    const bookingId = randomUUID() as UUIDString;
    const persistenceInput = {
      bookingId,
      eventId,
      bookerId: uid,
      idempotencyKey: idempotencyKey as UUIDString,
      revisionGroupId: revisionPlan.revisionGroupId,
      revisionNumber: revisionPlan.revisionNumber,
      supersedesBookingId: revisionPlan.supersedesBookingId,
      approvalStatus,
      sitNextToUserIds,
      accommodationRequested,
      accommodationNote,
      placePlan,
    };

    let paymentDelta: BookingPaymentDelta | undefined;
    try {
      if (!revisionPlan.supersedesBookingId) {
        await persistInitialBooking(persistenceInput);
      } else if (!bookingApprovalAllowsPayment(approvalStatus)) {
        await persistPendingBookingRevision(persistenceInput);
      } else {
        const activeBooking = terminalBookings
          .filter(
            (booking) =>
              bookingIdsEqual(booking.revisionGroupId, revisionPlan.revisionGroupId) &&
              booking.supersededAt == null &&
              (booking.approvalStatus === BookingApprovalStatus.NOT_REQUIRED ||
                booking.approvalStatus === BookingApprovalStatus.APPROVED)
          )
          .sort((left, right) => right.revisionNumber - left.revisionNumber)[0];
        if (!activeBooking) {
          throw new HttpsError("aborted", "Booking revision conflict: active revision not found", {
            code: "BOOKING_REVISION_CONFLICT",
          });
        }
        paymentDelta = computeBookingPaymentDelta(activeBooking, {
          lines: submissionLines.map((line) => ({
            ticketType: { price: ticketPriceById.get(line.ticketTypeId) ?? 0 },
          })),
        });
        await persistActiveBookingRevision({
          input: persistenceInput,
          activeBookingId: activeBooking.id as UUIDString,
          deltaAmountMinor: paymentDelta.deltaAmountMinor,
          adjustmentStatus: paymentDelta.status,
        });
      }
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error) && !/BOOKING_REVISION_CONFLICT/i.test(String(error))) throw error;
      const refreshed = await fetchBookingsForBookerAndEvent(uid, eventId);
      const replay = refreshed.find(
        (booking) =>
          booking.clientSubmissionKey === idempotencyKey &&
          (booking.status === BookingStatus.SUBMITTED || booking.status === BookingStatus.CONFIRMED)
      );
      if (replay) {
        return {
          bookingId: replay.id,
          status: replay.status,
          ...bookingSubmissionOutcome(replay.approvalStatus),
          idempotentReplay: true,
        };
      }
      throw new HttpsError("aborted", "Booking revision conflict: retry from the latest booking", {
        code: "BOOKING_REVISION_CONFLICT",
      });
    }

    if (bookingSubmissionOutcome(approvalStatus).paymentReady) {
      await sendBookingSubmitNotificationEmails({
        bookingId,
        idempotencyKey,
        appBaseUrl: APP_BASE_URL,
        supersededBookingId: revisionPlan.supersedesBookingId,
        paymentDelta,
      });
    }

    logger.info(`submitEventBooking: uid=${uid} eventId=${eventId} bookingId=${bookingId} key=${idempotencyKey}`);
    return {
      bookingId,
      status: BookingStatus.SUBMITTED,
      ...bookingSubmissionOutcome(approvalStatus),
      idempotentReplay: false,
    };
  } catch (e: unknown) {
    if (e instanceof HttpsError) throw e;
    handleFunctionError(e as Error, "submitEventBooking");
  }
});
