import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, queryRef, type DataConnect } from "firebase/data-connect";
import { TicketAudience, type GetEventByIdData, type GetEventsForSectionData } from "@dataconnect/generated";
import { applyCommittedEventSave, assertCanonicalCommittedEvent, captureEventSaveCacheWrite, type CanonicalCommittedEvent } from "../eventSaveCache";
import { dataConnectQueryKey, dataConnectQueryOptions, DataConnectReadSupersededError, refreshDataConnectQuery } from "../authoritativeDataConnect";
import { captureSectionEventSummaryRead, rememberSectionEventSummaries } from "../sectionEventSummaryCache";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError, suspendPrivateSession } from "../../appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../auth/authorizationUpdate";

vi.unmock("firebase/data-connect");
const SECTION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const compact = (id: string) => id.replaceAll("-", "");
const saved: CanonicalCommittedEvent = {
  id: EVENT, section: { id: SECTION }, title: "Committed title", location: null, guestOfHonour: null,
  sponsors: null, details: null, startDateTime: "2030-06-01T12:00:00Z", endDateTime: "2030-06-01T14:00:00Z",
  bookingStartDateTime: "2030-01-01T00:00:00Z", bookingEndDateTime: "2030-05-31T00:00:00Z",
  maxGuestsWithoutModeratorApproval: 2, updatedAt: "2026-11-01T12:00:00Z",
  ticketTypes: [{ id: OTHER, title: "Organiser", description: null, audience: TicketAudience.ORGANISER_GUEST,
    price: 0, includesDinner: false, includesSymposium: true, sortOrder: 0,
    userGroup: { id: OTHER, name: "Access", membershipStatuses: null } }],
};
const old = { ...saved, title: "Old title", ticketTypes: [] };
const detailKey = (id = EVENT) => ["GetEventById", { id }] as const;
const listKey = (sectionId = SECTION) => ["GetEventsForSection", { sectionId }] as const;
const listData = (...events: CanonicalCommittedEvent[]): GetEventsForSectionData => ({ section: { id: SECTION, events } });
type TransportResult = { data: unknown; extensions: object };
type TestDataConnect = DataConnect & { _transportClass: new () => { invokeQuery: (name: string, variables: unknown) => Promise<TransportResult> } };
let app: FirebaseApp, dc: TestDataConnect, client: QueryClient;
let lifecycle: ReturnType<typeof createSessionLifecycle>, uninstall: () => void;
let appNumber = 0;
const releases: Array<() => void> = [];
function install(uid: string) {
  lifecycle = createSessionLifecycle(); lifecycle.observe(uid);
  const release = installSessionRuntime({ lifecycle, queryClient: client, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  releases.push(release); return release;
}
function transport(read: (name: string, variables: unknown) => Promise<TransportResult>) { dc._transportClass = class { invokeQuery = read; }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  app = initializeApp({ projectId: "event-save-cache-test", apiKey: "fake" }, "event-save-cache-" + appNumber++);
  dc = getDataConnect(app, { connector: "test", service: "test", location: "europe-west2" }) as TestDataConnect;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  uninstall = install("admin-a");
});
afterEach(async () => {
  resumeAuthorizationReads(captureSession());
  for (const release of releases.splice(0).reverse()) release();
  client.clear(); vi.restoreAllMocks(); await deleteApp(app);
});

describe("canonical committed event cache updates", () => {
  it("updates logical-ID aliases, keeps stable date ordering and retires dependent snapshots without fetching", async () => {
    const read = vi.fn(async () => ({ data: { event: old }, extensions: {} })); transport(read);
    const first = { ...old, id: OTHER, title: "Equal date first" };
    client.setQueryData(listKey(compact(SECTION)), listData(first, old));
    client.setQueryData(detailKey(EVENT.toUpperCase()), { event: old });
    client.setQueryData(detailKey(compact(EVENT)), { event: old });
    client.setQueryData(detailKey(OTHER), { event: first });
    const dependencyKey = ["GetMyBookings", null];
    client.setQueryData(dependencyKey, { user: { bookings: [] } });
    const guestKeys = [["organiser-guests", compact(EVENT), "admin-a"], ["guest-section-events", SECTION.toUpperCase()]];
    for (const key of guestKeys) client.setQueryData(key, { title: old.title });
    const unrelatedGuestKey = ["organiser-guests", OTHER, "admin-a"]; client.setQueryData(unrelatedGuestKey, { title: "Unrelated" });
    const untouchedKey = ["GetUserAccessGroups", null]; client.setQueryData(untouchedKey, "untouched");
    const summary = captureSectionEventSummaryRead(client, SECTION);
    rememberSectionEventSummaries(client, { events: [] }, summary);
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION.toUpperCase(), eventId: compact(EVENT) });

    await applyCommittedEventSave(write, saved);

    for (const key of [detailKey(), detailKey(EVENT.toUpperCase()), detailKey(compact(EVENT))]) expect(client.getQueryData(key)).toEqual({ event: saved });
    expect(client.getQueryData<GetEventsForSectionData>(listKey(compact(SECTION)))?.section?.events.map(event => event.title)).toEqual(["Equal date first", saved.title]);
    expect(client.getQueryData(detailKey(OTHER))).toEqual({ event: first });
    expect(client.getQueryState(dependencyKey)?.isInvalidated).toBe(true);
    for (const key of guestKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(unrelatedGuestKey)?.isInvalidated).toBe(false);
    expect(client.getQueryData(untouchedKey)).toBe("untouched");
    expect(client.getQueryState(untouchedKey)?.isInvalidated).toBe(false);
    expect(client.getQueryData(summary.queryKey)).toBeUndefined();
    rememberSectionEventSummaries(client, { events: [] }, summary);
    expect(client.getQueryData(summary.queryKey)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it("inserts a created event into an existing list, reorders changed dates and never invents a complete list", async () => {
    transport(vi.fn());
    const later = { ...old, id: OTHER, startDateTime: "2030-07-01T00:00:00Z" };
    client.setQueryData(listKey(), listData(later));
    await applyCommittedEventSave(captureEventSaveCacheWrite(client, dc, { sectionId: SECTION }), saved);
    expect(client.getQueryData<GetEventsForSectionData>(listKey())?.section?.events.map(event => event.id)).toEqual([EVENT, OTHER]);
    const moved = { ...saved, startDateTime: "2030-08-01T00:00:00Z" };
    await applyCommittedEventSave(captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT }), moved);
    expect(client.getQueryData<GetEventsForSectionData>(listKey())?.section?.events.map(event => event.id)).toEqual([OTHER, EVENT]);
    client.removeQueries({ queryKey: listKey(), exact: true });
    await applyCommittedEventSave(captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT }), saved);
    expect(client.getQueryData(listKey())).toBeUndefined();
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
  });

  it("does not renew the age or invalidation of the rest of an existing list", async () => {
    transport(vi.fn());
    client.setQueryData(listKey(), listData(old), { updatedAt: 1 });
    await client.invalidateQueries({ queryKey: listKey(), refetchType: "none" });
    await applyCommittedEventSave(captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT }), saved);
    expect(client.getQueryState(listKey())?.dataUpdatedAt).toBe(1);
    expect(client.getQueryState(listKey())?.isInvalidated).toBe(true);
  });

  it.each([
    null, { ...saved, ticketTypes: undefined }, { ...saved, updatedAt: undefined },
    { ...saved, section: { id: OTHER } }, { ...saved, id: OTHER },
    { ...saved, location: undefined, ticketTypes: [{ ...saved.ticketTypes[0], userGroup: {} }] },
    Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "details")),
  ])("rejects an incomplete or wrongly bound canonical result without publishing: %j", async value => {
    transport(vi.fn()); client.setQueryData(detailKey(), { event: old });
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    expect(() => assertCanonicalCommittedEvent(value, { sectionId: SECTION, eventId: EVENT })).toThrow("could not be verified");
    await expect(applyCommittedEventSave(write, value as CanonicalCommittedEvent)).rejects.toThrow("could not be verified");
    expect(client.getQueryData(detailKey())).toEqual({ event: old });
  });

  it("fences an old started-before-write read even when it later poisons the SDK cache", async () => {
    const delayed = deferred<TransportResult>();
    const read = vi.fn().mockReturnValueOnce(delayed.promise).mockResolvedValue({ data: { event: saved }, extensions: {} }); transport(read);
    const ref = queryRef<GetEventByIdData, { id: string }>(dc, "GetEventById", { id: EVENT });
    const pending = client.fetchQuery(dataConnectQueryOptions(ref)).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    await applyCommittedEventSave(write, saved);
    expect(read).toHaveBeenCalledOnce();
    delayed.resolve({ data: { event: old }, extensions: {} }); await pending;
    await vi.waitFor(async () => expect((await executeQuery(ref)).data.event?.title).toBe(old.title));
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });

    await client.invalidateQueries({ queryKey: detailKey(), exact: true, refetchType: "all" });
    expect(read).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
    expect((await executeQuery(ref)).data.event?.title).toBe(saved.title);
  });

  it("registers newly seeded detail aliases for later authoritative invalidation", async () => {
    const serverEvent = { ...saved, title: "Later server title" };
    const read = vi.fn(async () => ({ data: { event: serverEvent }, extensions: {} })); transport(read);
    await applyCommittedEventSave(captureEventSaveCacheWrite(client, dc, { sectionId: SECTION }), saved);
    await client.invalidateQueries({ queryKey: detailKey(), exact: true, refetchType: "all" });
    expect(read).toHaveBeenCalledOnce();
    expect(client.getQueryData(detailKey())).toEqual({ event: serverEvent });
  });

  it("supersedes an explicit metadata refresh rather than returning reverted old data as success", async () => {
    const delayed = deferred<TransportResult>();
    const read = vi.fn().mockResolvedValueOnce({ data: { user: { bookings: [] } }, extensions: {} }).mockReturnValueOnce(delayed.promise);
    transport(read);
    const ref = queryRef(dc, "GetMyBookings");
    await refreshDataConnectQuery(client, ref);
    const pending = refreshDataConnectQuery(client, ref).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));

    await applyCommittedEventSave(captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT }), saved);
    delayed.resolve({ data: { user: { bookings: [{ event: { title: old.title } }] } }, extensions: {} });
    await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryState(dataConnectQueryKey(ref))?.isInvalidated).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("preserves a newer full read including child data instead of applying an older receipt", async () => {
    const latest = { ...saved, title: "Remote edit", ticketTypes: [{ ...saved.ticketTypes[0], title: "New ticket" }] };
    transport(async () => ({ data: { event: latest }, extensions: {} }));
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    const ref = queryRef<GetEventByIdData, { id: string }>(dc, "GetEventById", { id: EVENT });
    await client.fetchQuery(dataConnectQueryOptions(ref));
    await expect(applyCommittedEventSave(write, saved)).rejects.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData(detailKey())).toEqual({ event: latest });
  });

  it("preserves a newly introduced equivalent URL alias read", async () => {
    transport(async () => ({ data: { event: { ...saved, title: "New alias read" } }, extensions: {} }));
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    const ref = queryRef<GetEventByIdData, { id: string }>(dc, "GetEventById", { id: compact(EVENT).toUpperCase() });
    await client.fetchQuery(dataConnectQueryOptions(ref));
    await expect(applyCommittedEventSave(write, saved)).rejects.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData<GetEventByIdData>(dataConnectQueryKey(ref))?.event?.title).toBe("New alias read");
    expect(client.getQueryData(detailKey())).toBeUndefined();
  });

  it("preserves a newer read started while cancellation is settling", async () => {
    const latest = { ...saved, title: "Read during cache application" };
    transport(async () => ({ data: { event: latest }, extensions: {} }));
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    const pause = deferred<void>();
    vi.spyOn(client, "cancelQueries").mockImplementationOnce(() => pause.promise);
    const applying = applyCommittedEventSave(write, saved).catch(error => error);
    const ref = queryRef<GetEventByIdData, { id: string }>(dc, "GetEventById", { id: EVENT });
    await client.fetchQuery(dataConnectQueryOptions(ref));
    pause.resolve();
    await expect(applying).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData(detailKey())).toEqual({ event: latest });
  });

  it("rejects a superseded same-resource write but admits the current one", async () => {
    transport(vi.fn());
    const first = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    const latest = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: compact(EVENT).toUpperCase() });
    await expect(applyCommittedEventSave(first, old)).rejects.toBeInstanceOf(DataConnectReadSupersededError);
    await applyCommittedEventSave(latest, saved);
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
  });

  it.each(["retire", "suspend", "epoch", "blocked"] as const)("rejects cache publication across a %s boundary", async kind => {
    transport(vi.fn());
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    if (kind === "retire") { lifecycle.retire(); uninstall(); uninstall = install("admin-b"); }
    else if (kind === "suspend") suspendPrivateSession(captureSession());
    else beginAuthorizationUpdate(captureSession()).finish(true, kind === "blocked");
    await expect(applyCommittedEventSave(write, saved)).rejects.toBeInstanceOf(SessionChangedError);
    expect(client.getQueryData(detailKey())).toBeUndefined();
  });

  it.each(["list", "detail", "after-await"] as const)("cannot repopulate a retired client through a %s publication subscriber", async phase => {
    transport(vi.fn()); client.setQueryData(listKey(), listData(old));
    const write = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type === "updated" && event.query.queryKey[0] === (phase === "list" ? "GetEventsForSection" : "GetEventById")) {
        const retire = () => { lifecycle.retire(); client.clear(); };
        if (phase === "after-await") queueMicrotask(retire); else retire();
      }
    });
    await expect(applyCommittedEventSave(write, saved)).rejects.toBeInstanceOf(SessionChangedError);
    unsubscribe(); expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
