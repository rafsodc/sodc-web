import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  captureSession,
  isPrivateSessionSuspended,
  isSessionCurrent,
  SessionChangedError,
  type SessionLifecycle,
  type SessionToken,
} from "../appShell/sessionLifecycle";

export type SessionMutationStatus = "idle" | "pending" | "success" | "error";
interface MutationSnapshot<T> {
  status: SessionMutationStatus;
  result: T | undefined;
  error: unknown | null;
}
interface MutationEntry<T> {
  promise: Promise<T>;
  snapshot: MutationSnapshot<T>;
}
interface MutationJournal {
  uid: string | null;
  generation: number;
  entries: Map<string, MutationEntry<unknown>>;
  listeners: Set<() => void>;
  unsubscribe: () => void;
}
const journals = new WeakMap<SessionLifecycle, MutationJournal>();
const IDLE: MutationSnapshot<never> = Object.freeze({ status: "idle", result: undefined, error: null });
const available = (session: SessionToken) => isSessionCurrent(session) && !isPrivateSessionSuspended(session);
const publish = (journal: MutationJournal) => journal.listeners.forEach(listener => listener());
function clear(journal: MutationJournal): void {
  journal.entries.clear();
  journal.unsubscribe();
  publish(journal);
}
function emptyJournal(session: SessionToken): MutationJournal {
  return { uid: session.uid, generation: session.generation, entries: new Map(), listeners: new Set(), unsubscribe: () => {} };
}
function findJournal(session: SessionToken, isolated: MutationJournal): MutationJournal | undefined {
  if (!available(session)) return undefined;
  const journal = session.lifecycle && session.uid ? journals.get(session.lifecycle) : isolated;
  return journal?.uid === session.uid && journal.generation === session.generation ? journal : undefined;
}
function clearUnavailableJournal(session: SessionToken, isolated: MutationJournal): void {
  const journal = session.lifecycle && session.uid ? journals.get(session.lifecycle) : isolated;
  if (!journal || available(session) || journal.uid !== session.uid || journal.generation !== session.generation) return;
  if (session.lifecycle && journals.get(session.lifecycle) === journal) journals.delete(session.lifecycle);
  clear(journal);
}
function ensureJournal(session: SessionToken, isolated: MutationJournal): MutationJournal | undefined {
  if (!available(session)) { clearUnavailableJournal(session, isolated); return undefined; }
  const previous = findJournal(session, isolated);
  if (previous) return previous;
  if (!session.lifecycle || !session.uid) return isolated;
  const journal = emptyJournal(session);
  const owner = session.lifecycle;
  journal.unsubscribe = owner.subscribe(() => clearUnavailableJournal(session, isolated));
  journals.set(owner, journal);
  return journal;
}

/** A resource's pending or settled write survives SPA navigation in this private
 * document. A failure may mean the server committed: runOnce reuses its rejection
 * until the caller reconciles server state and explicitly acknowledges it.
 * Pending writes cannot be acknowledged. No storage or automatic retries are used.
 */
export function useSessionMutation<T>(resourceKey: string) {
  const { lifecycle, uid, generation } = captureSession();
  const session = useMemo(() => ({ lifecycle, uid, generation }), [lifecycle, uid, generation]);
  const isolated = useMemo(() => emptyJournal(session), [session]);
  const resource = useMemo(() => ({ session, key: resourceKey }), [session, resourceKey]);
  // Suspension is intentionally one-way; clear receipts on its next render even
  // when no mutation is pending and therefore no completion will do the cleanup.
  useLayoutEffect(() => { clearUnavailableJournal(session, isolated); });
  const active = useRef<typeof resource | null>(resource);
  useLayoutEffect(() => {
    active.current = resource;
    return () => { if (active.current === resource) active.current = null; };
  }, [resource]);
  const subscribe = useCallback((listener: () => void) => {
    const journal = ensureJournal(session, isolated);
    if (!journal) return () => {};
    journal.listeners.add(listener);
    return () => {
      journal.listeners.delete(listener);
      if (!available(session)) clearUnavailableJournal(session, isolated);
    };
  }, [session, isolated]);
  const snapshot = useCallback((): MutationSnapshot<T> => {
    const journal = findJournal(session, isolated);
    return journal?.entries.get(resourceKey)?.snapshot as MutationSnapshot<T> | undefined ?? IDLE;
  }, [session, resourceKey, isolated]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  const runOnce = useCallback((operation: () => Promise<T>): Promise<T> => {
    if (active.current !== resource || !available(session)) return Promise.reject(new SessionChangedError());
    const journal = ensureJournal(session, isolated);
    if (!journal) return Promise.reject(new SessionChangedError());
    const existing = journal.entries.get(resourceKey);
    if (existing) return existing.promise as Promise<T>;
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((done, failed) => { resolve = done; reject = failed; });
    // Keep abandoned navigation promises handled while retaining rejection for callers.
    void promise.catch(() => {});
    const entry: MutationEntry<T> = { promise, snapshot: { status: "pending", result: undefined, error: null } };
    journal.entries.set(resourceKey, entry as MutationEntry<unknown>);
    publish(journal);
    const current = () => available(session) && findJournal(session, isolated) === journal && journal.entries.get(resourceKey) === entry;
    const fail = (error: unknown) => {
      if (!current()) { clearUnavailableJournal(session, isolated); reject(new SessionChangedError()); return; }
      entry.snapshot = { status: "error", result: undefined, error };
      publish(journal);
      reject(error);
    };
    try {
      void Promise.resolve(operation()).then(result => {
        if (!current()) { clearUnavailableJournal(session, isolated); reject(new SessionChangedError()); return; }
        entry.snapshot = { status: "success", result, error: null };
        publish(journal);
        resolve(result);
      }, fail);
    } catch (error) {
      fail(error);
    }
    return promise;
  }, [resource, session, resourceKey, isolated]);

  const acknowledge = useCallback(() => {
    if (active.current !== resource || !available(session)) return;
    const journal = findJournal(session, isolated);
    if (!journal || journal.entries.get(resourceKey)?.snapshot.status === "pending") return;
    journal.entries.delete(resourceKey);
    publish(journal);
  }, [resource, session, resourceKey, isolated]);

  return { ...state, pending: state.status === "pending", runOnce, acknowledge };
}
