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
/** A committed-result writer must not replace a read started after its write. */
export function captureDataConnectReadGeneration<Data, Variables>(ref: QueryRef<Data, Variables>) {
  const key = hashKey(dataConnectQueryKey(ref));
  const generation = generations.get(ref.dataConnect)?.get(key) ?? 0;
  return () => {
    if ((generations.get(ref.dataConnect)?.get(key) ?? 0) !== generation) throw new DataConnectReadSupersededError();
  };
}
/** Fence SDK work even when its underlying transport ignores cancellation. */
export function supersedeDataConnectQueryReads<Data, Variables>(ref: QueryRef<Data, Variables>) {
  return nextRead(ref);
}
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
interface RefreshExecution {
  assertOwner: () => void;
  fence?: ReadFence;
  signal?: AbortSignal;
}
// TanStack keeps one signal for a fetch and all its retries, but observers can
// replace its queryFn between attempts. Follow that fetch, not a particular
// queryFn, so a retry retains the explicit refresh's owner and latest fence.
const refreshExecutions = new WeakMap<AbortSignal, RefreshExecution>();
function serverQueryOptions<Data, Variables>(ref: QueryRef<Data, Variables>, explicit?: () => RefreshExecution | undefined) {
  return queryOptions({
    queryKey: dataConnectQueryKey(ref),
    queryFn: ({ signal }) => {
      const proposed = explicit?.();
      const execution = proposed && (!proposed.signal || proposed.signal === signal)
        ? proposed : refreshExecutions.get(signal);
      // Bind before the session boundary can wait. A distinct fetch that starts
      // before the outer refresh settles must not inherit this execution.
      if (execution) {
        execution.signal = signal;
        refreshExecutions.set(signal, execution);
      }
      return runSessionRead(() => {
        execution?.assertOwner();
        execution?.fence?.assertLatest();
        const fence = {assertLatest: nextRead(ref), epoch: authorizationReadEpoch()};
        if (execution) execution.fence = fence;
        return readServer(ref, fence.assertLatest);
      }, undefined, signal);
    },
  });
}

/** Compatible with generated query keys; only actual executions read the server. */
export function dataConnectQueryOptions<Data, Variables>(ref: QueryRef<Data, Variables>) {
  return serverQueryOptions(ref);
}

/** Explicit Refresh/post-write read: cancel older work, refresh both caches, and
 * reject failures or superseded results instead of reporting stale success. */
export async function refreshDataConnectQuery<Data, Variables>(client: QueryClient, ref: QueryRef<Data, Variables>): Promise<Data> {
  // Cache notifications can synchronously retire the session or finish an own-
  // authority update. Never recapture that replacement as this refresh's owner.
  const session = captureSession();
  const epoch = authorizationReadEpoch();
  const assertOwner = () => {
    assertSessionCurrent(session);
    if (epoch !== authorizationReadEpoch()) throw new SessionChangedError();
  };
  assertOwner();
  // Admin event/ticket writes converge on these explicit server refreshes.
  // Retire member summaries first, including when the subsequent read fails.
  if (ref.name === "GetEventsForSection" || ref.name === "GetEventById") {
    removeSectionEventSummaries(client);
  }
  assertOwner();
  const execution: RefreshExecution = {assertOwner};
  let active = true;
  let data: Data;
  try {
    data = await runSessionRead(async () => {
      assertOwner();
      const assertNotReplaced = nextRead(ref);
      await client.cancelQueries({ queryKey: dataConnectQueryKey(ref), exact: true });
      assertOwner();
      await client.invalidateQueries({queryKey: dataConnectQueryKey(ref), exact: true, refetchType: "none"});
      assertOwner();
      assertNotReplaced();
      // Register the real queryFn even for a never-mounted query. Later cached
      // inactive invalidation must have an authoritative function to execute.
      return client.fetchQuery({...serverQueryOptions(ref, () => {
        // TanStack retains this queryFn for later inactive refetches. Only this
        // explicit refresh belongs to the captured owner; future executions
        // receive their own session/authority checks from runSessionRead.
        return active ? execution : undefined;
      }), staleTime: 0});
    }, session);
  } catch (error) {
    assertOwner();
    if (error instanceof SessionChangedError) throw error;
    execution.fence?.assertLatest();
    throw error;
  } finally {
    active = false;
    if (execution.signal) refreshExecutions.delete(execution.signal);
  }
  assertOwner();
  const fence = execution.fence;
  if (!fence) throw new DataConnectReadSupersededError();
  // TanStack can resolve a canceled fetch with its reverted cached value. That
  // is not a completed authoritative read, even if no newer read was started.
  if (execution.signal?.aborted) throw new DataConnectReadSupersededError();
  if (privateReadsBlocked(session) || fence.epoch !== authorizationReadEpoch()) throw new SessionChangedError();
  fence.assertLatest();
  return data;
}
