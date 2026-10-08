import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  getEventById,
  getEventsForSection,
  listBookingPaymentAdjustmentsForAdmin,
  listEventBookingsForAdmin,
  listTicketOrdersForAdmin,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, validateUUID } from "./helpers";
import { requireSectionModerator } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";

export const getEventAdministrationData = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  requireEnabled(request);
  const callerUid = request.auth!.uid;
  await enforceRateLimit("getEventAdministrationData", callerUid);
  const sectionId = validateUUID(String(request.data?.sectionId), "sectionId") as UUIDString;
  await requireSectionModerator(sectionId, callerUid, request.auth!.token?.admin === true);
  const eventsResult = await getEventsForSection({ sectionId });
  const eventIdRaw = request.data?.eventId;
  if (!eventIdRaw) {
    return { events: eventsResult.data?.section?.events ?? [] };
  }
  const eventId = validateUUID(String(eventIdRaw), "eventId") as UUIDString;
  const [eventResult, bookingsResult, ordersResult, adjustmentsResult] = await Promise.all([
    getEventById({ id: eventId }),
    listEventBookingsForAdmin({ eventId }),
    listTicketOrdersForAdmin({ eventId }),
    listBookingPaymentAdjustmentsForAdmin({ eventId }),
  ]);
  const event = eventResult.data?.event;
  if (!event || event.section.id.replace(/-/g, "").toLowerCase() !== sectionId.replace(/-/g, "").toLowerCase()) {
    throw new HttpsError("not-found", "Event not found");
  }
  return {
    events: eventsResult.data?.section?.events ?? [],
    event,
    eventBookings: bookingsResult.data?.event ?? null,
    ticketOrders: ordersResult.data?.event ?? null,
    paymentAdjustments: adjustmentsResult.data?.event ?? null,
  };
});
