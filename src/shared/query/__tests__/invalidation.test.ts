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
import { SECTION_EVENT_SUMMARIES_KEY, captureSectionEventSummaryRead, rememberSectionEventSummaries } from "../sectionEventSummaryCache";

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
    queryClient: { invalidateQueries, cancelQueries: vi.fn().mockResolvedValue(undefined), removeQueries: vi.fn() } as unknown as QueryClient,
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

  it.each([
    ["access changes", invalidateUserSectionAccess],
    ["section changes", invalidateSectionsForUser],
    ["booking changes", invalidateMyBookings],
  ] as const)("retires summaries before %s revalidation, even when that refresh fails", async (_label, invalidate) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const summaryKey = [...SECTION_EVENT_SUMMARIES_KEY, "member-a", 1, 0, "section-a"];
    const otherOwnerKey = [...SECTION_EVENT_SUMMARIES_KEY, "member-b", 2, 1, "section-b"];
    queryClient.setQueryData(summaryKey, { events: [{ title: "Before change" }] });
    queryClient.setQueryData(otherOwnerKey, { events: [] });
    queryClient.setQueryData(["unrelated"], "preserved");
    const pendingBundle = captureSectionEventSummaryRead(queryClient, "section-a");
    const failure = new Error("Generated refresh unavailable");
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {
      expect(queryClient.getQueryCache().findAll({ queryKey: SECTION_EVENT_SUMMARIES_KEY })).toHaveLength(0);
      throw failure;
    });

    const refresh = invalidate(queryClient);
    expect(queryClient.getQueryData(summaryKey)).toBeUndefined();
    await expect(refresh).rejects.toBe(failure);
    rememberSectionEventSummaries(queryClient, { events: [] }, pendingBundle);
    expect(queryClient.getQueryCache().findAll({ queryKey: SECTION_EVENT_SUMMARIES_KEY })).toHaveLength(0);
    expect(queryClient.getQueryData(["unrelated"])).toBe("preserved");
    queryClient.clear();
  });

  it.each([true, false])("a late summary cannot restore removed access data (transport observes cancellation=%s)", async observesCancellation => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const summaryKey = [...SECTION_EVENT_SUMMARIES_KEY, "member-a", 1, 0, "section-a"];
    let complete!: (result: { events: string[] }) => void;
    let signal: AbortSignal | undefined;
    const read = vi.fn((context: { signal: AbortSignal }) => {
      if (observesCancellation) signal = context.signal;
      return new Promise<{ events: string[] }>(resolve => { complete = resolve; });
    });
    const pending = queryClient.fetchQuery({ queryKey: summaryKey, queryFn: read }).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());

    await invalidateUserSectionAccess(queryClient);

    if (observesCancellation) expect(signal?.aborted).toBe(true);
    complete({ events: ["Obsolete event"] });
    await pending;
    expect(queryClient.getQueryData(summaryKey)).toBeUndefined();
    queryClient.clear();
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

  it("retires summaries before a booking refresh that fails on its first server read", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const summaryKey = [...SECTION_EVENT_SUMMARIES_KEY, "member-a", 1, 0, "section-a"];
    queryClient.setQueryData(summaryKey, { events: [{ title: "Before booking" }] });
    const pendingBundle = captureSectionEventSummaryRead(queryClient, "section-a");
    const failure = new Error("Booking refresh unavailable");
    vi.mocked(executeQuery).mockRejectedValueOnce(failure);

    const refresh = refreshMyBookingsFromServer(queryClient, "event-1");
    expect(queryClient.getQueryData(summaryKey)).toBeUndefined();
    await expect(refresh).rejects.toBe(failure);
    rememberSectionEventSummaries(queryClient, { events: [] }, pendingBundle);
    expect(queryClient.getQueryCache().findAll({ queryKey: SECTION_EVENT_SUMMARIES_KEY })).toHaveLength(0);
    queryClient.clear();
  });
});
