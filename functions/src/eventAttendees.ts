import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAttendeeEventSection, getEventAttendeeNames, type GetEventAttendeeNamesData } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, requireString, validateUUID, handleFunctionError } from "./helpers";
import { requireSectionAccess } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";

// Legacy guests have a single entered name. Preserve it without inventing a surname.
type AttendeeName = { firstName: string; lastName: string } | { displayName: string };

export const getEventAttendees = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    requireEnabled(request);
    const eventId = validateUUID(requireString(request.data?.eventId, "eventId"), "eventId");
    await enforceRateLimit("getEventAttendees", request.auth!.uid);
    const { data: eventData } = await getAttendeeEventSection({ eventId });
    if (!eventData.event) throw new HttpsError("not-found", "Resource not found");
    await requireSectionAccess(eventData.event.section.id, request.auth!.uid, request.auth!.token.admin === true);
    const current = new Map<string, GetEventAttendeeNamesData["bookings"][number]>();
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data } = await getEventAttendeeNames({ eventId, limit: pageSize, offset });
      for (const booking of data.bookings) {
        if (booking.supersededAt != null || !["SUBMITTED", "CONFIRMED"].includes(booking.status) ||
            !["NOT_REQUIRED", "APPROVED"].includes(booking.approvalStatus)) continue;
        const previous = current.get(booking.revisionGroupId);
        if (!previous || booking.revisionNumber > previous.revisionNumber) current.set(booking.revisionGroupId, booking);
      }
      if (data.bookings.length < pageSize) break;
    }
    const attendees: AttendeeName[] = [];
    for (const booking of current.values()) {
      for (const line of booking.lines) {
        const user = line.ticketType.audience === "MEMBER" ? booking.booker : line.guestUser;
        if (user) attendees.push({ firstName: user.firstName, lastName: user.lastName });
        else if (line.guestDisplayName?.trim()) attendees.push({ displayName: line.guestDisplayName.trim() });
      }
    }
    const sortName = (name: AttendeeName) => "lastName" in name ? [name.lastName, name.firstName] : [name.displayName, ""];
    attendees.sort((a, b) => {
      const [aLast, aFirst] = sortName(a);
      const [bLast, bFirst] = sortName(b);
      return aLast.localeCompare(bLast, "en", { sensitivity: "base" }) || aFirst.localeCompare(bFirst, "en", { sensitivity: "base" });
    });
    return { attendees };
  } catch (error) {
    handleFunctionError(error, "Unable to load attendees");
  }
});
