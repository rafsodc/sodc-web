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
  receipt: object | null;
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
  removeUnload: (() => void) | null;
}
const journals = new WeakMap<SessionLifecycle, MutationJournal>();
const IDLE: MutationSnapshot<never> = Object.freeze({ receipt: null, status: "idle", result: undefined, error: null });
const available = (session: SessionToken) => isSessionCurrent(session) && !isPrivateSessionSuspended(session);
const publish = (journal: MutationJournal) => journal.listeners.forEach(listener => listener());
function clear(journal: MutationJournal): void {
  journal.removeUnload?.();
  journal.removeUnload = null;
  journal.entries.clear();
  journal.unsubscribe();
  publish(journal);
}
function emptyJournal(session: SessionToken): MutationJournal {
  return { uid: session.uid, generation: session.generation, entries: new Map(), listeners: new Set(), unsubscribe: () => {}, removeUnload: null };
}
/** Errors remain protected until reconciliation because a failed response may
 * hide a committed write. A known successful receipt no longer needs a warning. */
function hasUnreconciledWrite(journal: MutationJournal): boolean {
  return [...journal.entries.values()].some(entry => entry.snapshot.status === "pending" || entry.snapshot.status === "error");
}
function syncUnload(journal: MutationJournal, session: SessionToken): void {
  const privateJournal = !!session.lifecycle && !!session.uid;
  const warn = available(session) && hasUnreconciledWrite(journal) && (privateJournal || journal.listeners.size > 0);
  if (!warn) { journal.removeUnload?.(); journal.removeUnload = null; return; }
  if (journal.removeUnload || typeof window === "undefined") return;
  // The document listener must not keep an abandoned lifecycle or its private
  // receipts alive after the runtime is replaced without a retirement signal.
  const journalRef = new WeakRef(journal);
  const lifecycleRef = session.lifecycle ? new WeakRef(session.lifecycle) : null;
  const { uid, generation } = session;
  const listener = (event: BeforeUnloadEvent) => {
    const owner = journalRef.deref();
    if (!owner) { window.removeEventListener("beforeunload", listener); return; }
    const lifecycle = lifecycleRef?.deref() ?? null;
    const token = { lifecycle, uid, generation };
    if ((lifecycleRef && !lifecycle) || !available(token)) {
      if (lifecycle && journals.get(lifecycle) === owner) journals.delete(lifecycle);
      clear(owner);
      return;
    }
    if (!hasUnreconciledWrite(owner)) return;
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", listener);
  journal.removeUnload = () => window.removeEventListener("beforeunload", listener);
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
 * Pending writes cannot be acknowledged. Pending/uncertain writes retain a document
 * unload warning even while their editors are unmounted. Successful receipts do not
 * warn. No storage or automatic retries are used.
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
      syncUnload(journal, session);
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
    const entry: MutationEntry<T> = { promise, snapshot: { receipt: Object.freeze({}), status: "pending", result: undefined, error: null } };
    journal.entries.set(resourceKey, entry as MutationEntry<unknown>);
    syncUnload(journal, session);
    publish(journal);
    const current = () => available(session) && findJournal(session, isolated) === journal && journal.entries.get(resourceKey) === entry;
    const fail = (error: unknown) => {
      if (!current()) { clearUnavailableJournal(session, isolated); reject(new SessionChangedError()); return; }
      entry.snapshot = { receipt: entry.snapshot.receipt, status: "error", result: undefined, error };
      syncUnload(journal, session);
      publish(journal);
      reject(error);
    };
    try {
      void Promise.resolve(operation()).then(result => {
        if (!current()) { clearUnavailableJournal(session, isolated); reject(new SessionChangedError()); return; }
        entry.snapshot = { receipt: entry.snapshot.receipt, status: "success", result, error: null };
        syncUnload(journal, session);
        publish(journal);
        resolve(result);
      }, fail);
    } catch (error) {
      fail(error);
    }
    return promise;
  }, [resource, session, resourceKey, isolated]);

  const acknowledgeIfCurrent = useCallback((receipt: object): boolean => {
    if (active.current !== resource || !available(session)) return false;
    const journal = findJournal(session, isolated);
    const entry = journal?.entries.get(resourceKey);
    if (!journal || !entry || entry.snapshot.receipt !== receipt || entry.snapshot.status === "pending") return false;
    journal.entries.delete(resourceKey);
    syncUnload(journal, session);
    publish(journal);
    return true;
  }, [resource, session, resourceKey, isolated]);
  const acknowledge = useCallback(() => {
    const receipt = findJournal(session, isolated)?.entries.get(resourceKey)?.snapshot.receipt;
    if (receipt) acknowledgeIfCurrent(receipt);
  }, [session, resourceKey, isolated, acknowledgeIfCurrent]);

  return { ...state, pending: state.status === "pending", runOnce, acknowledge, acknowledgeIfCurrent };
}
