import type { QueryClient } from "@tanstack/react-query";
import { captureSession, isSessionCurrent, isPrivateSessionSuspended } from "../appShell/sessionLifecycle";
import { authorizationReadEpoch, privateReadsBlocked } from "../auth/authorizationUpdate";
import { toCanonicalUuid } from "../utils/uuid";
import type { SectionEventsForUserResponse } from "../utils/firebaseFunctions/sectionAccess";

export const SECTION_EVENT_SUMMARIES_KEY = ["sectionEventSummaries"] as const;
export const SECTION_EVENT_SUMMARIES_STALE_MS = 30_000;
// Fences only, never payloads. Data lives in the document's existing QueryClient,
// which PrivateSessionBoundary clears when the account or document retires.
const revisions = new WeakMap<QueryClient, number>();
const revision = (client: QueryClient) => revisions.get(client) ?? 0;
const resourceKey = (id: string) => { try { return toCanonicalUuid(id); } catch { return id; } };

export function captureSectionEventSummaryRead(client: QueryClient, sectionId: string) {
  const session = captureSession();
  const epoch = authorizationReadEpoch();
  const version = revision(client);
  const queryKey = [...SECTION_EVENT_SUMMARIES_KEY, session.uid, session.generation, epoch, resourceKey(sectionId)] as const;
  return {
    queryKey,
    dataUpdateCount: client.getQueryState(queryKey)?.dataUpdateCount ?? 0,
    isCurrent: () => isSessionCurrent(session) && !isPrivateSessionSuspended(session) &&
      !privateReadsBlocked(session) && authorizationReadEpoch() === epoch && revision(client) === version,
  };
}
export type SectionEventSummaryRead = ReturnType<typeof captureSectionEventSummaryRead>;

/** Invalidation also fences a page bundle that has not seeded the cache yet. */
export function removeSectionEventSummaries(client: QueryClient) {
  revisions.set(client, revision(client) + 1);
  client.removeQueries({ queryKey: SECTION_EVENT_SUMMARIES_KEY });
}

export function getFreshSectionEventSummaries(client: QueryClient, sectionId: string) {
  const scope = captureSectionEventSummaryRead(client, sectionId);
  if (!scope.isCurrent()) return undefined;
  const state = client.getQueryState<SectionEventsForUserResponse>(scope.queryKey);
  if (!state || state.isInvalidated || state.status !== "success" ||
    Date.now() - state.dataUpdatedAt >= SECTION_EVENT_SUMMARIES_STALE_MS) return undefined;
  return state.data;
}

export function hasPendingSectionEventSummaries(client: QueryClient, sectionId: string) {
  const scope = captureSectionEventSummaryRead(client, sectionId);
  return scope.isCurrent() && client.getQueryState(scope.queryKey)?.fetchStatus === "fetching";
}

export function rememberSectionEventSummaries(
  client: QueryClient, result: SectionEventsForUserResponse, scope: SectionEventSummaryRead,
) {
  // A late bundle cannot restore data invalidated by a save/access change.
  if (!scope.isCurrent()) return;
  // Do not replace a newer dedicated refresh with an older bundled read.
  const current = client.getQueryState(scope.queryKey);
  if (current?.fetchStatus === "fetching" || (current?.dataUpdateCount ?? 0) !== scope.dataUpdateCount) return;
  client.setQueryDefaults(SECTION_EVENT_SUMMARIES_KEY, { gcTime: 5 * 60_000 });
  client.setQueryData(scope.queryKey, result);
}
