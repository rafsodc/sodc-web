import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { captureSession, isPrivateSessionSuspended, isSessionCurrent, type SessionLifecycle, type SessionToken } from "../appShell/sessionLifecycle";

interface DraftStore {
  uid: string;
  generation: number;
  values: Map<string, unknown>;
  unsubscribe: () => void;
}
const stores = new WeakMap<SessionLifecycle, DraftStore>();
const MAX_DRAFTS = 40;

function available(session: SessionToken): boolean {
  return isSessionCurrent(session) && !isPrivateSessionSuspended(session);
}
function read<T>(session: SessionToken, key: string): { value: T } | undefined {
  if (!session.lifecycle || !session.uid || !available(session)) return undefined;
  const store = stores.get(session.lifecycle);
  if (store?.uid !== session.uid || store.generation !== session.generation || !store.values.has(key)) return undefined;
  return { value: store.values.get(key) as T };
}
function readOr<T>(session: SessionToken, key: string, fallback: () => T): T {
  const stored = read<T>(session, key);
  return stored ? stored.value : fallback();
}
function write<T>(session: SessionToken, key: string, value: T): void {
  if (!session.lifecycle || !session.uid || !available(session)) return;
  const owner = session.lifecycle;
  let store = stores.get(owner);
  if (store?.uid !== session.uid || store.generation !== session.generation) {
    store?.unsubscribe();
    const next: DraftStore = { uid: session.uid, generation: session.generation, values: new Map(), unsubscribe: () => {} };
    next.unsubscribe = owner.subscribe(() => {
      if (available(session)) return;
      next.values.clear();
      if (stores.get(owner) === next) stores.delete(owner);
      next.unsubscribe();
    });
    stores.set(owner, next);
    store = next;
  }
  store.values.delete(key);
  store.values.set(key, value);
  while (store.values.size > MAX_DRAFTS) store.values.delete(store.values.keys().next().value!);
}
function remove(session: SessionToken, key: string): void {
  if (!session.lifecycle || !available(session)) return;
  const store = stores.get(session.lifecycle);
  if (store?.uid === session.uid && store.generation === session.generation) store.values.delete(key);
}
interface LocalDraft<T> { session: SessionToken; key: string; value: T }
function matches<T>(entry: LocalDraft<T>, session: SessionToken, key: string): boolean {
  return entry.key === key && entry.session.lifecycle === session.lifecycle && entry.session.uid === session.uid && entry.session.generation === session.generation;
}
const initialValue = <T,>(initial: T | (() => T)): T => typeof initial === "function" ? (initial as () => T)() : initial;

/** Keep bounded drafts across SPA navigation in this signed-in document only.
 * No browser storage is used. Session retirement clears values synchronously;
 * resource IDs must be part of the key. Discard after saving or intentional Cancel.
 */
export function useSessionDraft<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>, () => void] {
  const session = captureSession();
  const [local, setLocal] = useState<LocalDraft<T>>(() => ({ session, key, value: readOr(session, key, () => initialValue(initial)) }));
  const value = available(session) ? (matches(local, session, key) ? local.value : readOr(session, key, () => initialValue(initial))) : initialValue(initial);
  const update: Dispatch<SetStateAction<T>> = (action) => {
    if (!available(session)) return;
    if (!session.lifecycle || !session.uid) {
      // Isolated/anonymous consumers retain ordinary React state, never a cache.
      setLocal(previous => {
        const current = matches(previous, session, key) ? previous.value : initialValue(initial);
        return { session, key, value: typeof action === "function" ? (action as (previous: T) => T)(current) : action };
      });
      return;
    }
    const previous = readOr(session, key, () => matches(local, session, key) ? local.value : initialValue(initial));
    const next = typeof action === "function" ? (action as (previous: T) => T)(previous) : action;
    write(session, key, next);
    setLocal({ session, key, value: next });
  };
  const discard = () => {
    if (!available(session)) return;
    remove(session, key);
    setLocal({ session, key, value: initialValue(initial) });
  };
  return [value, update, discard];
}

/** SPA moves restore drafts; leaving/reloading the document needs the browser's
 * standard unload warning. Retired sessions never block logout or recovery.
 */
export function useDraftUnloadWarning(dirty: boolean): void {
  const session = captureSession();
  const { lifecycle, uid, generation } = session;
  const warn = useCallback((event: BeforeUnloadEvent) => {
    if (!dirty || !available({ lifecycle, uid, generation })) return;
    event.preventDefault();
    event.returnValue = "";
  }, [dirty, lifecycle, uid, generation]);
  useEffect(() => {
    if (!dirty) return;
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, warn]);
}
