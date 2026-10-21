import { captureSession, assertSessionCurrent } from "../appShell/sessionLifecycle";
import type { QueryClient } from "@tanstack/react-query";
import type { UUIDString } from "./sessionDataConnect";
import {
  getMyBookingPaymentAdjustments,
  getMyBookings,
  getMyBookingsForEvent,
  getMyTicketOrders,
} from "./sessionDataConnect";
import { QueryFetchPolicy } from "firebase/data-connect";
import { dataConnect } from "../../config/firebase";

/**
 * Data Connect's generated React mutations do not know which other generated
 * queries represent the same server state. Keep cross-view invalidation in one
 * place so direct SDK mutations and callable functions behave consistently.
 */
export async function invalidateAnnouncementPreferences(queryClient: QueryClient) {
  assertSessionCurrent(captureSession());
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["GetMyAnnouncementPreferences"] }),
    queryClient.invalidateQueries({ queryKey: ["GetSectionAnnouncementOptOut"] }),
  ]);
}

export async function invalidateUserSectionAccess(queryClient: QueryClient) {
  assertSessionCurrent(captureSession());
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["GetUserAccessGroups"] }),
    queryClient.invalidateQueries({ queryKey: ["GetSectionsForUser"] }),
  ]);
}

export async function invalidateSectionsForUser(queryClient: QueryClient) {
  assertSessionCurrent(captureSession());
  await queryClient.invalidateQueries({ queryKey: ["GetSectionsForUser"] });
}

export async function invalidateMyBookings(queryClient: QueryClient) {
  assertSessionCurrent(captureSession());
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["GetMyBookings"] }),
    queryClient.invalidateQueries({ queryKey: ["GetMyBookingsForEvent"] }),
    queryClient.invalidateQueries({ queryKey: ["GetMyTicketOrders"] }),
    queryClient.invalidateQueries({ queryKey: ["GetMyBookingPaymentAdjustments"] }),
  ]);
}

/**
 * Callable booking writes bypass the browser Data Connect client. Refresh both
 * Data Connect's internal cache and TanStack Query from the server so a normal
 * refetch cannot return the pre-callable cached result.
 */
export async function refreshMyBookingsFromServer(
  queryClient: QueryClient,
  eventId: UUIDString
) {
  const session = captureSession();
  assertSessionCurrent(session);
  const serverOnly = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY } as const;
  const eventBookings = await getMyBookingsForEvent(dataConnect, { eventId }, serverOnly);
  assertSessionCurrent(session);
  queryClient.setQueryData(["GetMyBookingsForEvent", { eventId }], { ...eventBookings.data });

  const [allBookings, ticketOrders, paymentAdjustments] = await Promise.all([
    getMyBookings(dataConnect, serverOnly),
    getMyTicketOrders(dataConnect, serverOnly),
    getMyBookingPaymentAdjustments(dataConnect, serverOnly),
  ]);

  assertSessionCurrent(session);
  queryClient.setQueryData(["GetMyBookings", null], { ...allBookings.data });
  queryClient.setQueryData(["GetMyTicketOrders", null], { ...ticketOrders.data });
  queryClient.setQueryData(
    ["GetMyBookingPaymentAdjustments", null],
    { ...paymentAdjustments.data }
  );

  return eventBookings.data;
}
