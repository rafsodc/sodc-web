import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, queryRef, type DataConnect } from "firebase/data-connect";
import { captureEventDeleteCacheWrite, retireDeletedEventDetail } from "../eventDeleteCache";
import { dataConnectQueryOptions, DataConnectReadSupersededError, refreshDataConnectQuery } from "../authoritativeDataConnect";
import { captureSectionEventSummaryRead, rememberSectionEventSummaries, removeSectionEventSummaries } from "../sectionEventSummaryCache";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError, suspendPrivateSession } from "../../appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../auth/authorizationUpdate";

// The real SDK cache and QueryClient run normally; only the network transport is replaced.
vi.unmock("firebase/data-connect");
const EVENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SECTION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const compact = (id: string) => id.replaceAll("-", "");
const key = (id = EVENT) => ["GetEventById", { id }] as const;
const before = { event: { id: EVENT, title: "Before deletion" } };
type Result = { data: unknown; extensions: object };
type TestDataConnect = DataConnect & { _transportClass: new () => { invokeQuery: (name: string, variables: unknown) => Promise<Result> } };
let app: FirebaseApp, dc: TestDataConnect, client: QueryClient;
let lifecycle: ReturnType<typeof createSessionLifecycle>;
const releases: Array<() => void> = [];
let appNumber = 0;
function install(uid = "admin-a") {
  lifecycle = createSessionLifecycle(); lifecycle.observe(uid);
  releases.push(installSessionRuntime({ lifecycle, queryClient: client, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function transport(read = vi.fn(async () => ({ data: { event: null }, extensions: {} } as Result))) {
  dc._transportClass = class { invokeQuery = read; }; return read;
}
beforeEach(() => {
  app = initializeApp({ projectId: "event-delete-cache-test", apiKey: "fake" }, "event-delete-cache-" + appNumber++);
  dc = getDataConnect(app, { connector: "test", service: "test", location: "europe-west2" }) as TestDataConnect;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  install();
});
afterEach(async () => {
  resumeAuthorizationReads(captureSession());
  for (const release of releases.splice(0).reverse()) release();
  client.clear(); vi.restoreAllMocks(); await deleteApp(app);
});

describe("confirmed event deletion detail retirement", () => {
  it.each([compact(EVENT), EVENT, EVENT.toUpperCase()])("retires canonical and cached aliases for %s without fetching unrelated details", async eventId => {
    const read = transport();
    for (const id of [EVENT, compact(EVENT), EVENT.toUpperCase()]) client.setQueryData(key(id), before);
    client.setQueryData(key(OTHER), { event: { id: OTHER } });
    const permission = ["GetUserAccessGroups", null]; client.setQueryData(permission, "preserved");
    const summary = captureSectionEventSummaryRead(client, SECTION);
    rememberSectionEventSummaries(client, { events: [] }, summary);

    await retireDeletedEventDetail(captureEventDeleteCacheWrite(client, dc, eventId));

    for (const id of [EVENT, compact(EVENT), EVENT.toUpperCase()]) {
      expect(client.getQueryData(key(id))).toEqual(before);
      expect(client.getQueryState(key(id))?.isInvalidated).toBe(true);
    }
    expect(client.getQueryState(key(OTHER))?.isInvalidated).toBe(false);
    expect(client.getQueryState(permission)?.isInvalidated).toBe(false);
    expect(client.getQueryData(summary.queryKey)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it("fences a late detail response and bypasses its poisoned SDK cache on revisit", async () => {
    const old = deferred<Result>();
    const read = transport(vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ data: { event: null }, extensions: {} }));
    const ref = queryRef(dc, "GetEventById", { id: EVENT });
    client.setQueryData(key(), before);
    const pending = refreshDataConnectQuery(client, ref).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());

    await retireDeletedEventDetail(captureEventDeleteCacheWrite(client, dc, compact(EVENT)));
    expect(read).toHaveBeenCalledOnce();
    old.resolve({ data: before, extensions: {} });
    await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    // Direct SDK reads can still see their own late transport cache; app reads cannot.
    await vi.waitFor(async () => expect((await executeQuery(ref)).data).toEqual(before));
    expect(client.getQueryState(key())?.isInvalidated).toBe(true);
    await expect(client.fetchQuery(dataConnectQueryOptions(ref))).resolves.toEqual({ event: null });
    expect(client.getQueryData(key())).toEqual({ event: null });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("rejects a summary bundle begun between delete dispatch and its commit", async () => {
    const read = transport();
    const deletion = captureEventDeleteCacheWrite(client, dc, EVENT);
    removeSectionEventSummaries(client); // The existing pre-dispatch retirement.
    const bundle = captureSectionEventSummaryRead(client, SECTION);

    await retireDeletedEventDetail(deletion);
    rememberSectionEventSummaries(client, { events: [] }, bundle);

    expect(client.getQueryData(bundle.queryKey)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["retire", "replace", "suspend", "epoch", "blocked"] as const)("does not retire cache after a %s boundary", async boundary => {
    const read = transport();
    const deletion = captureEventDeleteCacheWrite(client, dc, EVENT);
    if (boundary === "retire" || boundary === "replace") {
      lifecycle.retire();
      if (boundary === "replace") install("admin-b");
    } else if (boundary === "suspend") suspendPrivateSession(captureSession());
    else beginAuthorizationUpdate(captureSession()).finish(true, boundary === "blocked");
    const fresh = { event: { id: EVENT, title: "New session/read" } };
    client.setQueryData(key(), fresh);

    await expect(retireDeletedEventDetail(deletion)).rejects.toBeInstanceOf(SessionChangedError);

    expect(client.getQueryData(key())).toEqual(fresh);
    expect(client.getQueryState(key())?.isInvalidated).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["replace", "epoch", "blocked"] as const)("stops before invalidation when %s occurs during cancellation", async boundary => {
    transport(); client.setQueryData(key(), before);
    const deletion = captureEventDeleteCacheWrite(client, dc, EVENT);
    const gate = deferred<void>();
    const cancel = client.cancelQueries.bind(client);
    vi.spyOn(client, "cancelQueries").mockImplementationOnce(async filters => { await cancel(filters); await gate.promise; });
    const pending = retireDeletedEventDetail(deletion).catch(error => error);
    await vi.waitFor(() => expect(client.cancelQueries).toHaveBeenCalledOnce());
    if (boundary === "replace") { lifecycle.retire(); client.clear(); install("admin-b"); }
    else beginAuthorizationUpdate(captureSession()).finish(true, boundary === "blocked");
    const fresh = { event: { id: EVENT, title: "New authority" } }; client.setQueryData(key(), fresh);
    gate.resolve();

    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    expect(client.getQueryData(key())).toEqual(fresh);
    expect(client.getQueryState(key())?.isInvalidated).toBe(false);
  });

  it("stops when a synchronous summary-removal subscriber replaces the session", async () => {
    transport();
    const summary = captureSectionEventSummaryRead(client, SECTION); rememberSectionEventSummaries(client, { events: [] }, summary);
    const deletion = captureEventDeleteCacheWrite(client, dc, EVENT);
    const fresh = { event: { id: EVENT, title: "Replacement account" } };
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type !== "removed" || event.query.queryKey[0] !== "sectionEventSummaries") return;
      unsubscribe(); lifecycle.retire(); client.clear(); install("admin-b"); client.setQueryData(key(), fresh);
    });

    await expect(retireDeletedEventDetail(deletion)).rejects.toBeInstanceOf(SessionChangedError);

    unsubscribe();
    expect(client.getQueryData(key())).toEqual(fresh);
    expect(client.getQueryState(key())?.isInvalidated).toBe(false);
  });

  it("preserves a newer authoritative detail read during cancellation while retiring the other alias", async () => {
    const read = transport();
    client.setQueryData(key(), before); client.setQueryData(key(compact(EVENT)), before);
    const deletion = captureEventDeleteCacheWrite(client, dc, EVENT), gate = deferred<void>();
    const cancel = client.cancelQueries.bind(client);
    vi.spyOn(client, "cancelQueries").mockImplementationOnce(async filters => { await cancel(filters); await gate.promise; });
    const pending = retireDeletedEventDetail(deletion);
    await vi.waitFor(() => expect(client.cancelQueries).toHaveBeenCalledOnce());
    await refreshDataConnectQuery(client, queryRef(dc, "GetEventById", { id: EVENT }));
    gate.resolve(); await pending;

    expect(client.getQueryData(key())).toEqual({ event: null });
    expect(client.getQueryState(key())?.isInvalidated).toBe(false);
    expect(client.getQueryState(key(compact(EVENT)))?.isInvalidated).toBe(true);
    expect(read).toHaveBeenCalledOnce();
  });
});
