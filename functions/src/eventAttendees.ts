import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getPublicOrganiserGuestAttendance, getAttendeeEventSection, getEventAttendeeNames, type GetEventAttendeeNamesData } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, requireString, validateUUID, handleFunctionError } from "./helpers";
import { requireSectionAccess } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";

// Legacy guests have a single entered name. Preserve it without inventing a surname.
type NameParts = { firstName: string; lastName: string } | { displayName: string };
type AttendeeName = NameParts & { audience: "MEMBER" | "GUEST"; includesSymposium: boolean; includesDinner: boolean };

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
    const sortName = (name: NameParts) => "lastName" in name ? [name.lastName, name.firstName] : [name.displayName, ""];
    const compareNames = (a: NameParts, b: NameParts) => {
      const [aLast, aFirst] = sortName(a);
      const [bLast, bFirst] = sortName(b);
      return aLast.localeCompare(bLast, "en", { sensitivity: "base" }) || aFirst.localeCompare(bFirst, "en", { sensitivity: "base" });
    };
    const bookings = Array.from(current.values()).sort((a, b) =>
      compareNames(a.booker, b.booker) || a.revisionGroupId.localeCompare(b.revisionGroupId)
    );
    const attendees: AttendeeName[] = [];
    for (const booking of bookings) {
      const group: AttendeeName[] = [];
      for (const line of booking.lines) {
        if (line.ticketType.audience === "ORGANISER_GUEST") continue;
        const user = line.ticketType.audience === "MEMBER" ? booking.booker : line.guestUser;
        const attendance = { audience: line.ticketType.audience as "MEMBER" | "GUEST", includesSymposium: line.ticketType.includesSymposium, includesDinner: line.ticketType.includesDinner };
        if (user) group.push({ firstName: user.firstName, lastName: user.lastName, ...attendance });
        else if (line.guestDisplayName?.trim()) group.push({ displayName: line.guestDisplayName.trim(), ...attendance });
      }
      // Keep every guest with their own booking, even when bookers have identical names.
      group.sort((a, b) => Number(a.audience === "GUEST") - Number(b.audience === "GUEST") || compareNames(a, b));
      attendees.push(...group);
    }
    const organiserGuests: AttendeeName[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data } = await getPublicOrganiserGuestAttendance({ eventId, offset });
      organiserGuests.push(...data.organiserGuests.map(guest => ({ firstName: guest.firstName, lastName: guest.lastName, includesSymposium: guest.includesSymposium, includesDinner: guest.includesDinner, audience: "GUEST" as const })));
      if (data.organiserGuests.length < 500) break;
    }
    attendees.push(...organiserGuests.sort(compareNames));
    return { attendees };
  } catch (error) {
    handleFunctionError(error, "Unable to load attendees");
  }
});
