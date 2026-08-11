import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  invalidateAnnouncementPreferences,
  invalidateMyBookings,
  invalidateSectionsForUser,
  invalidateUserSectionAccess,
} from "../invalidation";

function queryClientWithInvalidateSpy() {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return {
    queryClient: { invalidateQueries } as unknown as QueryClient,
    invalidateQueries,
  };
}

describe("cross-view query invalidation", () => {
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
});
