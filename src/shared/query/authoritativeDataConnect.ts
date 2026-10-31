import { hashKey, queryOptions, type QueryClient } from "@tanstack/react-query";
import { executeQuery, type DataConnect, type QueryRef } from "firebase/data-connect";
import { assertSessionCurrent, captureSession, runSessionRead, SessionChangedError } from "../appShell/sessionLifecycle";
import { authorizationReadEpoch, privateReadsBlocked } from "../auth/authorizationUpdate";
import { withTimeout } from "../utils/withTimeout";
import { removeSectionEventSummaries } from "./sectionEventSummaryCache";

// SERVER_ONLY refreshes the SDK cache too. TanStack still supplies the ordinary
// bounded staleTime cache; a real refetch must never fall back to SDK cache.
export const SERVER_ONLY_QUERY_OPTIONS = { fetchPolicy: "SERVER_ONLY" } as const;
export const AUTHORITATIVE_QUERY_TIMEOUT_MS = 30_000;
export class DataConnectReadSupersededError extends Error {
  readonly code = "data-connect-read-superseded";
  constructor() {
    super("A newer server refresh replaced this read.");
    this.name = "DataConnectReadSupersededError";
  }
}
const generations = new WeakMap<DataConnect, Map<string, number>>();
export const dataConnectQueryKey = <Data, Variables>(ref: QueryRef<Data, Variables>) =>
  [ref.name, ref.variables ?? null] as const;
function nextRead<Data, Variables>(ref: QueryRef<Data, Variables>) {
  let scope = generations.get(ref.dataConnect);
  if (!scope) { scope = new Map(); generations.set(ref.dataConnect, scope); }
  const key = hashKey(dataConnectQueryKey(ref));
  const generation = (scope.get(key) ?? 0) + 1;
  scope.set(key, generation);
  return () => {
    if (scope.get(key) !== generation) throw new DataConnectReadSupersededError();
  };
}
async function readServer<Data, Variables>(ref: QueryRef<Data, Variables>, assertLatest: () => void) {
  const result = await withTimeout(executeQuery(ref, SERVER_ONLY_QUERY_OPTIONS),
    AUTHORITATIVE_QUERY_TIMEOUT_MS, "The server refresh timed out");
  assertLatest();
  return result.data;
}

interface ReadFence { assertLatest: () => void; epoch: number }
function serverQueryOptions<Data, Variables>(ref: QueryRef<Data, Variables>, started?: (fence: ReadFence) => void) {
  return queryOptions({
    queryKey: dataConnectQueryKey(ref),
    queryFn: ({ signal }) => runSessionRead(() => {
      const fence = {assertLatest: nextRead(ref), epoch: authorizationReadEpoch()};
      started?.(fence);
      return readServer(ref, fence.assertLatest);
    }, undefined, signal),
  });
}

/** Compatible with generated query keys; only actual executions read the server. */
export function dataConnectQueryOptions<Data, Variables>(ref: QueryRef<Data, Variables>) {
  return serverQueryOptions(ref);
}

/** Explicit Refresh/post-write read: cancel older work, refresh both caches, and
 * reject failures or superseded results instead of reporting stale success. */
export async function refreshDataConnectQuery<Data, Variables>(client: QueryClient, ref: QueryRef<Data, Variables>): Promise<Data> {
  // Admin event/ticket writes converge on these explicit server refreshes.
  // Retire member summaries first, including when the subsequent read fails.
  if (ref.name === "GetEventsForSection" || ref.name === "GetEventById") {
    removeSectionEventSummaries(client);
  }
  const session = captureSession();
  let fence: ReadFence | undefined;
  let data: Data;
  try {
    data = await runSessionRead(async () => {
      const assertNotReplaced = nextRead(ref);
      await client.cancelQueries({ queryKey: dataConnectQueryKey(ref), exact: true });
      assertSessionCurrent(session);
      await client.invalidateQueries({queryKey: dataConnectQueryKey(ref), exact: true, refetchType: "none"});
      assertSessionCurrent(session);
      assertNotReplaced();
      // Register the real queryFn even for a never-mounted query. Later cached
      // inactive invalidation must have an authoritative function to execute.
      return client.fetchQuery({...serverQueryOptions(ref, value => { fence = value; }), staleTime: 0});
    }, session);
  } catch (error) {
    assertSessionCurrent(session);
    if (error instanceof SessionChangedError) throw error;
    fence?.assertLatest();
    throw error;
  }
  assertSessionCurrent(session);
  if (!fence) throw new DataConnectReadSupersededError();
  if (privateReadsBlocked(session) || fence.epoch !== authorizationReadEpoch()) throw new SessionChangedError();
  fence.assertLatest();
  return data;
}
