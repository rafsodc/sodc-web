import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

const bookingQueryMocks = vi.hoisted(() => ({
  getMyBookingsForEvent: vi.fn(),
  getMyBookings: vi.fn(),
  getMyTicketOrders: vi.fn(),
  getMyBookingPaymentAdjustments: vi.fn(),
}));

vi.mock("@dataconnect/generated", () => bookingQueryMocks);
vi.mock("../../../config/firebase", () => ({ dataConnect: { mocked: true } }));
vi.mock("firebase/data-connect", () => ({
  QueryFetchPolicy: { SERVER_ONLY: "SERVER_ONLY" },
}));

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
    queryClient: { invalidateQueries } as unknown as QueryClient,
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

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyAnnouncementPreferences"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetSectionAnnouncementOptOut"] });
  });

  it("invalidates both sources of section membership", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateUserSectionAccess(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetUserAccessGroups"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetSectionsForUser"] });
  });

  it("invalidates persistent section navigation", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateSectionsForUser(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetSectionsForUser"] });
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

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookings"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookingsForEvent"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyTicketOrders"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookingPaymentAdjustments"] });
  });

  it("bypasses the Data Connect cache after a callable booking write", async () => {
    const queryClient = new QueryClient();
    const eventBookings = { user: { bookings: [{ id: "booking-1" }], bookingTicketOrders: [] } };
    const allBookings = { user: { bookings: [{ id: "booking-1" }] } };
    const ticketOrders = { user: { ticketOrders: [{ id: "order-1" }] } };
    const paymentAdjustments = { user: { bookings: [] } };
    bookingQueryMocks.getMyBookingsForEvent.mockResolvedValue({ data: eventBookings });
    bookingQueryMocks.getMyBookings.mockResolvedValue({ data: allBookings });
    bookingQueryMocks.getMyTicketOrders.mockResolvedValue({ data: ticketOrders });
    bookingQueryMocks.getMyBookingPaymentAdjustments.mockResolvedValue({ data: paymentAdjustments });

    const result = await refreshMyBookingsFromServer(queryClient, "event-1");

    expect(result).toEqual(eventBookings);
    expect(bookingQueryMocks.getMyBookingsForEvent).toHaveBeenCalledWith(
      { mocked: true },
      { eventId: "event-1" },
      { fetchPolicy: "SERVER_ONLY" },
    );
    for (const query of [
      bookingQueryMocks.getMyBookings,
      bookingQueryMocks.getMyTicketOrders,
      bookingQueryMocks.getMyBookingPaymentAdjustments,
    ]) {
      expect(query).toHaveBeenCalledWith({ mocked: true }, { fetchPolicy: "SERVER_ONLY" });
    }
    expect(queryClient.getQueryData(["GetMyBookingsForEvent", { eventId: "event-1" }])).toEqual(eventBookings);
    expect(queryClient.getQueryData(["GetMyBookings", null])).toEqual(allBookings);
    expect(queryClient.getQueryData(["GetMyTicketOrders", null])).toEqual(ticketOrders);
    expect(queryClient.getQueryData(["GetMyBookingPaymentAdjustments", null])).toEqual(paymentAdjustments);
    queryClient.clear();
  });
});
