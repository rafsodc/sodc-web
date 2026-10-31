import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, queryRef, type DataConnect } from "firebase/data-connect";
import { dataConnectQueryKey, dataConnectQueryOptions, DataConnectReadSupersededError, refreshDataConnectQuery } from "../authoritativeDataConnect";
import { invalidateDataConnectQueries } from "../invalidation";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError } from "../../appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../auth/authorizationUpdate";
import { SECTION_EVENT_SUMMARIES_KEY, captureSectionEventSummaryRead, rememberSectionEventSummaries } from "../sectionEventSummaryCache";

// Exercise the installed SDK's real cache and real TanStack scheduling. Only
// the underlying transport is replaced; no generated hook/refetch is mocked.
vi.unmock("firebase/data-connect");
type Result = { value: string };
type TransportResult = { data: Result; extensions: object };
type TestDataConnect = DataConnect & { _transportClass: new () => { invokeQuery: (name: string, variables: unknown) => Promise<TransportResult> } };
const apps: FirebaseApp[] = [];
const clients: QueryClient[] = [];
const releases: Array<() => void> = [];
let nextApp = 0;
function client() {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  clients.push(value); return value;
}
function context(read: (name: string, variables: unknown) => Promise<TransportResult>) {
  const app = initializeApp({ projectId: "freshness-test", apiKey: "fake" }, "freshness-" + nextApp++); apps.push(app);
  const dc = getDataConnect(app, { connector: "test", service: "test", location: "europe-west2" }) as TestDataConnect;
  dc._transportClass = class { invokeQuery = read; };
  return { dc, ref: queryRef<Result>(dc, "GetFreshValue") };
}
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const response = (value: string): TransportResult => ({ data: { value }, extensions: {} });
function session(queryClient: QueryClient, uid = "member-a") {
  const lifecycle = createSessionLifecycle(); lifecycle.observe(uid);
  releases.push(installSessionRuntime({ lifecycle, queryClient, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() }));
  return lifecycle;
}
afterEach(async () => {
  resumeAuthorizationReads(captureSession());
  for (const release of releases.splice(0).reverse()) release();
  for (const queryClient of clients.splice(0)) queryClient.clear();
  await Promise.all(apps.splice(0).map(deleteApp));
});

describe("authoritative Data Connect reads", () => {
  it("reproduces stale ordinary SDK cache and refreshes both SDK and TanStack after an external write", async () => {
    let value = "before callable";
    const transport = vi.fn(async () => response(value));
    const { ref } = context(transport), queryClient = client();
    await queryClient.fetchQuery(dataConnectQueryOptions(ref));
    value = "after callable";
    expect((await executeQuery(ref)).data.value).toBe("before callable");
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(refreshDataConnectQuery(queryClient, ref)).resolves.toEqual({ value });
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({ value });
    expect((await executeQuery(ref)).data).toEqual({ value });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(dataConnectQueryKey(ref)).toEqual(["GetFreshValue", null]);
  });
  it("keeps bounded ordinary TanStack caching but actual refetches and cached inactive invalidations reach the server", async () => {
    let value = "old";
    const transport = vi.fn(async () => response(value));
    const { ref } = context(transport), queryClient = client();
    const options = dataConnectQueryOptions(ref);
    await queryClient.fetchQuery(options); value = "new";
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({ value: "old" });
    expect(transport).toHaveBeenCalledTimes(1);
    await invalidateDataConnectQueries(queryClient, [[ref.name]]);
    expect(queryClient.getQueryData(options.queryKey)).toEqual({ value: "new" });
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("cancels a stale TanStack request and never publishes its late result over a manual refresh", async () => {
    const old = deferred<TransportResult>();
    const transport = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue(response("fresh"));
    const { ref } = context(transport), queryClient = client();
    const pending = queryClient.fetchQuery(dataConnectQueryOptions(ref)).catch(error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    await expect(refreshDataConnectQuery(queryClient, ref)).resolves.toEqual({ value: "fresh" });
    old.resolve(response("late old")); await pending;
    await vi.waitFor(async () => expect((await executeQuery(ref)).data.value).toBe("late old"));
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({ value: "fresh" });
    // Even if the SDK itself cached that late response, the next app read is
    // authoritative and cannot leak it through an ordinary generated refetch.
    await queryClient.invalidateQueries({ queryKey: dataConnectQueryKey(ref), refetchType: "all" });
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({ value: "fresh" });
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it("rejects an older direct refresh instead of overwriting a newer refresh", async () => {
    const old = deferred<TransportResult>();
    const transport = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue(response("latest"));
    const { ref } = context(transport), queryClient = client();
    const pending = refreshDataConnectQuery(queryClient, ref).catch(error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    await expect(refreshDataConnectQuery(queryClient, ref)).resolves.toEqual({ value: "latest" });
    old.resolve(response("old"));
    await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({ value: "latest" });
  });
  it("does not seed either account's TanStack client after a session change", async () => {
    const old = deferred<TransportResult>(), transport = vi.fn(() => old.promise);
    const { ref } = context(transport), first = client(), second = client();
    const lifecycle = session(first);
    const pending = refreshDataConnectQuery(first, ref).catch(error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    lifecycle.retire(); session(second, "member-b"); old.resolve(response("member-a"));
    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    expect(first.getQueryData(dataConnectQueryKey(ref))).toBeUndefined();
    expect(second.getQueryData(dataConnectQueryKey(ref))).toBeUndefined();
  });
  it("does not dispatch into an old client when the session changes during passive invalidation", async () => {
    const transport = vi.fn(async () => response("member-b"));
    const { ref } = context(transport), first = client(), second = client();
    const lifecycle = session(first);
    vi.spyOn(first, "invalidateQueries").mockImplementationOnce(async () => {
      lifecycle.retire(); session(second, "member-b");
    });
    await expect(refreshDataConnectQuery(first, ref)).rejects.toBeInstanceOf(SessionChangedError);
    expect(transport).not.toHaveBeenCalled();
    expect(first.getQueryData(dataConnectQueryKey(ref))).toBeUndefined();
    expect(second.getQueryData(dataConnectQueryKey(ref))).toBeUndefined();
  });
  it("waits for own-authority updates and refuses reads that remain blocked", async () => {
    const transport = vi.fn(async () => response("verified"));
    const { ref } = context(transport), queryClient = client(); session(queryClient);
    const token = captureSession(), update = beginAuthorizationUpdate(token);
    const pending = refreshDataConnectQuery(queryClient, ref).catch(error => error);
    await Promise.resolve(); expect(transport).not.toHaveBeenCalled();
    update.finish(true, true);
    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    await expect(queryClient.fetchQuery(dataConnectQueryOptions(ref))).rejects.toBeInstanceOf(SessionChangedError);
    expect(transport).not.toHaveBeenCalled();
    resumeAuthorizationReads(token);
    await expect(refreshDataConnectQuery(queryClient, ref)).resolves.toEqual({ value: "verified" });
  });
  it("discards in-flight reads crossing an own-authority epoch even in the same account", async () => {
    const old = deferred<TransportResult>(), transport = vi.fn(() => old.promise);
    const { ref } = context(transport), queryClient = client(); session(queryClient);
    const pending = refreshDataConnectQuery(queryClient, ref).catch(error => error);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    beginAuthorizationUpdate(captureSession()).finish(true);
    old.resolve(response("before role change"));
    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toBeUndefined();
  });
  it("propagates refresh failures and keeps the old cache visibly old", async () => {
    const failure = new Error("server unavailable"), transport = vi.fn().mockRejectedValue(failure);
    const { ref } = context(transport), queryClient = client();
    queryClient.setQueryData(dataConnectQueryKey(ref), { value: "old" });
    await expect(refreshDataConnectQuery(queryClient, ref)).rejects.toBe(failure);
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({ value: "old" });
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each(["GetEventsForSection", "GetEventById"])("retires summaries before a failed %s administration refresh", async name => {
    const failure = new Error("Saved event refresh unavailable");
    const transport = vi.fn().mockRejectedValue(failure);
    const { dc } = context(transport), queryClient = client();
    const ref = queryRef<Result, { id: string }>(dc, name, { id: "resource-a" });
    const summaryKey = [...SECTION_EVENT_SUMMARIES_KEY, "member-a", 1, 0, "section-a"];
    queryClient.setQueryData(summaryKey, { events: [{ title: "Before edit" }] });
    queryClient.setQueryData(["unrelated"], "preserved");
    const pendingBundle = captureSectionEventSummaryRead(queryClient, "section-a");

    const refresh = refreshDataConnectQuery(queryClient, ref);
    expect(queryClient.getQueryData(summaryKey)).toBeUndefined();
    await expect(refresh).rejects.toBe(failure);
    rememberSectionEventSummaries(queryClient, { events: [] }, pendingBundle);
    expect(queryClient.getQueryCache().findAll({ queryKey: SECTION_EVENT_SUMMARIES_KEY })).toHaveLength(0);
    expect(queryClient.getQueryData(["unrelated"])).toBe("preserved");
  });

  it("does not retire event summaries for an unrelated authoritative refresh", async () => {
    const { ref } = context(async () => response("fresh")), queryClient = client();
    const summaryKey = [...SECTION_EVENT_SUMMARIES_KEY, "member-a", 1, 0, "section-a"];
    queryClient.setQueryData(summaryKey, { events: [] });

    await refreshDataConnectQuery(queryClient, ref);

    expect(queryClient.getQueryData(summaryKey)).toEqual({ events: [] });
  });
  it("keeps a failed explicit refresh stale so a revisit cannot report the cached old value as success", async () => {
    const transport = vi.fn().mockResolvedValueOnce(response("old")).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response("confirmed"));
    const { ref } = context(transport), queryClient = client(), options = dataConnectQueryOptions(ref);
    await queryClient.fetchQuery(options);
    await expect(refreshDataConnectQuery(queryClient, ref)).rejects.toThrow("offline");
    expect(queryClient.getQueryData(options.queryKey)).toEqual({value: "old"});
    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
    await expect(queryClient.fetchQuery(options)).resolves.toEqual({value: "confirmed"});
    expect(transport).toHaveBeenCalledTimes(3);
    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(false);
  });

  it("registers a never-mounted explicit refresh for later cached-scope invalidation", async () => {
    let value = "after write";
    const transport = vi.fn(async () => response(value));
    const { ref } = context(transport), queryClient = client();
    await refreshDataConnectQuery(queryClient, ref);
    value = "later write";
    await invalidateDataConnectQueries(queryClient, [[ref.name]]);
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({value});
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("does not supersede reads of different variables", async () => {
    const transport = vi.fn(async (_name, variables) => response((variables as { id: string }).id));
    const { dc } = context(transport), queryClient = client();
    const a = queryRef<Result, { id: string }>(dc, "GetFreshValue", { id: "a" });
    const b = queryRef<Result, { id: string }>(dc, "GetFreshValue", { id: "b" });
    await expect(Promise.all([refreshDataConnectQuery(queryClient, a), refreshDataConnectQuery(queryClient, b)])).resolves.toEqual([{ value: "a" }, { value: "b" }]);
    expect(queryClient.getQueryData(dataConnectQueryKey(a))).toEqual({ value: "a" });
    expect(queryClient.getQueryData(dataConnectQueryKey(b))).toEqual({ value: "b" });
  });
  it("propagates cached inactive refetch errors instead of reporting post-write success", async () => {
    const transport = vi.fn().mockResolvedValueOnce(response("old")).mockRejectedValue(new Error("refresh failed"));
    const { ref } = context(transport), queryClient = client();
    await queryClient.fetchQuery(dataConnectQueryOptions(ref));
    await expect(invalidateDataConnectQueries(queryClient, [[ref.name]])).rejects.toThrow("refresh failed");
    expect(queryClient.getQueryData(dataConnectQueryKey(ref))).toEqual({ value: "old" });
  });
});
