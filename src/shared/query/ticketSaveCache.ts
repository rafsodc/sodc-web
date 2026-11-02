import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryRef, type DataConnect } from "firebase/data-connect";
import type { GetEventByIdData, TimestampString } from "@dataconnect/generated";
import { assertSessionCurrent, captureSession, SessionChangedError } from "../appShell/sessionLifecycle";
import { authorizationReadEpoch, privateReadsBlocked } from "../auth/authorizationUpdate";
import { idsEqual } from "../utils/uuid";
import { supersedeDataConnectQueryReads } from "./authoritativeDataConnect";
import { removeSectionEventSummaries } from "./sectionEventSummaryCache";
import {
  applyCommittedEventSave, assertCanonicalCommittedEvent, captureEventSaveCacheWrite,
  type CanonicalCommittedEvent,
} from "./eventSaveCache";

type StoredTicket = NonNullable<GetEventByIdData["event"]>["ticketTypes"][number];
export type CanonicalCommittedTicket = StoredTicket & {
  updatedAt: TimestampString;
  event: { id: string; section: { id: string } };
};
interface TicketSaveScope { sectionId: string; eventId: string; ticketTypeId: string }
interface TicketDependencyScope { sectionId: string; eventId: string; ticketTypeId?: string }
interface TicketSaveCacheWrite {
  parent: ReturnType<typeof captureEventSaveCacheWrite>;
  scope: TicketSaveScope;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const nullableText = (value: unknown) => value === null || typeof value === "string";
const unverified = () => new Error("The committed ticket response could not be verified. Load the saved change from the server.");

/** A transport success alone does not confirm the intended ticket was committed. */
export function assertCanonicalCommittedTicket(value: unknown, scope: TicketSaveScope): asserts value is CanonicalCommittedTicket {
  if (!record(value) || typeof value.id !== "string" || !value.id || !idsEqual(value.id, scope.ticketTypeId) ||
    !record(value.event) || typeof value.event.id !== "string" || !idsEqual(value.event.id, scope.eventId) ||
    !record(value.event.section) || typeof value.event.section.id !== "string" || !idsEqual(value.event.section.id, scope.sectionId) ||
    typeof value.title !== "string" || !nullableText(value.description) ||
    !["MEMBER", "GUEST", "ORGANISER_GUEST"].includes(String(value.audience)) ||
    typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0 ||
    typeof value.includesDinner !== "boolean" || typeof value.includesSymposium !== "boolean" || !Number.isInteger(value.sortOrder) ||
    typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !record(value.userGroup) || typeof value.userGroup.id !== "string" || !value.userGroup.id || typeof value.userGroup.name !== "string" ||
    !(value.userGroup.membershipStatuses === null || (Array.isArray(value.userGroup.membershipStatuses) &&
      value.userGroup.membershipStatuses.every(status => typeof status === "string")))) {
    throw unverified();
  }
}

/** The full event and saved ticket must describe the same transactional result. */
function assertCoherentParent(ticket: CanonicalCommittedTicket, event: CanonicalCommittedEvent, scope: TicketSaveScope) {
  if (!idsEqual(event.id, scope.eventId)) throw unverified();
  const matches = event.ticketTypes.filter(row => idsEqual(row.id, ticket.id));
  if (matches.length !== 1) throw unverified();
  const row = matches[0];
  const fields = ["title", "description", "audience", "price", "includesDinner", "includesSymposium", "sortOrder"] as const;
  if (!fields.every(key => Object.is(row[key], ticket[key])) ||
    !idsEqual(row.userGroup.id, ticket.userGroup.id) || row.userGroup.name !== ticket.userGroup.name ||
    JSON.stringify(row.userGroup.membershipStatuses) !== JSON.stringify(ticket.userGroup.membershipStatuses)) throw unverified();
}

/** Validate this inside the mutation callback before its successful receipt is
 * recorded. A malformed 200 response remains uncertain, rather than a confirmed
 * save whose cache publication happened to fail.
 */
export function assertCanonicalCommittedTicketResponse(ticket: unknown, event: unknown, scope: TicketSaveScope): void {
  assertCanonicalCommittedTicket(ticket, scope);
  assertCanonicalCommittedEvent(event, scope);
  assertCoherentParent(ticket, event, scope);
}

/** Capture once inside the mutation callback, never when replaying a retained receipt. */
export function captureTicketSaveCacheWrite(client: QueryClient, dc: DataConnect, scope: TicketSaveScope): TicketSaveCacheWrite {
  return { parent: captureEventSaveCacheWrite(client, dc, scope), scope: { ...scope } };
}

function assertCurrent(write: TicketSaveCacheWrite) {
  assertSessionCurrent(write.parent.session);
  if (privateReadsBlocked(write.parent.session) || authorizationReadEpoch() !== write.parent.epoch) throw new SessionChangedError();
  write.parent.assertLatestWrite();
}

// These projections join current catalogue metadata. Historical payment adjustment
// amounts do not depend on it and must not be rewritten or unnecessarily retired.
const scopedDataConnectDependencies = new Set(["GetMyBookingsForEvent", "ListEventBookingsForAdmin", "ListTicketOrdersForAdmin"]);
const scopedCallableDependencies = new Set(["managed-event-tickets", "eventAttendees"]);
const aggregateDataConnectDependencies = new Set(["GetMyBookings", "GetMyTicketOrderById", "GetMyTicketOrders", "GetMyBookingPaymentAdjustments"]);
function isTicketMetadataDependency(key: QueryKey, scope: TicketDependencyScope) {
  const [name, variables] = key;
  return aggregateDataConnectDependencies.has(String(name)) ||
    (scopedDataConnectDependencies.has(String(name)) && record(variables) &&
      typeof variables.eventId === "string" && idsEqual(variables.eventId, scope.eventId)) ||
    ((scopedCallableDependencies.has(String(name)) || name === "organiser-guests") &&
      typeof variables === "string" && idsEqual(variables, scope.eventId)) ||
    (name === "guest-section-events" && typeof variables === "string" && idsEqual(variables, scope.sectionId));
}

/** A retained receipt is never installed over a later server read. Recovery can
 * retire just its dependent metadata after that read, without inventing a ticket
 * timestamp, advancing event write ordering or making any network requests.
 */
export async function retireTicketSaveDependencies(client: QueryClient, dc: DataConnect, scope: TicketDependencyScope): Promise<void> {
  const session = captureSession();
  const epoch = authorizationReadEpoch();
  const capturedScope = { ...scope };
  const assertCurrentSession = () => {
    assertSessionCurrent(session);
    if (privateReadsBlocked(session) || authorizationReadEpoch() !== epoch) throw new SessionChangedError();
  };
  assertCurrentSession();
  const dependencies = client.getQueryCache().getAll().filter(query => isTicketMetadataDependency(query.queryKey, capturedScope));
  const fences = dependencies.filter(query => scopedDataConnectDependencies.has(String(query.queryKey[0])) ||
    aggregateDataConnectDependencies.has(String(query.queryKey[0])))
    .map(query => supersedeDataConnectQueryReads(queryRef<unknown, unknown>(dc, String(query.queryKey[0]), query.queryKey[1] ?? undefined)));
  const assertRetirementCurrent = () => { assertCurrentSession(); fences.forEach(assertLatest => assertLatest()); };
  // Retire bundled/member summaries even when a later cancellation fails.
  removeSectionEventSummaries(client);
  assertRetirementCurrent();
  // Cancellation can resolve explicit refresh awaiters with reverted data. The DC
  // generations above also fence transports that ignore TanStack cancellation.
  await client.cancelQueries({ predicate: query => isTicketMetadataDependency(query.queryKey, capturedScope) });
  assertRetirementCurrent();
  await client.invalidateQueries({ predicate: query => isTicketMetadataDependency(query.queryKey, capturedScope), refetchType: "none" });
  assertRetirementCurrent();
}

/** Publish the confirmed full parent without fetching hidden panels. The parent
 * writer shares event/sibling-ticket ordering, session and SDK read fences, and
 * retires aggregate/member/guest projections. All later app reads are SERVER_ONLY;
 * no unsupported SDK cache setter or optimistic financial/permission update is used.
 */
export async function applyCommittedTicketSave(
  write: TicketSaveCacheWrite, ticket: CanonicalCommittedTicket, event: CanonicalCommittedEvent,
): Promise<void> {
  assertCanonicalCommittedTicketResponse(ticket, event, write.scope);
  assertCurrent(write);
  const { client, dc } = write.parent;
  await retireTicketSaveDependencies(client, dc, write.scope);
  assertCurrent(write);
  await applyCommittedEventSave(write.parent, event);
  assertCurrent(write);
}
