import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
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

  it("invalidates the global My Bookings list", async () => {
    const { queryClient, invalidateQueries } = queryClientWithInvalidateSpy();

    await invalidateMyBookings(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["GetMyBookings"] });
  });
});
