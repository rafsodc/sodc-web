import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  addBookingLine,
  adminDeleteBookingLine,
  BookingStatus,
  createBookingDraftForUser,
  getBookingsForBookerAndEvent,
  getEventById,
  getSectionById,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  updateBookingStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  BOOKING_RULE_ERROR_CODES,
  evaluateBookingGatekeeping,
  evaluateBookingLines,
  type BookingRulesFailure,
  type LineInputForRules,
  type TicketTypeForRules,
} from "./bookingRules";
import { requireEnabled, requireString, validateUUID, handleFunctionError } from "./helpers";
import { FUNCTIONS_REGION } from "./constants";

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
    out.push({
      ticketTypeId,
      sortOrder,
      guestUserId: typeof o.guestUserId === "string" ? o.guestUserId : null,
      guestDisplayName: typeof o.guestDisplayName === "string" ? o.guestDisplayName : null,
      dietaryNote: typeof o.dietaryNote === "string" ? o.dietaryNote : null,
    });
  }
  return out;
}

async function fetchBookingsForBookerAndEvent(bookerId: string, eventId: UUIDString) {
  const res = await getBookingsForBookerAndEvent({ bookerId, eventId });
  return res.data?.user?.bookings ?? [];
}

function isDuplicateKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique|duplicate|violates/i.test(msg);
}

/**
 * Validates booking policy and persists lines as a single SUBMITTED booking for the event.
 * Requires `idempotencyKey` (UUID) per submit attempt; enforced in DB via (event, booker, key) uniqueness.
 */
export const submitEventBooking = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;

  const idempotencyKey = validateUUID(
    requireString(request.data?.idempotencyKey, "idempotencyKey"),
    "idempotencyKey"
  );
  const eventId = validateUUID(request.data?.eventId as string, "eventId") as UUIDString;
  const lines = parseBookingLines(request.data?.lines);

  try {
    const [eventResult, userStatusResult, userGroupsResult, initialBookings] = await Promise.all([
      getEventById({ id: eventId }),
      getUserMembershipStatus({ id: uid }),
      getUserAccessGroupsById({ userId: uid }),
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

    const explicitGroupIds = new Set(
      (userGroupsResult.data?.user?.userGroups ?? []).map((ug: { userGroup: { id: string } }) => ug.userGroup.id)
    );

    const sectionId = event.section.id as UUIDString;
    const sectionResult = await getSectionById({ id: sectionId });
    const section = sectionResult.data?.section;
    if (!section) {
      throw new HttpsError("not-found", "Section not found");
    }

    const purposeLinks = section.purposeLinks ?? [];

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
    for (const tt of ticketTypes) {
      ticketTypesById.set(tt.id, {
        id: tt.id,
        audience: tt.audience,
        userGroup: { id: tt.userGroup.id, membershipStatuses: tt.userGroup.membershipStatuses ?? null },
      });
    }

    for (const line of lines) {
      if (!ticketTypesById.has(line.ticketTypeId)) {
        throw new HttpsError("failed-precondition", `Ticket type does not belong to this event: ${line.ticketTypeId}`, {
          code: BOOKING_RULE_ERROR_CODES.TICKET_TYPE_NOT_FOUND,
        });
      }
    }

    const lineRules = evaluateBookingLines(lines, ticketTypesById, membershipStatus, explicitGroupIds);
    if (!lineRules.ok) {
      throw bookingRulesToHttps(lineRules);
    }

    let bookings = initialBookings;

    const terminalBookings = bookings.filter(
      (b) => b.status === BookingStatus.SUBMITTED || b.status === BookingStatus.CONFIRMED
    );
    const replayCompleted = terminalBookings.find((b) => b.clientSubmissionKey === idempotencyKey);
    if (replayCompleted) {
      return {
        bookingId: replayCompleted.id,
        status: replayCompleted.status,
        idempotentReplay: true,
      };
    }
    if (terminalBookings.length > 0) {
      throw new HttpsError("failed-precondition", "A booking for this event is already submitted", {
        code: BOOKING_RULE_ERROR_CODES.BOOKING_ALREADY_SUBMITTED,
      });
    }

    const drafts = bookings.filter((b) => b.status === BookingStatus.DRAFT);
    const matchingDraft = drafts.find((b) => b.clientSubmissionKey === idempotencyKey);
    const otherDrafts = drafts.filter((b) => b.clientSubmissionKey !== idempotencyKey);
    if (otherDrafts.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "Another in-progress booking exists for this event. Retry with the same idempotency key as that draft, or cancel the other draft first.",
        { code: BOOKING_RULE_ERROR_CODES.IDEMPOTENCY_DRAFT_CONFLICT }
      );
    }

    let bookingId: string;

    if (matchingDraft) {
      bookingId = matchingDraft.id;
      for (const ln of matchingDraft.lines ?? []) {
        await adminDeleteBookingLine({ id: ln.id });
      }
    } else {
      try {
        const insert = await createBookingDraftForUser({
          eventId,
          bookerId: uid,
          clientSubmissionKey: idempotencyKey,
        });
        const key = insert.data?.booking_insert;
        if (!key?.id) {
          throw new HttpsError("internal", "Failed to create booking");
        }
        bookingId = key.id;
      } catch (e: unknown) {
        if (!isDuplicateKeyError(e)) {
          throw e;
        }
        bookings = await fetchBookingsForBookerAndEvent(uid, eventId);
        const replay = bookings.find(
          (b) =>
            b.clientSubmissionKey === idempotencyKey &&
            (b.status === BookingStatus.SUBMITTED || b.status === BookingStatus.CONFIRMED)
        );
        if (replay) {
          return { bookingId: replay.id, status: replay.status, idempotentReplay: true };
        }
        const racedDraft = bookings.find(
          (b) => b.clientSubmissionKey === idempotencyKey && b.status === BookingStatus.DRAFT
        );
        if (racedDraft) {
          bookingId = racedDraft.id;
          for (const ln of racedDraft.lines ?? []) {
            await adminDeleteBookingLine({ id: ln.id });
          }
        } else {
          logger.error("submitEventBooking: duplicate key but no matching booking after refetch", e);
          throw new HttpsError("aborted", "Could not complete booking after conflict; retry the request");
        }
      }
    }

    const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const line of sorted) {
      await addBookingLine({
        bookingId: bookingId as UUIDString,
        ticketTypeId: line.ticketTypeId as UUIDString,
        guestUserId: line.guestUserId?.trim() || null,
        guestDisplayName: line.guestDisplayName?.trim() || null,
        dietaryNote: line.dietaryNote?.trim() || null,
        sortOrder: line.sortOrder,
      });
    }

    await updateBookingStatus({
      id: bookingId as UUIDString,
      status: BookingStatus.SUBMITTED,
    });

    logger.info(`submitEventBooking: uid=${uid} eventId=${eventId} bookingId=${bookingId} key=${idempotencyKey}`);
    return { bookingId, status: BookingStatus.SUBMITTED, idempotentReplay: false };
  } catch (e: unknown) {
    if (e instanceof HttpsError) throw e;
    handleFunctionError(e as Error, "submitEventBooking");
  }
});
