import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  addBookingLineFromCallable,
  createBookingPaymentAdjustmentFromCallable,
  BookingStatus,
  markBookingSupersededFromCallable,
  createBookingDraftForUser,
  createBookingDraftRevisionForUser,
  deleteBookingLineFromCallable,
  getBookingsForBookerAndEvent,
  getEventByIdForCallable,
  getSectionByIdForCallable,
  getUserMembershipStatus,
  getUserUserGroupsForAdmin,
  updateBookingPreferencesFromCallable,
  updateBookingStatusFromCallable,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  BOOKING_RULE_ERROR_CODES,
  evaluateBookingGatekeeping,
  evaluateGuestApprovalGate,
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
import { govNotifyApiKey } from "./mailer";
import {
  notifyBookingConfirmationEmail,
  notifyBookingRevisionEmail,
} from "./bookingEmailDispatcher";

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

/**
 * Validates booking policy and persists lines as a single SUBMITTED booking for the event.
 * Requires `idempotencyKey` (UUID) per submit attempt; enforced in DB via (event, booker, key) uniqueness.
 */
export const submitEventBooking = onCall({ region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] }, async (request) => {
  requireEnabled(request);
  const uid = request.auth!.uid;
  await enforceRateLimit("submitEventBooking", uid, { limit: 20, windowMs: 60 * 60 * 1000 });

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
  const bookerDietaryNote = parseOptionalString(request.data?.bookerDietaryNote, 500);
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
    for (const tt of ticketTypes) {
      const id = validateUUID(tt.id, "ticketTypeId");
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

    let bookings = initialBookings;

    const terminalBookings = bookings.filter((b) => b.status === BookingStatus.SUBMITTED || b.status === BookingStatus.CONFIRMED);
    const replayCompleted = terminalBookings.find((b) => b.clientSubmissionKey === idempotencyKey);
    if (replayCompleted) {
      return {
        bookingId: replayCompleted.id,
        status: replayCompleted.status,
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

    if (revisionPlan.supersedesBookingId) {
      const superseded = terminalBookings.find((b) => b.id === revisionPlan.supersedesBookingId);
      const approvedGuestCapacity = Math.max(
        0,
        ...(superseded?.guestTicketRequests ?? [])
          .filter((request) => request.status === "APPROVED")
          .map((request) => request.requestedGuestCount)
      );
      const revisedGuestTicketCount = lines.reduce((count, line) => {
        const tt = ticketTypesById.get(line.ticketTypeId);
        return count + (tt?.audience === "GUEST" ? 1 : 0);
      }, 0);
      const guestApprovalGate = evaluateGuestApprovalGate({
        guestTicketCount: revisedGuestTicketCount,
        maxGuestsWithoutModeratorApproval: event.maxGuestsWithoutModeratorApproval ?? null,
        approvedGuestCapacity,
      });
      if (!guestApprovalGate.ok) {
        throw bookingRulesToHttps(guestApprovalGate);
      }
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
        await deleteBookingLineFromCallable({ id: ln.id });
      }
    } else {
      try {
        const insert = revisionPlan.supersedesBookingId
          ? await createBookingDraftRevisionForUser({
              eventId,
              bookerId: uid,
              clientSubmissionKey: idempotencyKey,
              revisionGroupId: revisionPlan.revisionGroupId,
              revisionNumber: revisionPlan.revisionNumber,
              supersedesBookingId: revisionPlan.supersedesBookingId,
            })
          : await createBookingDraftForUser({
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
            await deleteBookingLineFromCallable({ id: ln.id });
          }
        } else {
          logger.error("submitEventBooking: duplicate key but no matching booking after refetch", e);
          throw new HttpsError("aborted", "Could not complete booking after conflict; retry the request");
        }
      }
    }

    await updateBookingPreferencesFromCallable({
      id: bookingId as UUIDString,
      bookerDietaryNote,
      sitNextToUserIds,
      accommodationRequested,
      accommodationNote: accommodationRequested ? accommodationNote : null,
    });

    const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const line of sorted) {
      await addBookingLineFromCallable({
        bookingId: bookingId as UUIDString,
        ticketTypeId: line.ticketTypeId as UUIDString,
        guestUserId: line.guestUserId?.trim() || null,
        guestDisplayName: line.guestDisplayName?.trim() || null,
        dietaryNote: line.dietaryNote?.trim() || null,
        sortOrder: line.sortOrder,
      });
    }

    await updateBookingStatusFromCallable({
      id: bookingId as UUIDString,
      status: BookingStatus.SUBMITTED,
    });
    let paymentDelta: BookingPaymentDelta | undefined;
    if (revisionPlan.supersedesBookingId) {
      await markBookingSupersededFromCallable({ id: revisionPlan.supersedesBookingId });
      const refreshed = await fetchBookingsForBookerAndEvent(uid, eventId);
      const previousBooking = refreshed.find((booking) => booking.id === revisionPlan.supersedesBookingId);
      const revisedBooking = refreshed.find((booking) => booking.id === bookingId);
      paymentDelta = computeBookingPaymentDelta(previousBooking, revisedBooking);
      await createBookingPaymentAdjustmentFromCallable({
        revisionBookingId: bookingId as UUIDString,
        supersededBookingId: revisionPlan.supersedesBookingId,
        deltaAmountMinor: paymentDelta.deltaAmountMinor,
        status: paymentDelta.status,
        orchestrationKey: `${bookingId}:${idempotencyKey}`,
      });
    }

    await sendBookingSubmitNotificationEmails({
      bookingId: bookingId as UUIDString,
      idempotencyKey,
      appBaseUrl: APP_BASE_URL,
      supersededBookingId: revisionPlan.supersedesBookingId,
      paymentDelta,
    });

    logger.info(`submitEventBooking: uid=${uid} eventId=${eventId} bookingId=${bookingId} key=${idempotencyKey}`);
    return { bookingId, status: BookingStatus.SUBMITTED, idempotentReplay: false };
  } catch (e: unknown) {
    if (e instanceof HttpsError) throw e;
    handleFunctionError(e as Error, "submitEventBooking");
  }
});
