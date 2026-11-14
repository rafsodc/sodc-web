import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, queryRef, type DataConnect } from "firebase/data-connect";
import { TicketAudience, type GetEventByIdData, type GetEventsForSectionData } from "@dataconnect/generated";
import {
  applyCommittedTicketSave, assertCanonicalCommittedTicket, assertCanonicalCommittedTicketResponse, captureTicketSaveCacheWrite,
  retireCommittedTicketSave, retireTicketSaveDependencies, type CanonicalCommittedTicket,
} from "../ticketSaveCache";
import { applyCommittedEventSave, captureEventSaveCacheWrite, type CanonicalCommittedEvent } from "../eventSaveCache";
import { dataConnectQueryKey, dataConnectQueryOptions, DataConnectReadSupersededError, refreshDataConnectQuery } from "../authoritativeDataConnect";
import { captureSectionEventSummaryRead, rememberSectionEventSummaries } from "../sectionEventSummaryCache";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError, suspendPrivateSession } from "../../appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../auth/authorizationUpdate";

vi.unmock("firebase/data-connect");
const SECTION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TICKET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const compact = (id: string) => id.replaceAll("-", "");
const scope = { sectionId: SECTION, eventId: EVENT, ticketTypeId: TICKET };
const ticket: CanonicalCommittedTicket = {
  id: TICKET, title: "Committed ticket", description: null, audience: TicketAudience.MEMBER, price: 42,
  includesDinner: true, includesSymposium: false, sortOrder: 2,
  userGroup: { id: OTHER, name: "Members", membershipStatuses: null },
  event: { id: EVENT, section: { id: SECTION } }, updatedAt: "2026-11-02T12:00:00Z",
};
const catalogueRow = ({ event: _event, updatedAt: _updatedAt, ...row }: CanonicalCommittedTicket) => {
  void _event; void _updatedAt; return row;
};
const sibling = { ...catalogueRow(ticket), id: OTHER, title: "First ticket", sortOrder: 0 };
const saved: CanonicalCommittedEvent = {
  id: EVENT, section: { id: SECTION }, title: "Event", location: null, guestOfHonour: null, sponsors: null, details: null,
  startDateTime: "2030-06-01T12:00:00Z", endDateTime: "2030-06-01T14:00:00Z",
  bookingStartDateTime: "2030-01-01T00:00:00Z", bookingEndDateTime: "2030-05-31T00:00:00Z",
  maxGuestsWithoutModeratorApproval: 2, updatedAt: "2026-11-01T12:00:00Z", ticketTypes: [sibling, catalogueRow(ticket)],
};
const old = { ...saved, ticketTypes: [{ ...catalogueRow(ticket), title: "Old ticket", price: 25, sortOrder: 0 }, sibling] };
const detailKey = (id = EVENT) => ["GetEventById", { id }] as const;
const listKey = ["GetEventsForSection", { sectionId: SECTION }] as const;
const memberKey = ["GetMyBookingsForEvent", { eventId: EVENT }] as const;
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
  app = initializeApp({ projectId: "ticket-save-cache-test", apiKey: "fake" }, "ticket-save-cache-" + appNumber++);
  dc = getDataConnect(app, { connector: "test", service: "test", location: "europe-west2" }) as TestDataConnect;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  uninstall = install("admin-a");
});
afterEach(async () => {
  resumeAuthorizationReads(captureSession());
  for (const release of releases.splice(0).reverse()) release();
  client.clear(); vi.restoreAllMocks(); await deleteApp(app);
});

describe("canonical committed ticket cache updates", () => {
  it("publishes complete ordered catalogue aliases without reads or rewriting historical financial data", async () => {
    const read = vi.fn(); transport(read);
    const aliases = [EVENT, EVENT.toUpperCase(), compact(EVENT)];
    for (const id of aliases) client.setQueryData(detailKey(id), { event: old });
    client.setQueryData<GetEventsForSectionData>(listKey, { section: { id: SECTION, events: [old] } }, { updatedAt: 1 });
    const dependentKeys = [memberKey, ["ListEventBookingsForAdmin", { eventId: compact(EVENT).toUpperCase() }],
      ["ListTicketOrdersForAdmin", { eventId: EVENT }], ["GetMyBookings", null], ["GetMyTicketOrders", null],
      ["GetMyTicketOrderById", { id: OTHER }], ["GetMyBookingPaymentAdjustments", null],
      ["managed-event-tickets", EVENT.toUpperCase(), "admin-a"], ["eventAttendees", compact(EVENT), "admin-a"],
      ["organiser-guests", EVENT, "admin-a"], ["guest-section-events", SECTION.toUpperCase()]];
    const historical = { ticketType: { title: "Old ticket" }, paidAmountMinor: 2500, status: "PAID" };
    for (const key of dependentKeys) client.setQueryData(key, historical);
    const unrelatedKeys = [["ListEventBookingsForAdmin", { eventId: OTHER }], ["eventAttendees", OTHER, "admin-a"],
      ["managed-event-tickets", OTHER, "admin-a"], ["organiser-guests", OTHER, "admin-a"],
      ["guest-section-events", OTHER], ["ListBookingPaymentAdjustmentsForAdmin", { eventId: EVENT }], ["GetUserAccessGroups", null]];
    for (const key of unrelatedKeys) client.setQueryData(key, historical);
    const summary = captureSectionEventSummaryRead(client, SECTION);
    rememberSectionEventSummaries(client, { events: [] }, summary);
    const observer = new QueryObserver(client, { queryKey: memberKey, queryFn: read });
    const unsubscribe = observer.subscribe(() => {});
    try {
      const write = captureTicketSaveCacheWrite(client, dc, { sectionId: compact(SECTION), eventId: EVENT.toUpperCase(), ticketTypeId: compact(TICKET) });
      await applyCommittedTicketSave(write, ticket, saved);
      for (const id of aliases) expect(client.getQueryData(detailKey(id))).toEqual({ event: saved });
      expect(client.getQueryData<GetEventByIdData>(detailKey())?.event?.ticketTypes.map(row => row.id)).toEqual([OTHER, TICKET]);
      expect(client.getQueryState(listKey)?.dataUpdatedAt).toBe(1);
      for (const key of dependentKeys) {
        expect(client.getQueryState(key)?.isInvalidated, String(key)).toBe(true);
        expect(client.getQueryData(key)).toEqual(historical);
      }
      for (const key of unrelatedKeys) expect(client.getQueryState(key)?.isInvalidated, String(key)).toBe(false);
      expect(client.getQueryData(summary.queryKey)).toBeUndefined();
      rememberSectionEventSummaries(client, { events: [] }, summary);
      expect(client.getQueryData(summary.queryKey)).toBeUndefined();
      expect(read).not.toHaveBeenCalled();
    } finally { unsubscribe(); }
  });

  it("does not invent or renew a partial list while seeding a complete cold parent detail", async () => {
    transport(vi.fn());
    await applyCommittedTicketSave(captureTicketSaveCacheWrite(client, dc, scope), ticket, saved);
    expect(client.getQueryData(listKey)).toBeUndefined();
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
    client.setQueryData<GetEventsForSectionData>(listKey, { section: { id: SECTION, events: [old] } }, { updatedAt: 1 });
    await client.invalidateQueries({ queryKey: listKey, exact: true, refetchType: "none" });
    await applyCommittedTicketSave(captureTicketSaveCacheWrite(client, dc, scope), ticket, saved);
    expect(client.getQueryState(listKey)?.dataUpdatedAt).toBe(1);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it.each([
    null, { ...ticket, updatedAt: undefined }, { ...ticket, updatedAt: "invalid" }, { ...ticket, id: OTHER },
    { ...ticket, event: { id: OTHER, section: { id: SECTION } } }, { ...ticket, event: { id: EVENT, section: { id: OTHER } } },
    { ...ticket, price: Number.NaN }, { ...ticket, price: Number.POSITIVE_INFINITY }, { ...ticket, price: -1 },
    { ...ticket, title: undefined }, { ...ticket, description: undefined }, { ...ticket, audience: "UNKNOWN" },
    { ...ticket, includesDinner: undefined }, { ...ticket, includesSymposium: undefined }, { ...ticket, sortOrder: 0.5 },
    { ...ticket, userGroup: { id: OTHER, name: "Members" } }, { ...ticket, userGroup: null },
    { ...ticket, userGroup: { ...ticket.userGroup, membershipStatuses: [1] } },
  ])("rejects an incomplete or wrongly bound receipt before any publication: %j", async value => {
    transport(vi.fn()); client.setQueryData(detailKey(), { event: old }); client.setQueryData(memberKey, { unchanged: true });
    expect(() => assertCanonicalCommittedTicket(value, scope)).toThrow("could not be verified");
    await expect(applyCommittedTicketSave(captureTicketSaveCacheWrite(client, dc, scope), value as CanonicalCommittedTicket, saved)).rejects.toThrow("could not be verified");
    expect(client.getQueryData(detailKey())).toEqual({ event: old });
    expect(client.getQueryState(memberKey)?.isInvalidated).toBe(false);
  });

  it.each([
    { ...saved, id: OTHER }, { ...saved, updatedAt: undefined }, { ...saved, ticketTypes: [sibling] },
    { ...saved, ticketTypes: [catalogueRow(ticket), catalogueRow(ticket)] },
    { ...saved, ticketTypes: [{ ...catalogueRow(ticket), price: 999 }] },
    { ...saved, ticketTypes: [{ ...catalogueRow(ticket), userGroup: { ...ticket.userGroup, name: "Wrong group" } }] },
  ])("rejects an incoherent full parent without seeding partial detail: %j", async parent => {
    transport(vi.fn());
    expect(() => assertCanonicalCommittedTicketResponse(ticket, parent, scope)).toThrow("could not be verified");
    await expect(applyCommittedTicketSave(captureTicketSaveCacheWrite(client, dc, scope), ticket, parent as CanonicalCommittedEvent)).rejects.toThrow("could not be verified");
    expect(client.getQueryData(detailKey())).toBeUndefined();
  });

  it("fences a pre-save detail read even if it later poisons the SDK cache", async () => {
    const pendingRead = deferred<TransportResult>();
    const read = vi.fn().mockReturnValueOnce(pendingRead.promise).mockResolvedValue({ data: { event: saved }, extensions: {} }); transport(read);
    const ref = queryRef<GetEventByIdData, { id: string }>(dc, "GetEventById", { id: EVENT });
    const pending = client.fetchQuery(dataConnectQueryOptions(ref)).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    await applyCommittedTicketSave(captureTicketSaveCacheWrite(client, dc, scope), ticket, saved);
    pendingRead.resolve({ data: { event: old }, extensions: {} }); await pending;
    await vi.waitFor(async () => expect((await executeQuery(ref)).data.event).toEqual(old));
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
    await client.invalidateQueries({ queryKey: detailKey(), exact: true, refetchType: "all" });
    expect(read).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
  });

  it("keeps a newer full parent read instead of applying an older ticket snapshot", async () => {
    const newer = { ...saved, title: "Newer remote title", ticketTypes: [sibling, { ...catalogueRow(ticket), title: "Remote ticket" }] };
    transport(async () => ({ data: { event: newer }, extensions: {} }));
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    await client.fetchQuery(dataConnectQueryOptions(queryRef(dc, "GetEventById", { id: EVENT })));
    await expect(applyCommittedTicketSave(write, ticket, saved)).rejects.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData(detailKey())).toEqual({ event: newer });
  });

  it.each(["sibling-ticket", "parent-event"] as const)("shares parent ordering with a newer %s write", async kind => {
    transport(vi.fn());
    const first = captureTicketSaveCacheWrite(client, dc, scope);
    if (kind === "sibling-ticket") captureTicketSaveCacheWrite(client, dc, { ...scope, eventId: compact(EVENT), ticketTypeId: OTHER });
    else captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT.toUpperCase() });
    await expect(applyCommittedTicketSave(first, ticket, saved)).rejects.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData(detailKey())).toBeUndefined();
  });

  it.each(["retire", "suspend", "epoch", "blocked"] as const)("rejects publication across a %s boundary", async kind => {
    transport(vi.fn());
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    if (kind === "retire") { lifecycle.retire(); uninstall(); uninstall = install("admin-b"); }
    else if (kind === "suspend") suspendPrivateSession(captureSession());
    else beginAuthorizationUpdate(captureSession()).finish(true, kind === "blocked");
    await expect(applyCommittedTicketSave(write, ticket, saved)).rejects.toBeInstanceOf(SessionChangedError);
    expect(client.getQueryData(detailKey())).toBeUndefined();
  });

  it("does not repopulate the cache when dependency retirement synchronously retires the session", async () => {
    transport(vi.fn()); client.setQueryData(memberKey, { unchanged: true });
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type === "updated" && event.action.type === "invalidate") { lifecycle.retire(); client.clear(); }
    });
    try {
      await expect(applyCommittedTicketSave(write, ticket, saved)).rejects.toBeInstanceOf(SessionChangedError);
      expect(client.getQueryCache().getAll()).toHaveLength(0);
    } finally { unsubscribe(); }
  });
});

describe("read-only ticket dependency retirement", () => {
  it("supersedes a pending scoped SDK refresh and reads its new metadata only on a later visit", async () => {
    const delayed = deferred<TransportResult>();
    const oldData = { user: { bookings: [{ ticketType: { title: "Old" }, paidAmountMinor: 2500 }] } };
    const newData = { user: { bookings: [{ ticketType: { title: ticket.title }, paidAmountMinor: 2500 }] } };
    const read = vi.fn().mockResolvedValueOnce({ data: oldData, extensions: {} }).mockReturnValueOnce(delayed.promise)
      .mockResolvedValue({ data: newData, extensions: {} }); transport(read);
    const ref = queryRef(dc, "GetMyBookingsForEvent", { eventId: EVENT });
    await refreshDataConnectQuery(client, ref);
    const pending = refreshDataConnectQuery(client, ref).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await retireTicketSaveDependencies(client, dc, { sectionId: SECTION, eventId: compact(EVENT) });
    delayed.resolve({ data: oldData, extensions: {} });
    await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData(memberKey)).toEqual(oldData);
    expect(client.getQueryState(memberKey)?.isInvalidated).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(await client.fetchQuery(dataConnectQueryOptions(ref))).toEqual(newData);
    expect(read).toHaveBeenCalledTimes(3);
    expect(client.getQueryState(memberKey)?.isInvalidated).toBe(false);
  });

  it("cancels an old callable report without refetching or patching its historical rows", async () => {
    transport(vi.fn());
    const key = ["managed-event-tickets", EVENT, "admin-a"];
    const historical = { bookings: [{ priceMinor: 2500, ticketType: { title: "Old" } }] };
    client.setQueryData(key, historical);
    const delayed = deferred<typeof historical>();
    const read = vi.fn(() => delayed.promise);
    const pending = client.fetchQuery({ queryKey: key, queryFn: read, staleTime: 0 }).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    await retireTicketSaveDependencies(client, dc, scope);
    delayed.resolve({ bookings: [{ priceMinor: 9999, ticketType: { title: "Late stale report" } }] });
    await pending;
    expect(client.getQueryData(key)).toEqual(historical);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(read).toHaveBeenCalledOnce();
  });

  it("neither publishes a retained snapshot nor advances parent write ordering", async () => {
    transport(vi.fn());
    const fresh = { ...saved, title: "Fresh recovery read" };
    client.setQueryData(detailKey(), { event: fresh });
    await retireTicketSaveDependencies(client, dc, { sectionId: SECTION, eventId: EVENT });
    expect(client.getQueryData(detailKey())).toEqual({ event: fresh });
    // A later mutation can still finish after retirement; the read-only helper
    // does not pretend another parent write occurred in between.
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    await retireTicketSaveDependencies(client, dc, scope);
    await applyCommittedTicketSave(write, ticket, saved);
    expect(client.getQueryData(detailKey())).toEqual({ event: saved });
  });

  it("retires summaries but publishes no receipt if dependency cancellation fails", async () => {
    const read = vi.fn(); transport(read); client.setQueryData(detailKey(), { event: old });
    const summary = captureSectionEventSummaryRead(client, SECTION);
    rememberSectionEventSummaries(client, { events: [] }, summary);
    vi.spyOn(client, "cancelQueries").mockRejectedValueOnce(new Error("Cancellation unavailable"));
    await expect(applyCommittedTicketSave(captureTicketSaveCacheWrite(client, dc, scope), ticket, saved)).rejects.toThrow("Cancellation unavailable");
    expect(client.getQueryData(detailKey())).toEqual({ event: old });
    expect(client.getQueryData(summary.queryKey)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects a replacement account during cancellation without invalidating its metadata", async () => {
    transport(vi.fn()); client.setQueryData(memberKey, { account: "admin-a" });
    const pause = deferred<void>(); vi.spyOn(client, "cancelQueries").mockImplementationOnce(() => pause.promise);
    const pending = retireTicketSaveDependencies(client, dc, scope).catch(error => error);
    lifecycle.retire(); uninstall(); uninstall = install("admin-b");
    client.clear(); client.setQueryData(memberKey, { account: "admin-b" });
    pause.resolve();
    await expect(pending).resolves.toBeInstanceOf(SessionChangedError);
    expect(client.getQueryData(memberKey)).toEqual({ account: "admin-b" });
    expect(client.getQueryState(memberKey)?.isInvalidated).toBe(false);
  });

  it("does not declare retirement complete if a newer SDK refresh starts during cancellation", async () => {
    const data = { user: { bookings: [] } }; transport(async () => ({ data, extensions: {} }));
    const ref = queryRef(dc, "GetMyBookingsForEvent", { eventId: EVENT });
    await client.fetchQuery(dataConnectQueryOptions(ref));
    const pause = deferred<void>(); vi.spyOn(client, "cancelQueries").mockImplementationOnce(() => pause.promise);
    const pending = retireTicketSaveDependencies(client, dc, scope).catch(error => error);
    await client.fetchQuery({ ...dataConnectQueryOptions(ref), staleTime: 0 });
    pause.resolve();
    await expect(pending).resolves.toBeInstanceOf(DataConnectReadSupersededError);
    expect(client.getQueryData(dataConnectQueryKey(ref))).toEqual(data);
    expect(client.getQueryState(dataConnectQueryKey(ref))?.isInvalidated).toBe(false);
  });
});

describe("overlapping committed ticket and event responses", () => {
  const cases = ["primed", "empty"].flatMap(cache => ["A-first", "B-first"].flatMap(commitOrder =>
    ["A-first", "B-first"].map(responseOrder => ({ cache, commitOrder, responseOrder }))));
  it.each(cases)("retires potentially incomplete projections: $cache cache, commits $commitOrder, responses $responseOrder", async ({ cache, commitOrder, responseOrder }) => {
    let server = old;
    const read = vi.fn(async () => ({ data: { event: server }, extensions: {} })); transport(read);
    if (cache === "primed") {
      for (const id of [EVENT, EVENT.toUpperCase(), compact(EVENT)]) client.setQueryData(detailKey(id), { event: old });
      client.setQueryData(listKey, { section: { id: SECTION, events: [old] } });
    }
    const dependencies = [memberKey, ["ListEventBookingsForAdmin", { eventId: EVENT.toUpperCase() }],
      ["ListTicketOrdersForAdmin", { eventId: compact(EVENT) }], ["managed-event-tickets", EVENT, "admin-a"],
      ["eventAttendees", EVENT, "admin-a"], ["GetMyBookings", null], ["GetMyTicketOrders", null],
      ["organiser-guests", EVENT, "admin-a"]];
    for (const key of dependencies) client.setQueryData(key, { currentTitle: "Old ticket", paidAmountMinor: 2500 });
    const untouched = [["GetEventById", { id: OTHER }], ["ListBookingPaymentAdjustmentsForAdmin", { eventId: EVENT }], ["GetUserAccessGroups", null]];
    for (const key of untouched) client.setQueryData(key, { unchanged: true });
    const first = captureTicketSaveCacheWrite(client, dc, { ...scope, sectionId: compact(SECTION).toUpperCase(), eventId: EVENT.toUpperCase() });
    const second = captureEventSaveCacheWrite(client, dc, { sectionId: SECTION, eventId: EVENT });
    let firstResponse = saved, secondResponse = saved;
    const commitA = () => { server = { ...server, ticketTypes: saved.ticketTypes }; firstResponse = structuredClone(server); };
    const commitB = () => { server = { ...server, title: "Event B committed" }; secondResponse = structuredClone(server); };
    if (commitOrder === "A-first") { commitA(); commitB(); } else { commitB(); commitA(); }
    const deliverA = () => applyCommittedTicketSave(first, ticket, firstResponse).catch(error => error);
    const deliverB = () => applyCommittedEventSave(second, secondResponse).catch(error => error);
    if (responseOrder === "A-first") { await expect(deliverA()).resolves.toBeInstanceOf(DataConnectReadSupersededError); await deliverB(); }
    else { await deliverB(); await expect(deliverA()).resolves.toBeInstanceOf(DataConnectReadSupersededError); }
    for (const query of client.getQueryCache().getAll()) {
      if (query.queryKey[0] === "GetEventById" && idsEqualForTest(query.queryKey[1], EVENT)) expect(query.state.isInvalidated).toBe(true);
      if (query.queryKey[0] === "GetEventsForSection") expect(query.state.isInvalidated).toBe(true);
    }
    for (const key of dependencies) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      expect(client.getQueryData(key)).toEqual({ currentTitle: "Old ticket", paidAmountMinor: 2500 });
    }
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(read).not.toHaveBeenCalled();
    const current = await refreshDataConnectQuery(client, queryRef<GetEventByIdData, { id: string }>(dc, "GetEventById", { id: EVENT }));
    expect(current.event?.title).toBe("Event B committed");
    expect(current.event?.ticketTypes).toEqual(saved.ticketTypes);
    expect(read).toHaveBeenCalledOnce();
  });

  it("retires parent aliases and joined metadata after its ticket editor has left", async () => {
    const read = vi.fn(); transport(read);
    client.setQueryData(detailKey(), { event: old });
    client.setQueryData(memberKey, { ticketTitle: "Old ticket" });
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    await retireCommittedTicketSave(write, ticket, saved);
    expect(client.getQueryState(detailKey())?.isInvalidated).toBe(true);
    expect(client.getQueryState(memberKey)?.isInvalidated).toBe(true);
    expect(client.getQueryData(detailKey())).toEqual({ event: old });
    expect(read).not.toHaveBeenCalled();
  });
});

function idsEqualForTest(variables: unknown, id: string) {
  return typeof variables === "object" && variables !== null && "id" in variables &&
    String(variables.id).replaceAll("-", "").toLowerCase() === compact(id);
}

describe("ticket settlement read ownership", () => {
  it.each(["dependency", "parent publication"] as const)("preserves a detail read started during %s cancellation and still retires sibling aliases", async phase => {
    const fresh = { ...saved, title: "Read after confirmed ticket commit" };
    const delayed = deferred<TransportResult>();
    const read = vi.fn(() => delayed.promise); transport(read);
    client.setQueryData(detailKey(), { event: old });
    client.setQueryData(detailKey(EVENT.toUpperCase()), { event: old });
    client.setQueryData(listKey, { section: { id: SECTION, events: [old] } });
    client.setQueryData(memberKey, { title: "Old catalogue metadata" });
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    const pause = deferred<void>();
    const cancel = client.cancelQueries.bind(client);
    let held = false;
    vi.spyOn(client, "cancelQueries").mockImplementation((filters, options) => {
      const selectedPhase = phase === "dependency" ? filters?.predicate !== undefined : filters?.queryKey?.[0] === "GetEventsForSection";
      if (!held && selectedPhase) {
        held = true;
        return pause.promise;
      }
      return cancel(filters, options);
    });
    const publishing = applyCommittedTicketSave(write, ticket, saved).catch(error => error);
    // In the parent phase, dependency retirement must finish and publication
    // must advance its own read fences before the authoritative read starts.
    // A separately recaptured publication plan must not leave sibling aliases
    // fresh by hiding those fence advances from the outer fallback plan.
    await vi.waitFor(() => expect(held).toBe(true));
    const ref = queryRef<GetEventByIdData, {id: string}>(dc, "GetEventById", { id: EVENT });
    const pending = client.fetchQuery({ ...dataConnectQueryOptions(ref), staleTime: 0 }).catch(error => error);
    try {
      await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
      pause.resolve();
      await expect(publishing).resolves.toBeInstanceOf(DataConnectReadSupersededError);
      expect(client.getQueryState(detailKey())?.fetchStatus).toBe("fetching");
      expect(client.getQueryState(detailKey())?.isInvalidated).toBe(false);
      expect(client.getQueryState(detailKey(EVENT.toUpperCase()))?.isInvalidated).toBe(true);
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(memberKey)?.isInvalidated).toBe(true);
      delayed.resolve({ data: { event: fresh }, extensions: {} });
      await expect(pending).resolves.toEqual({ event: fresh });
      expect(client.getQueryState(detailKey())?.isInvalidated).toBe(false);
      expect(read).toHaveBeenCalledOnce();
    } finally {
      pause.resolve();
      delayed.resolve({ data: { event: fresh }, extensions: {} });
      await Promise.all([publishing, pending]);
    }
  });

  it("makes an evicted active initial read retryable without fetching hidden panels", async () => {
    const late = deferred<TransportResult>();
    const read = vi.fn().mockReturnValueOnce(late.promise).mockResolvedValue({ data: { event: saved }, extensions: {} }); transport(read);
    client.setQueryData(detailKey(), { event: old });
    const write = captureTicketSaveCacheWrite(client, dc, scope);
    client.removeQueries({ queryKey: detailKey(), exact: true });
    client.setQueryData(memberKey, { title: "Hidden old metadata" });
    const ref = queryRef<GetEventByIdData, {id: string}>(dc, "GetEventById", { id: EVENT });
    const observer = new QueryObserver(client, dataConnectQueryOptions(ref));
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
      expect(observer.getCurrentResult().isPending).toBe(true);
      await retireCommittedTicketSave(write, ticket, saved);
      expect(observer.getCurrentResult().isPending).toBe(false);
      expect(observer.getCurrentResult().isError).toBe(true);
      expect(observer.getCurrentResult().fetchStatus).toBe("idle");
      expect(client.getQueryState(memberKey)?.isInvalidated).toBe(true);
      expect(read).toHaveBeenCalledOnce();
      const recovered = await observer.refetch({ throwOnError: true });
      expect(recovered.data).toEqual({ event: saved });
      expect(recovered.isError).toBe(false);
      expect(read).toHaveBeenCalledTimes(2);
      late.resolve({ data: { event: old }, extensions: {} });
      await vi.waitFor(() => expect(client.getQueryData(detailKey())).toEqual({ event: saved }));
    } finally { unsubscribe(); }
  });
});
