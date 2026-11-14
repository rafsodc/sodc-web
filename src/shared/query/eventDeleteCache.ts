import { hashKey, type QueryClient } from "@tanstack/react-query";
import { queryRef, type DataConnect } from "firebase/data-connect";
import { assertSessionCurrent, captureSession, SessionChangedError, type SessionToken } from "../appShell/sessionLifecycle";
import { authorizationReadEpoch, privateReadsBlocked } from "../auth/authorizationUpdate";
import { idsEqual, toCanonicalUuid } from "../utils/uuid";
import { dataConnectQueryKey, DataConnectReadSupersededError, supersedeDataConnectQueryReads } from "./authoritativeDataConnect";
import { removeSectionEventSummaries } from "./sectionEventSummaryCache";

interface EventDeleteCacheWrite {
  client: QueryClient;
  dc: DataConnect;
  eventId: string;
  session: SessionToken;
  epoch: number;
}

/** Keep the deleting session even if its route is replaced before the reply. */
export function captureEventDeleteCacheWrite(client: QueryClient, dc: DataConnect, eventId: string): EventDeleteCacheWrite {
  const write = { client, dc, eventId, session: captureSession(), epoch: authorizationReadEpoch() };
  assertEventDeleteCurrent(write);
  return write;
}

export function assertEventDeleteCurrent(write: EventDeleteCacheWrite) {
  assertSessionCurrent(write.session);
  if (privateReadsBlocked(write.session) || authorizationReadEpoch() !== write.epoch) throw new SessionChangedError();
}

/** A confirmed delete retires hidden details without fetching or inventing data.
 * Fence the SDK as well as TanStack: its transport may ignore cancellation.
 */
export async function retireDeletedEventDetail(write: EventDeleteCacheWrite): Promise<void> {
  assertEventDeleteCurrent(write);
  // A bundle may have started after the pre-delete retirement but before commit.
  removeSectionEventSummaries(write.client);
  assertEventDeleteCurrent(write);
  const ids = new Set([write.eventId]);
  try { ids.add(toCanonicalUuid(write.eventId)); } catch { /* Non-UUID fixtures keep their exact key. */ }
  for (const query of write.client.getQueryCache().getAll()) {
    const [name, variables] = query.queryKey;
    if (name !== "GetEventById" || typeof variables !== "object" || variables === null || !("id" in variables)) continue;
    if (typeof variables.id === "string" && idsEqual(variables.id, write.eventId)) ids.add(variables.id);
  }
  const refs = [...ids].map(id => queryRef(write.dc, "GetEventById", { id }));
  const details = new Map(refs.map(ref => [hashKey(dataConnectQueryKey(ref)), {
    key: dataConnectQueryKey(ref), assertLatest: supersedeDataConnectQueryReads(ref),
  }]));
  for (const detail of details.values()) {
    const current = () => {
      assertEventDeleteCurrent(write);
      try { detail.assertLatest(); return true; }
      catch (error) { if (error instanceof DataConnectReadSupersededError) return false; throw error; }
    };
    if (!current()) continue;
    await write.client.cancelQueries({ queryKey: detail.key, exact: true });
    // Preserve a newer authoritative read started during cancellation. Continue
    // retiring the other aliases rather than abandoning all remaining details.
    if (!current()) continue;
    await write.client.invalidateQueries({ queryKey: detail.key, exact: true, refetchType: "none" });
    assertEventDeleteCurrent(write);
  }
}
