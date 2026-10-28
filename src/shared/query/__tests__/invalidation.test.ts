import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

const bookingQueryMocks = vi.hoisted(() => ({
  getMyBookingsForEventRef: vi.fn((dataConnect, variables) => ({dataConnect, variables, name: "GetMyBookingsForEvent"})),
  getMyBookingsRef: vi.fn(dataConnect => ({dataConnect, name: "GetMyBookings"})),
  getMyTicketOrdersRef: vi.fn(dataConnect => ({dataConnect, name: "GetMyTicketOrders"})),
  getMyBookingPaymentAdjustmentsRef: vi.fn(dataConnect => ({dataConnect, name: "GetMyBookingPaymentAdjustments"})),
}));

vi.mock("@dataconnect/generated", () => bookingQueryMocks);
vi.mock("../../../config/firebase", () => ({ dataConnect: { mocked: true } }));
vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
}));

import { executeQuery } from "firebase/data-connect";

import {
  invalidateAnnouncementPreferences,
  invalidateMyBookings,
  invalidateSectionsForUser,
  invalidateUserSectionAccess,
  refreshMyBookingsFromServer,
} from "../invalidation";

function queryClientWithInvalidateSpy() {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return {
    queryClient: { invalidateQueries, cancelQueries: vi.fn().mockResolvedValue(undefined) } as unknown as QueryClient,
    invalidateQueries,
  };
}

describe("cross-view query invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates aggregate and section announcement preferences", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateAnnouncementPreferences(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyAnnouncementPreferences"], refetchType: "all" }, {throwOnError: true});
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetSectionAnnouncementOptOut"], refetchType: "all" }, {throwOnError: true});
  });

  it("invalidates access, navigation and preferences derived from group membership", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateUserSectionAccess(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetUserAccessGroups"], refetchType: "all" }, {throwOnError: true});
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyAnnouncementPreferences"], refetchType: "all" }, {throwOnError: true});
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetSectionsForUser"], refetchType: "all" }, {throwOnError: true});
  });

  it("invalidates persistent section navigation", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateSectionsForUser(queryClient);

    for (const name of ["ListSections", "GetMyAnnouncementPreferences", "GetSectionById", "GetUserAccessGroups"]) {
      expect(invalidateQueries).toHaveBeenCalledWith({queryKey: [name], refetchType: "all"}, {throwOnError: true});
    }
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetSectionsForUser"], refetchType: "all" }, {throwOnError: true});
  });

  it("refetches an active generated-query key and exposes the updated navigation data", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["GetSectionsForUser", { uid: "user-1" }] as const;
    let serverSections = ["Existing Section"];
    const queryFn = vi.fn(async () => [...serverSections]);

    await queryClient.fetchQuery({ queryKey, queryFn, staleTime: Number.POSITIVE_INFINITY });
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn,
      staleTime: Number.POSITIVE_INFINITY,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    serverSections = ["Existing Section", "New Section"];
    await invalidateSectionsForUser(queryClient);

    expect(observer.getCurrentResult().data).toEqual(["Existing Section", "New Section"]);
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
    queryClient.clear();
  });

  it("invalidates every member booking and payment view", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateMyBookings(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookings"], refetchType: "all" }, {throwOnError: true});
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookingsForEvent"], refetchType: "all" }, {throwOnError: true});
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyTicketOrders"], refetchType: "all" }, {throwOnError: true});
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookingPaymentAdjustments"], refetchType: "all" }, {throwOnError: true});
  });

  it("bypasses the Data Connect cache after a callable booking write", async () => {
    const queryClient = new QueryClient();
    const eventBookings = { user: { bookings: [{ id: "booking-1" }], bookingTicketOrders: [] } };
    const allBookings = { user: { bookings: [{ id: "booking-1" }] } };
    const ticketOrders = { user: { ticketOrders: [{ id: "order-1" }] } };
    const paymentAdjustments = { user: { bookings: [] } };
    const values: Record<string, unknown> = {GetMyBookingsForEvent: eventBookings, GetMyBookings: allBookings, GetMyTicketOrders: ticketOrders, GetMyBookingPaymentAdjustments: paymentAdjustments};
    vi.mocked(executeQuery).mockImplementation(async ref => ({data: values[ref.name]} as never));

    const result = await refreshMyBookingsFromServer(queryClient, "event-1");

    expect(result).toEqual(eventBookings);
    expect(bookingQueryMocks.getMyBookingsForEventRef).toHaveBeenCalledWith({mocked: true}, {eventId: "event-1"});
    expect(executeQuery).toHaveBeenCalledTimes(4);
    for (const [, options] of vi.mocked(executeQuery).mock.calls) expect(options).toEqual({fetchPolicy: "SERVER_ONLY"});
    expect(queryClient.getQueryData(["GetMyBookingsForEvent", { eventId: "event-1" }])).toEqual(eventBookings);
    expect(queryClient.getQueryData(["GetMyBookings", null])).toEqual(allBookings);
    expect(queryClient.getQueryData(["GetMyTicketOrders", null])).toEqual(ticketOrders);
    expect(queryClient.getQueryData(["GetMyBookingPaymentAdjustments", null])).toEqual(paymentAdjustments);
    queryClient.clear();
  });
});
