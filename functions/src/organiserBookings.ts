import { currentAuthorization } from "./currentAuthorization";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getEventByIdForCallable, getSectionByIdForCallable, getUserMembershipStatus, getUserUserGroupsForAdmin, getBookingsForBookerAndEvent } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, requireString, validateUUID, handleFunctionError } from "./helpers";
import { requireSectionModerator } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";
import { evaluateBookingGatekeeping, userMatchesUserGroup } from "./bookingRules";

export function managedBookerId(value: unknown): string {
  const id = requireString(value, "bookerId").trim();
  if (!id || id.length > 128) throw new HttpsError("invalid-argument", "Invalid bookerId");
  return id;
}

export async function requireManagedBookingEvent(eventId: string, actorId: string, isAdmin: boolean) {
  const event = (await getEventByIdForCallable({ id: eventId })).data.event;
  if (!event) throw new HttpsError("not-found", "Event not found");
  await requireSectionModerator(event.section.id, actorId, isAdmin);
  return event;
}

/** Only organisers can read another user's booking and eligibility for this event. */
export const getManagedBookingContext = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    await requireEnabled(request);
    await enforceRateLimit("getManagedBookingContext", request.auth!.uid);
    const eventId = validateUUID(requireString(request.data?.eventId, "eventId"));
    const bookerId = managedBookerId(request.data?.bookerId);
    const event = await requireManagedBookingEvent(eventId, request.auth!.uid, currentAuthorization(request).isAdmin);
    const [profile, groups, section, bookings] = await Promise.all([
      getUserMembershipStatus({ id: bookerId }),
      getUserUserGroupsForAdmin({ userId: bookerId }),
      getSectionByIdForCallable({ id: event.section.id }),
      getBookingsForBookerAndEvent({ bookerId, eventId }),
    ]);
    const user = profile.data.user;
    if (!user || !section.data.section) throw new HttpsError("not-found", "User or section not found");
    const explicitGroupIds = new Set((groups.data.user?.userGroups ?? []).map((g) => validateUUID(g.userGroup.id)));
    const purposeLinks = (section.data.section.purposeLinks ?? []).map((link) => ({
      ...link, userGroup: { ...link.userGroup, id: validateUUID(link.userGroup.id) },
    }));
    const gate = evaluateBookingGatekeeping({
      purposeLinks, membershipStatus: user.membershipStatus, explicitGroupIds,
      bookingStartDateTime: event.bookingStartDateTime, bookingEndDateTime: event.bookingEndDateTime,
      organiserBooking: true,
    });
    if (!gate.ok) throw new HttpsError("failed-precondition", gate.message, { code: gate.code });
    const booking = (bookings.data.user?.bookings ?? [])
      .filter((b) => ["SUBMITTED", "CONFIRMED"].includes(b.status))
      .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
    return {
      user: { id: bookerId, ...user },
      ticketTypes: (event.ticketTypes ?? []).filter((ticket) =>
        ["MEMBER", "GUEST"].includes(ticket.audience) && userMatchesUserGroup(user.membershipStatus,
          { ...ticket.userGroup, id: validateUUID(ticket.userGroup.id) }, explicitGroupIds)
      ).map(({ id, title, audience, price }) => ({ id, title, audience, price })),
      booking: booking ? {
        id: booking.id, revisionNumber: booking.revisionNumber, approvalStatus: booking.approvalStatus,
        sitNextToUserIds: booking.sitNextToUserIds ?? [], accommodationRequested: booking.accommodationRequested,
        accommodationNote: booking.accommodationNote ?? null,
        lines: booking.lines.map((line) => ({
          ticketTypeId: line.ticketType.id, sortOrder: line.sortOrder, guestUserId: line.guestUser?.id ?? null,
          guestDisplayName: line.guestDisplayName ?? null, dietaryNote: line.dietaryNote ?? null,
        })),
      } : null,
    };
  } catch (error) {
    handleFunctionError(error, "Unable to load booking");
  }
});
