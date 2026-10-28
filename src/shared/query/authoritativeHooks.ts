import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { DataConnect, QueryRef } from "firebase/data-connect";
import {
  getCurrentUserRef,
  getEventsForSectionRef,
  getEventByIdRef,
  getMyBookingsRef,
  getMyBookingsForEventRef,
  getMyTicketOrdersRef,
  getMyTicketOrderByIdRef,
  getMyBookingPaymentAdjustmentsRef,
  getMyAnnouncementPreferencesRef,
  getSectionAnnouncementOptOutRef,
  getSectionsForUserRef,
  getUserAccessGroupsRef,
  listSectionsRef,
  listEventBookingsForAdminRef,
  listTicketOrdersForAdminRef,
  listBookingPaymentAdjustmentsForAdminRef,
  listUserNamesByIdsRef,
  listOpenPaymentReconciliationExceptionsRef,
} from "@dataconnect/generated";
import { dataConnectQueryOptions } from "./authoritativeDataConnect";

type ReadKey<Variables> = readonly [string, NonNullable<Variables> | null];
type ReadOptions<Data, Variables> = Omit<UseQueryOptions<Data, Error, Data, ReadKey<Variables>>, "queryKey" | "queryFn">;

// These app-owned readers share generated keys and TanStack's bounded cache.
// A real fetch/refetch always reaches the server through the session boundary.
function withoutVariables<Data, Variables>(createRef: (dc: DataConnect) => QueryRef<Data, Variables>) {
  return function useAuthoritativeRead(dc: DataConnect, options?: ReadOptions<Data, Variables>) {
    return useQuery({ ...dataConnectQueryOptions(createRef(dc)), ...options });
  };
}
function withVariables<Data, Variables>(createRef: (dc: DataConnect, variables: Variables) => QueryRef<Data, Variables>) {
  return function useAuthoritativeRead(dc: DataConnect, variables: Variables, options?: ReadOptions<Data, Variables>) {
    return useQuery({ ...dataConnectQueryOptions(createRef(dc, variables)), ...options });
  };
}

export const useGetCurrentUser = withoutVariables(getCurrentUserRef);
export const useGetSectionsForUser = withoutVariables(getSectionsForUserRef);
export const useGetUserAccessGroups = withoutVariables(getUserAccessGroupsRef);
export const useListSections = withoutVariables(listSectionsRef);
export const useGetMyBookings = withoutVariables(getMyBookingsRef);
export const useGetMyTicketOrders = withoutVariables(getMyTicketOrdersRef);
export const useGetMyBookingPaymentAdjustments = withoutVariables(getMyBookingPaymentAdjustmentsRef);
export const useGetMyAnnouncementPreferences = withoutVariables(getMyAnnouncementPreferencesRef);
export const useGetMyBookingsForEvent = withVariables(getMyBookingsForEventRef);
export const useGetMyTicketOrderById = withVariables(getMyTicketOrderByIdRef);
export const useGetSectionAnnouncementOptOut = withVariables(getSectionAnnouncementOptOutRef);
export const useGetEventsForSection = withVariables(getEventsForSectionRef);
export const useGetEventById = withVariables(getEventByIdRef);
export const useListEventBookingsForAdmin = withVariables(listEventBookingsForAdminRef);
export const useListTicketOrdersForAdmin = withVariables(listTicketOrdersForAdminRef);
export const useListBookingPaymentAdjustmentsForAdmin = withVariables(listBookingPaymentAdjustmentsForAdminRef);
export const useListUserNamesByIds = withVariables(listUserNamesByIdsRef);
export const useListOpenPaymentReconciliationExceptions = withoutVariables(listOpenPaymentReconciliationExceptionsRef);
