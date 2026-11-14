import { hashKey, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { queryRef, type DataConnect, type QueryRef } from "firebase/data-connect";
import type { GetEventByIdData, GetEventsForSectionData, TimestampString } from "@dataconnect/generated";
import { assertSessionCurrent, captureSession, SessionChangedError, type SessionToken } from "../appShell/sessionLifecycle";
import { authorizationReadEpoch, privateReadsBlocked } from "../auth/authorizationUpdate";
import { idsEqual, toCanonicalUuid } from "../utils/uuid";
import {
  captureDataConnectReadGeneration, dataConnectQueryKey, dataConnectQueryOptions,
  DataConnectReadSupersededError, supersedeDataConnectQueryReads,
} from "./authoritativeDataConnect";
import { removeSectionEventSummaries } from "./sectionEventSummaryCache";

export type CanonicalCommittedEvent = NonNullable<GetEventByIdData["event"]> & { updatedAt: TimestampString };
interface EventSaveScope { sectionId: string; eventId?: string }
type EventRef = QueryRef<unknown, unknown>;
interface EventSaveCacheWrite {
  client: QueryClient;
  dc: DataConnect;
  scope: EventSaveScope;
  session: SessionToken;
  epoch: number;
  assertLatestWrite: () => void;
  reads: Map<string, () => void>;
}
const writes = new WeakMap<QueryClient, Map<string, number>>();
function resourceId(id: string) { try { return toCanonicalUuid(id); } catch { return id.trim(); } }
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value == null || typeof value === "string";

/** Validate the complete transactional projection before accepting it as a saved receipt. */
export function assertCanonicalCommittedEvent(value: unknown, scope: EventSaveScope): asserts value is CanonicalCommittedEvent {
  if (!record(value) || typeof value.id !== "string" || !value.id ||
    !record(value.section) || typeof value.section.id !== "string" || !idsEqual(value.section.id, scope.sectionId) ||
    (scope.eventId !== undefined && !idsEqual(value.id, scope.eventId)) ||
    typeof value.title !== "string" ||
    !["location", "guestOfHonour", "sponsors", "details"].every(key => key in value && nullableText(value[key])) ||
    ![value.startDateTime, value.endDateTime, value.bookingStartDateTime, value.bookingEndDateTime, value.updatedAt].every(date) ||
    !Number.isInteger(value.maxGuestsWithoutModeratorApproval) || Number(value.maxGuestsWithoutModeratorApproval) < 0 ||
    !Array.isArray(value.ticketTypes) || !value.ticketTypes.every(ticket => record(ticket) &&
      typeof ticket.id === "string" && typeof ticket.title === "string" && "description" in ticket && nullableText(ticket.description) &&
      ["MEMBER", "GUEST", "ORGANISER_GUEST"].includes(String(ticket.audience)) && typeof ticket.price === "number" && Number.isFinite(ticket.price) &&
      typeof ticket.includesDinner === "boolean" && typeof ticket.includesSymposium === "boolean" && Number.isInteger(ticket.sortOrder) &&
      record(ticket.userGroup) && typeof ticket.userGroup.id === "string" && typeof ticket.userGroup.name === "string" && "membershipStatuses" in ticket.userGroup &&
      (ticket.userGroup.membershipStatuses == null || (Array.isArray(ticket.userGroup.membershipStatuses) && ticket.userGroup.membershipStatuses.every(status => typeof status === "string"))))) {
    throw new Error("The committed event response could not be verified. Load the saved change from the server.");
  }
}

function projectionRefs(client: QueryClient, dc: DataConnect, scope: EventSaveScope, eventId = scope.eventId): EventRef[] {
  const refs = new Map<string, EventRef>();
  const add = (name: string, variables: unknown) => {
    const ref = queryRef<unknown, unknown>(dc, name, variables);
    refs.set(hashKey(dataConnectQueryKey(ref)), ref);
  };
  add("GetEventsForSection", { sectionId: scope.sectionId });
  add("GetEventsForSection", { sectionId: resourceId(scope.sectionId) });
  if (eventId) {
    add("GetEventById", { id: eventId });
    add("GetEventById", { id: resourceId(eventId) });
  }
  // Generated keys retain their original URL spelling. Match logical UUIDs while
  // retaining every exact alias so uppercase/compact routes receive the result.
  for (const query of client.getQueryCache().getAll()) {
    const [name, variables] = query.queryKey;
    if (!record(variables)) continue;
    if (name === "GetEventsForSection" && typeof variables.sectionId === "string" && idsEqual(variables.sectionId, scope.sectionId)) add(name, variables);
    if (eventId && name === "GetEventById" && typeof variables.id === "string" && idsEqual(variables.id, eventId)) add(name, variables);
  }
  return [...refs.values()];
}

/** Capture inside the new mutation callback, never when reusing a retained receipt. */
export function captureEventSaveCacheWrite(client: QueryClient, dc: DataConnect, scope: EventSaveScope): EventSaveCacheWrite {
  const session = captureSession();
  assertSessionCurrent(session);
  if (privateReadsBlocked(session)) throw new SessionChangedError();
  const key = scope.eventId ? `event:${resourceId(scope.eventId)}` : `create:${resourceId(scope.sectionId)}`;
  let generations = writes.get(client);
  if (!generations) { generations = new Map(); writes.set(client, generations); }
  const generation = (generations.get(key) ?? 0) + 1;
  generations.set(key, generation);
  return {
    client, dc, scope: { ...scope }, session, epoch: authorizationReadEpoch(),
    assertLatestWrite: () => { if (generations.get(key) !== generation) throw new DataConnectReadSupersededError(); },
    reads: new Map(projectionRefs(client, dc, scope).map(ref => [hashKey(dataConnectQueryKey(ref)), captureDataConnectReadGeneration(ref)])),
  };
}

function assertWriteSessionCurrent(write: EventSaveCacheWrite) {
  assertSessionCurrent(write.session);
  if (privateReadsBlocked(write.session) || authorizationReadEpoch() !== write.epoch) throw new SessionChangedError();
}
function assertWriteCurrent(write: EventSaveCacheWrite) {
  assertWriteSessionCurrent(write);
  write.assertLatestWrite();
}
const metadataQueryNames = ["GetMyBookings", "GetMyTicketOrderById", "GetMyTicketOrders", "GetMyBookingPaymentAdjustments"];
function isMetadataDependency(key: QueryKey, scope: EventSaveScope, eventId: string) {
  // These aggregate projections embed event titles/dates; they must not keep a
  // fresh pre-save snapshot. Re-entering their view performs an authoritative read.
  return metadataQueryNames.includes(String(key[0])) ||
    (key[0] === "organiser-guests" && typeof key[1] === "string" && idsEqual(key[1], eventId)) ||
    (key[0] === "guest-section-events" && typeof key[1] === "string" && idsEqual(key[1], scope.sectionId));
}

interface AdditionalDependencies {
  matches: (key: QueryKey) => boolean;
  dataConnectNames: ReadonlySet<string>;
}
interface RetirementEntry {
  query: Query;
  read?: () => void;
  promise: Query["promise"];
  dataUpdateCount: number;
}
interface CommittedEventRetirement {
  trackReadFence: (ref: EventRef, fence: () => void) => void;
  trackPublished: (key: QueryKey) => void;
  publish: () => Promise<void>;
  retire: () => Promise<void>;
}

/** Capture at the confirmed-response boundary, before publication can await.
 * Retirement ignores obsolete write ordering, but never the original identity or
 * authority. Per-query guards let a newer read survive without leaving sibling
 * aliases fresh merely because that one read superseded publication.
 */
export function captureCommittedEventRetirement(write: EventSaveCacheWrite, event: CanonicalCommittedEvent, additional?: AdditionalDependencies): CommittedEventRetirement {
  assertCanonicalCommittedEvent(event, write.scope);
  assertWriteSessionCurrent(write);
  const projections = projectionRefs(write.client, write.dc, write.scope, event.id);
  const projectionFences = new Map(projections.map(ref => [hashKey(dataConnectQueryKey(ref)), { ref, read: captureDataConnectReadGeneration(ref) }]));
  const projectionKeys = new Set(projectionFences.keys());
  const dcNames = new Set([...metadataQueryNames, ...(additional?.dataConnectNames ?? [])]);
  const ownedFences = new Map<string, () => void>();
  const entries = new Map<string, RetirementEntry>();
  const remember = (query: Query, read?: () => void) => entries.set(hashKey(query.queryKey), {
    query, read, promise: query.promise, dataUpdateCount: query.state.dataUpdateCount,
  });
  for (const query of write.client.getQueryCache().getAll()) {
    const key = hashKey(query.queryKey);
    if (!projectionKeys.has(key) && !isMetadataDependency(query.queryKey, write.scope, event.id) && !additional?.matches(query.queryKey)) continue;
    const dcRead = projectionKeys.has(key) || dcNames.has(String(query.queryKey[0]));
    remember(query, dcRead ? captureDataConnectReadGeneration(queryRef(write.dc, String(query.queryKey[0]), query.queryKey[1] ?? undefined)) : undefined);
  }
  const current = (entry: RetirementEntry) => {
    assertWriteSessionCurrent(write);
    if (write.client.getQueryCache().find({ queryKey: entry.query.queryKey, exact: true }) !== entry.query || entry.query.promise !== entry.promise) return false;
    try { entry.read?.(); } catch (error) { if (error instanceof DataConnectReadSupersededError) return false; throw error; }
    // Callable dependencies have no SDK read generation. A completed refresh or
    // replacement must survive even when it shares the previous millisecond.
    return entry.read !== undefined || entry.query.state.dataUpdateCount === entry.dataUpdateCount;
  };
  const retirement: CommittedEventRetirement = {
    trackReadFence(ref: EventRef, fence: () => void) {
      const key = hashKey(dataConnectQueryKey(ref));
      ownedFences.set(key, fence);
      const projection = projectionFences.get(key);
      if (projection) projection.read = fence;
      const entry = entries.get(key);
      if (entry) entry.read = fence;
    },
    trackPublished(key: QueryKey) {
      const hashed = hashKey(key);
      if (entries.has(hashed)) return;
      const query = write.client.getQueryCache().find({ queryKey: key, exact: true });
      if (query) remember(query, ownedFences.get(hashed));
    },
    publish: () => publishCommittedEventSave(write, event, retirement),
    async retire() {
      assertWriteSessionCurrent(write);
      removeSectionEventSummaries(write.client);
      assertWriteSessionCurrent(write);
      // A newer-started write may still hold a response containing an earlier
      // server snapshot. Fence its captured publication even when no TanStack
      // projection exists (for example after unmount/eviction).
      for (const [key, projection] of projectionFences) {
        const entry = entries.get(key);
        if (entry ? !current(entry) : write.client.getQueryState(dataConnectQueryKey(projection.ref)) !== undefined) continue;
        try { projection.read(); } catch (error) { if (error instanceof DataConnectReadSupersededError) continue; throw error; }
        const fence = supersedeDataConnectQueryReads(projection.ref);
        projection.read = fence;
        if (entry) entry.read = fence;
      }
      await Promise.all([...entries.values()].map(async entry => {
        if (!current(entry)) return;
        if (entry.read) entry.read = supersedeDataConnectQueryReads(queryRef(write.dc, String(entry.query.queryKey[0]), entry.query.queryKey[1] ?? undefined));
        // Reverting an initial active fetch would restore pending/idle without
        // data and no request to finish it. Surface its existing retryable error
        // state instead; retain normal snapshot reversion for cached/hidden data.
        const emptyActiveRead = entry.promise !== undefined && entry.query.state.data === undefined && entry.query.isActive();
        await write.client.cancelQueries({ queryKey: entry.query.queryKey, exact: true }, emptyActiveRead ? { revert: false } : undefined);
        // Cancellation may revert TanStack's invalidated flag. Retire after it
        // settles, but do not invalidate a new read/query created during await.
        if (!current(entry)) return;
        await write.client.invalidateQueries({ queryKey: entry.query.queryKey, exact: true, refetchType: "none" });
        assertWriteSessionCurrent(write);
      }));
      assertWriteSessionCurrent(write);
    },
  };
  return retirement;
}

/** A confirmed response still retires stale projections after its editor leaves. */
export async function retireCommittedEventSave(write: EventSaveCacheWrite, event: CanonicalCommittedEvent): Promise<void> {
  await captureCommittedEventRetirement(write, event).retire();
}
function listRow(event: CanonicalCommittedEvent): NonNullable<GetEventsForSectionData["section"]>["events"][number] {
  return {
    id: event.id, title: event.title, location: event.location, guestOfHonour: event.guestOfHonour,
    sponsors: event.sponsors, details: event.details, startDateTime: event.startDateTime, endDateTime: event.endDateTime,
    bookingStartDateTime: event.bookingStartDateTime, bookingEndDateTime: event.bookingEndDateTime,
    maxGuestsWithoutModeratorApproval: event.maxGuestsWithoutModeratorApproval,
  };
}

/** Install a confirmed full response without a second network round trip.
 * SDK cache has no supported setter. Actual app event reads stay SERVER_ONLY, so
 * even a late old SDK cache write cannot return through a later app refetch.
 */
export async function applyCommittedEventSave(write: EventSaveCacheWrite, event: CanonicalCommittedEvent): Promise<void> {
  const retirement = captureCommittedEventRetirement(write, event);
  try {
    await retirement.publish();
  } catch (error) {
    if (error instanceof DataConnectReadSupersededError) await retirement.retire();
    throw error;
  }
}

async function publishCommittedEventSave(write: EventSaveCacheWrite, event: CanonicalCommittedEvent, retirement: CommittedEventRetirement): Promise<void> {
  assertWriteCurrent(write);
  const refs = projectionRefs(write.client, write.dc, write.scope, event.id);
  for (const ref of refs) {
    const captured = write.reads.get(hashKey(dataConnectQueryKey(ref)));
    if (captured) captured();
    else {
      // A query first introduced after capture may already contain a more recent
      // full read (including child changes). Preserve it and reconcile read-only.
      if (write.client.getQueryState(dataConnectQueryKey(ref))) throw new DataConnectReadSupersededError();
    }
  }
  const metadataRefs = write.client.getQueryCache().getAll()
    .filter(query => metadataQueryNames.includes(String(query.queryKey[0])))
    .map(query => queryRef<unknown, unknown>(write.dc, String(query.queryKey[0]), query.queryKey[1] ?? undefined));
  // Cancellation can resolve a TanStack explicit-refresh awaiter with reverted
  // data. Supersede its SDK read fence as well so it cannot report stale success.
  const fences = [...refs, ...metadataRefs].map(ref => {
    const fence = supersedeDataConnectQueryReads(ref);
    retirement.trackReadFence(ref, fence);
    return fence;
  });
  const assertPublicationCurrent = () => {
    assertWriteCurrent(write);
    fences.forEach(assertLatest => assertLatest());
  };
  removeSectionEventSummaries(write.client);
  assertPublicationCurrent();
  await Promise.all([
    ...refs.map(ref => write.client.cancelQueries({ queryKey: dataConnectQueryKey(ref), exact: true })),
    write.client.cancelQueries({ predicate: query => isMetadataDependency(query.queryKey, write.scope, event.id) }),
  ]);
  assertPublicationCurrent();
  await write.client.invalidateQueries({ predicate: query => isMetadataDependency(query.queryKey, write.scope, event.id), refetchType: "none" });
  assertPublicationCurrent();
  const staleLists: QueryKey[] = [];
  for (const ref of refs) {
    assertPublicationCurrent();
    const key = dataConnectQueryKey(ref);
    // Register an authoritative queryFn even for a newly seeded, unmounted detail.
    const options = dataConnectQueryOptions(ref);
    write.client.setQueryDefaults(key, { queryFn: context => {
      if (typeof options.queryFn !== "function") throw new Error("The authoritative event reader is unavailable.");
      return options.queryFn({ ...context, queryKey: key });
    } });
    assertPublicationCurrent();
    if (ref.name === "GetEventById") {
      write.client.setQueryData<GetEventByIdData>(key, { event });
    } else {
      const prior = write.client.getQueryState(key);
      write.client.setQueryData<GetEventsForSectionData>(key, old => {
        if (!old?.section || !idsEqual(old.section.id, write.scope.sectionId) || !Array.isArray(old.section.events)) return old;
        const events = [...old.section.events];
        const index = events.findIndex(item => idsEqual(item.id, event.id));
        if (index < 0) events.push(listRow(event)); else events[index] = listRow(event);
        events.sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
        return { ...old, section: { ...old.section, events } };
      }, { updatedAt: prior?.dataUpdatedAt });
      // One returned event cannot renew the freshness of every other list row.
      if (prior?.isInvalidated) staleLists.push(key);
    }
    retirement.trackPublished(key);
    assertPublicationCurrent();
  }
  await Promise.all(staleLists.map(queryKey => write.client.invalidateQueries({ queryKey, exact: true, refetchType: "none" })));
  assertPublicationCurrent();
}
