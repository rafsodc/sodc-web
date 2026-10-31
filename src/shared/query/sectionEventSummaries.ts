import type { QueryClient } from "@tanstack/react-query";
import { runSessionRead, SessionChangedError } from "../appShell/sessionLifecycle";
import { getSectionEventsForUser } from "../utils/firebaseFunctions";
import {
  captureSectionEventSummaryRead, removeSectionEventSummaries,
  SECTION_EVENT_SUMMARIES_STALE_MS,
} from "./sectionEventSummaryCache";

/** Cache hits pass the same session/authority gate as network reads. Explicit
 * retries bypass the TTL and detach old work; failures never become cached data. */
export function loadSectionEventSummaries(client: QueryClient, sectionId: string, options: { force?: boolean } = {}) {
  return runSessionRead(async () => {
    if (options.force) removeSectionEventSummaries(client);
    const scope = captureSectionEventSummaryRead(client, sectionId);
    const result = await client.fetchQuery({
      queryKey: scope.queryKey,
      queryFn: async () => {
        const data = await getSectionEventsForUser(sectionId);
        if (!scope.isCurrent()) throw new SessionChangedError();
        return data;
      },
      staleTime: SECTION_EVENT_SUMMARIES_STALE_MS,
      gcTime: 5 * 60_000,
      retry: false,
    });
    if (!scope.isCurrent()) throw new SessionChangedError();
    return result;
  });
}
