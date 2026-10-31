import { assertSessionCurrent, captureSession, runSessionRead } from "../appShell/sessionLifecycle";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { UUIDString } from "./sessionDataConnect";
import {
  getMyBookingPaymentAdjustmentsRef,
  getMyBookingsRef,
  getMyBookingsForEventRef,
  getMyTicketOrdersRef,
} from "./sessionDataConnect";
import { refreshDataConnectQuery } from "./authoritativeDataConnect";
import { removeSectionEventSummaries } from "./sectionEventSummaryCache";
import { dataConnect } from "../../config/firebase";

/**
 * Data Connect's generated React mutations do not know which other generated
 * queries represent the same server state. Keep cross-view invalidation in one
 * place so direct SDK mutations and callable functions behave consistently.
 * Affected readers use dataConnectQueryOptions, so active and inactive cached
 * views get a real server read. Cancel old work and propagate partial failures.
 */
export function invalidateDataConnectQueries(queryClient: QueryClient, queryKeys: readonly QueryKey[]) {
  const session = captureSession();
  return runSessionRead(async () => {
    await Promise.all(queryKeys.map(queryKey => queryClient.cancelQueries({ queryKey })));
    assertSessionCurrent(session);
    await Promise.all(queryKeys.map(queryKey => queryClient.invalidateQueries(
      { queryKey, refetchType: "all" }, { throwOnError: true },
    )));
  }, session);
}
export function invalidateAnnouncementPreferences(queryClient: QueryClient) {
  return invalidateDataConnectQueries(queryClient, [["GetMyAnnouncementPreferences"], ["GetSectionAnnouncementOptOut"]]);
}
// Group membership/purpose links also determine the aggregate preference section list.
export function invalidateUserSectionAccess(queryClient: QueryClient) {
  // Access changes retire summaries before any fallible server revalidation.
  // A failed navigation refresh must not leave a previously allowed list fresh.
  removeSectionEventSummaries(queryClient);
  return invalidateDataConnectQueries(queryClient, [["GetUserAccessGroups"], ["GetSectionsForUser"], ["GetMyAnnouncementPreferences"]]);
}
// Section metadata is repeated in navigation, admin lists, details and preference links.
export function invalidateSectionsForUser(queryClient: QueryClient) {
  removeSectionEventSummaries(queryClient);
  return invalidateDataConnectQueries(queryClient, [["GetSectionsForUser"], ["ListSections"], ["GetMyAnnouncementPreferences"], ["GetSectionById"], ["GetUserAccessGroups"]]);
}
export function invalidateMyBookings(queryClient: QueryClient) {
  removeSectionEventSummaries(queryClient);
  return invalidateDataConnectQueries(queryClient, [["GetMyBookings"], ["GetMyBookingsForEvent"], ["GetMyTicketOrders"], ["GetMyBookingPaymentAdjustments"]]);
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
  // Retire list/bundle seeds even when the first booking refresh fails.
  removeSectionEventSummaries(queryClient);
  const session = captureSession();
  return runSessionRead(async () => {
    const eventBookings = await refreshDataConnectQuery(queryClient, getMyBookingsForEventRef(dataConnect, { eventId }));
    assertSessionCurrent(session);
    await Promise.all([
      refreshDataConnectQuery(queryClient, getMyBookingsRef(dataConnect)),
      refreshDataConnectQuery(queryClient, getMyTicketOrdersRef(dataConnect)),
      refreshDataConnectQuery(queryClient, getMyBookingPaymentAdjustmentsRef(dataConnect)),
    ]);
    return eventBookings;
  }, session);
}
