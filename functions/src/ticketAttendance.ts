import { ticketPreferences } from "./ticketPreferences";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAttendeeEventSection, listUserNamesByIds, listEventBookingsForAdmin, getEventById, getTicketAttendanceForManagement, getAttendanceTicketType, updateTicketAttendance } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, requireString, validateUUID, handleFunctionError } from "./helpers";
import { requireSectionModerator } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";

function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new HttpsError("invalid-argument", `Invalid ${label}`);
  }
  return value.trim();
}

export const manageTicketAttendance = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    requireEnabled(request);
    const id = validateUUID(requireString(request.data?.id, "id"));
    const eventId = validateUUID(requireString(request.data?.eventId, "eventId"));
    const { action, version } = request.data;
    if (!["edit", "delete"].includes(action) || !Number.isInteger(version) || version < 0) {
      throw new HttpsError("invalid-argument", "Invalid ticket action or version");
    }
    await enforceRateLimit("manageTicketAttendance", request.auth!.uid);
    const line = (await getTicketAttendanceForManagement({ id })).data.bookingLine;
    if (!line || validateUUID(line.booking.event.id) !== eventId) throw new HttpsError("not-found", "Ticket not found");
    await requireSectionModerator(line.booking.event.section.id, request.auth!.uid, request.auth!.token.admin === true);
    if (line.booking.supersededAt || !["SUBMITTED", "CONFIRMED"].includes(line.booking.status) ||
        !["NOT_REQUIRED", "APPROVED"].includes(line.booking.approvalStatus) || line.bookingPlace.attendanceRemoved ||
        line.bookingPlace.attendanceVersion !== version) {
      throw new HttpsError("failed-precondition", "The ticket changed. Refresh and try again.");
    }
    const ticketTypeId = validateUUID(requireString(request.data.ticketTypeId, "ticketTypeId"));
    const ticket = (await getAttendanceTicketType({ id: ticketTypeId })).data.ticketType;
    if (!ticket || validateUUID(ticket.event.id) !== eventId || ticket.audience !== line.ticketType.audience) {
      throw new HttpsError("invalid-argument", "Choose a ticket of the same audience for this event");
    }
    const preferences = ticketPreferences({
      accommodationRequested: line.bookingPlace.attendanceAccommodationRequested,
      accommodationNote: line.bookingPlace.attendanceAccommodationNote,
      seatingPreferences: line.bookingPlace.attendanceSeatingPreferences,
      ...(action === "edit" ? request.data : {}),
    });
    await updateTicketAttendance({
      ...preferences,
      bookingId: line.booking.id, placeId: line.bookingPlace.id, version, ticketTypeId,
      name: text(request.data.attendeeName, "attendee name", 200, true),
      dietaryNote: text(request.data.dietaryNote ?? "", "dietary requirements", 2000),
      removed: action === "delete", actor: request.auth!.uid,
    });
    return { success: true };
  } catch (error) {
    if (String(error).includes("ATTENDANCE_CONFLICT")) {
      throw new HttpsError("failed-precondition", "The ticket changed. Refresh and try again.");
    }
    handleFunctionError(error, "Unable to update ticket");
  }
});

// The member-ticket manager is also available to section moderators, who cannot
// use the admin-only browser connector queries directly.
export const getManagedEventTickets = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    requireEnabled(request);
    const eventId = validateUUID(requireString(request.data?.eventId, "eventId"));
    await enforceRateLimit("getManagedEventTickets", request.auth!.uid);
    const event = (await getAttendeeEventSection({ eventId })).data.event;
    if (!event) throw new HttpsError("not-found", "Event not found");
    await requireSectionModerator(event.section.id, request.auth!.uid, request.auth!.token.admin === true);
    const [bookings, detail] = await Promise.all([
      listEventBookingsForAdmin({ eventId }), getEventById({ id: eventId }),
    ]);
    const seatingIds = Array.from(new Set((bookings.data.event?.bookings ?? []).flatMap((booking) => booking.sitNextToUserIds ?? [])));
    const seatingUsers = [];
    for (let offset = 0; offset < seatingIds.length; offset += 100) {
      seatingUsers.push(...(await listUserNamesByIds({ ids: seatingIds.slice(offset, offset + 100) })).data.users);
    }
    return { seatingUsers, bookings: bookings.data.event?.bookings ?? [],
      orders: bookings.data.event?.bookingTicketOrders ?? [],
      ticketTypes: detail.data.event?.ticketTypes ?? [] };
  } catch (error) {
    handleFunctionError(error, "Unable to load tickets");
  }
});
