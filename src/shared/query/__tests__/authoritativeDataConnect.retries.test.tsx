import { afterEach, describe, expect, it, vi } from "vitest";
import { onlineManager, QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { Code, DataConnectError, executeQuery, getDataConnect, type DataConnect } from "firebase/data-connect";
import { getEventByIdRef } from "@dataconnect/generated";
import { useGetEventById } from "../authoritativeHooks";
import { createAppQueryClient } from "../queryClient";
import { invalidateDataConnectQueries } from "../invalidation";
import {
  dataConnectQueryKey, DataConnectReadSupersededError, refreshDataConnectQuery, supersedeDataConnectQueryReads,
} from "../authoritativeDataConnect";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError } from "../../appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../auth/authorizationUpdate";

// Keep the real application retry policy, mounted hook, QueryClient and SDK.
// Only the physical SDK transport is controlled; no live requests are allowed.
vi.unmock("firebase/data-connect");
type Result = { event: { id: string; title: string } };
type TransportResult = { data: Result; extensions: object };
const eventId = "11111111-1111-4111-8111-111111111111";
const response = (title: string): TransportResult => ({data: {event: {id: eventId, title}}, extensions: {}});
const apps: FirebaseApp[] = [], clients: QueryClient[] = [], releases: Array<() => void> = [];
let nextApp = 0;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return {promise, resolve, reject};
}
function session(queryClient: QueryClient, uid = "member-a") {
  const lifecycle = createSessionLifecycle(); lifecycle.observe(uid);
  releases.push(installSessionRuntime({lifecycle, queryClient, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire()}));
  return lifecycle;
}
function mountedContext(mount = true) {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Unexpected live request"); });
  const client = createAppQueryClient(); clients.push(client);
  const lifecycle = session(client);
  const app = initializeApp({projectId: "refresh-retry-test", apiKey: "fake"}, "refresh-retry-" + nextApp++); apps.push(app);
  const dc = getDataConnect(app, {connector: "test", service: "test", location: "europe-west2"});
  const attempts: Array<ReturnType<typeof deferred<TransportResult>>> = [];
  const transport = vi.fn(() => { const attempt = deferred<TransportResult>(); attempts.push(attempt); return attempt.promise; });
  (dc as DataConnect & {_transportClass: unknown})._transportClass = class {
    invokeQuery = transport;
    _setCallerSdkType() {}
  };
  const ref = getEventByIdRef(dc, {id: eventId}), key = dataConnectQueryKey(ref);
  client.setQueryData(key, response("cached old title").data);
  const hook = mount ? renderHook(() => useGetEventById(dc, {id: eventId}), {
    wrapper: ({children}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  }) : undefined;
  function start() {
    let pending!: Promise<unknown>;
    act(() => { pending = refreshDataConnectQuery(client, ref).catch(error => error); });
    return pending;
  }
  async function failFirst() {
    await waitFor(() => expect(attempts).toHaveLength(1));
    const firstQueryFn = client.getQueryCache().find({queryKey: key})?.options.queryFn;
    await act(async () => { attempts[0].reject(new DataConnectError(Code.OTHER, "first transport failure")); });
    await waitFor(() => expect(hook?.result.current.failureCount).toBe(1));
    // The mounted reader replaces fetchQuery's options while the real retryer
    // waits. This is the production interaction missing from retry:false tests.
    expect(client.getQueryCache().find({queryKey: key})?.options.queryFn).not.toBe(firstQueryFn);
  }
  return {client, lifecycle, dc, ref, key, hook, fetch, attempts, transport, start, failFirst};
}
afterEach(async () => {
  cleanup(); resumeAuthorizationReads(captureSession());
  for (const release of releases.splice(0).reverse()) release();
  for (const client of clients.splice(0)) client.clear();
  onlineManager.setOnline(true);
  await Promise.all(apps.splice(0).map(deleteApp));
  expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("explicit authoritative refresh with mounted readers and application retries", () => {
  it("preserves the final genuine error after a mounted observer replaces the retry query function", async () => {
    const ctx = mountedContext(), pending = ctx.start();
    await ctx.failFirst();
    await waitFor(() => expect(ctx.attempts).toHaveLength(2), {timeout: 3_000});
    const failure = new DataConnectError(Code.OTHER, "second transport failure");
    await act(async () => { ctx.attempts[1].reject(failure); });
    await expect(pending).resolves.toBe(failure);
    expect(ctx.client.getQueryState(ctx.key)?.error).toBe(failure);
    expect(ctx.client.getQueryData(ctx.key)).toEqual(response("cached old title").data);
    expect(ctx.transport).toHaveBeenCalledTimes(2);
  });

  it("returns the authoritative result when the observer-replaced retry succeeds", async () => {
    const ctx = mountedContext(), pending = ctx.start();
    await ctx.failFirst();
    await waitFor(() => expect(ctx.attempts).toHaveLength(2), {timeout: 3_000});
    await act(async () => { ctx.attempts[1].resolve(response("confirmed saved title")); });
    await expect(pending).resolves.toEqual(response("confirmed saved title").data);
    expect(ctx.client.getQueryState(ctx.key)?.status).toBe("success");
    expect(ctx.client.getQueryData(ctx.key)).toEqual(response("confirmed saved title").data);
    expect((await executeQuery(ctx.ref)).data).toEqual(response("confirmed saved title").data);
    expect(ctx.transport).toHaveBeenCalledTimes(2);
  });

  it.each(["session", "epoch", "blocked"] as const)("does not dispatch the retry after the original %s changes", async boundary => {
    const ctx = mountedContext(), pending = ctx.start();
    await ctx.failFirst();
    act(() => {
      if (boundary === "session") {
        ctx.lifecycle.retire();
        const replacement = createAppQueryClient(); clients.push(replacement); session(replacement, "member-b");
      } else beginAuthorizationUpdate(captureSession()).finish(true, boundary === "blocked");
    });
    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    expect(ctx.transport).toHaveBeenCalledOnce();
  });

  it("does not treat an externally retired attempt as its own retry", async () => {
    const ctx = mountedContext(), pending = ctx.start();
    await ctx.failFirst();
    supersedeDataConnectQueryReads(ctx.ref);
    await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    expect(ctx.transport).toHaveBeenCalledOnce();
    expect(ctx.client.getQueryData(ctx.key)).toEqual(response("cached old title").data);
  });

  it("keeps a new fetch separate from the old refresh's pending retry", async () => {
    const ctx = mountedContext(), old = ctx.start();
    await ctx.failFirst();
    const latest = ctx.start();
    await waitFor(() => expect(ctx.attempts).toHaveLength(2));
    await act(async () => { ctx.attempts[1].resolve(response("newer refresh")); });
    await expect(old).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    await expect(latest).resolves.toEqual(response("newer refresh").data);
    expect(ctx.client.getQueryData(ctx.key)).toEqual(response("newer refresh").data);
    expect(ctx.transport).toHaveBeenCalledTimes(2);
  });

  it("rejects a canceled fetch instead of reporting TanStack's reverted cache as authoritative success", async () => {
    const ctx = mountedContext(), pending = ctx.start();
    await waitFor(() => expect(ctx.attempts).toHaveLength(1));
    await act(async () => { await ctx.client.cancelQueries({queryKey: ctx.key, exact: true}); });
    try { await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError); }
    finally { await act(async () => { ctx.attempts[0].resolve(response("late abandoned response")); }); }
    expect(ctx.client.getQueryData(ctx.key)).toEqual(response("cached old title").data);
    expect(ctx.transport).toHaveBeenCalledOnce();
  });

  it.each(["replacement server title", "cached old title"])("does not let a same-tick replacement fetch claim an explicit refresh before dispatch (%s)", async title => {
    const ctx = mountedContext(false), fetchQuery = ctx.client.fetchQuery.bind(ctx.client);
    let cancellation: Promise<void> | undefined, replacement: Promise<void> | undefined;
    vi.spyOn(ctx.client, "fetchQuery").mockImplementationOnce(options => {
      const original = fetchQuery(options);
      // No microtask boundary: the app client's outer session wrapper has not
      // called the authoritative query function when this cancellation happens.
      cancellation = ctx.client.cancelQueries({queryKey: ctx.key, exact: true});
      replacement = ctx.client.refetchQueries({queryKey: ctx.key, exact: true, type: "all"});
      return original;
    });
    const pending = ctx.start();
    try {
      await waitFor(() => expect(ctx.attempts).toHaveLength(1));
      // The replacement's server read remains pending while the old refresh
      // settles. Equal data must not make a canceled result authoritative.
      await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
      await act(async () => { ctx.attempts[0].resolve(response(title)); });
      await cancellation; await replacement;
      expect(ctx.client.getQueryData(ctx.key)).toEqual(response(title).data);
      expect(ctx.transport).toHaveBeenCalledOnce();
    } finally {
      for (const attempt of ctx.attempts) attempt.resolve(response(title));
      await pending; await cancellation; await replacement;
    }
  });

  it("releases an unbound paused refresh before a later inactive refetch under new authority", async () => {
    const ctx = mountedContext(false);
    onlineManager.setOnline(false);
    const pending = ctx.start();
    try {
      await waitFor(() => expect(ctx.client.getQueryState(ctx.key)?.fetchStatus).toBe("paused"));
      expect(ctx.transport).not.toHaveBeenCalled();
      await ctx.client.cancelQueries({queryKey: ctx.key, exact: true});
      await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
      expect(ctx.client.getQueryCache().find({queryKey: ctx.key})?.getObserversCount()).toBe(0);

      beginAuthorizationUpdate(captureSession()).finish(true);
      onlineManager.setOnline(true);
      const later = invalidateDataConnectQueries(ctx.client, [[ctx.ref.name]]).catch(error => error);
      await waitFor(() => expect(ctx.attempts).toHaveLength(1));
      ctx.attempts[0].resolve(response("new authority title"));
      await expect(later).resolves.toBeUndefined();
      expect(ctx.client.getQueryData(ctx.key)).toEqual(response("new authority title").data);
      expect(ctx.transport).toHaveBeenCalledOnce();
    } finally {
      for (const attempt of ctx.attempts) attempt.resolve(response("new authority title"));
      await pending;
      onlineManager.setOnline(true);
    }
  });
});
