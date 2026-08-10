import type { QueryClient } from "@tanstack/react-query";

/**
 * Data Connect's generated React mutations do not know which other generated
 * queries represent the same server state. Keep cross-view invalidation in one
 * place so direct SDK mutations and callable functions behave consistently.
 */
export async function invalidateAnnouncementPreferences(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["GetMyAnnouncementPreferences"] }),
    queryClient.invalidateQueries({ queryKey: ["GetSectionAnnouncementOptOut"] }),
  ]);
}

export async function invalidateUserSectionAccess(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["GetUserAccessGroups"] }),
    queryClient.invalidateQueries({ queryKey: ["GetSectionsForUser"] }),
  ]);
}

export async function invalidateSectionsForUser(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["GetSectionsForUser"] });
}

export async function invalidateMyBookings(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["GetMyBookings"] });
}
