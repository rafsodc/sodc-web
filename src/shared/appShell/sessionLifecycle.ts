export class SessionChangedError extends Error {
  constructor() {
    super("The account session has changed. Sign in again to continue.");
    this.name = "SessionChangedError";
  }
}

export interface SessionSnapshot {
  initialized: boolean;
  uid: string | null;
  generation: number;
  phase: "active" | "retiring" | "failed";
}

export function createSessionLifecycle() {
  let snapshot: SessionSnapshot = { initialized: false, uid: null, generation: 0, phase: "active" };
  const listeners = new Set<() => void>();
  const publish = (next: SessionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    observe(uid: string | null) {
      if (snapshot.phase !== "active") return false;
      if (snapshot.initialized && snapshot.uid === uid) return true;
      if (snapshot.uid !== null && snapshot.uid !== uid) {
        this.retire();
        return false;
      }
      // An anonymous document has never hosted private data. First sign-in stays
      // in this document, including when Firebase uses in-memory persistence.
      publish({ ...snapshot, initialized: true, uid, generation: snapshot.generation + 1 });
      return true;
    },
    retire() {
      if (snapshot.phase !== "active") return;
      publish({ ...snapshot, uid: null, phase: "retiring", generation: snapshot.generation + 1 });
    },
    fail() {
      if (snapshot.phase === "retiring") publish({ ...snapshot, phase: "failed" });
    },
  };
}

export type SessionLifecycle = ReturnType<typeof createSessionLifecycle>;
export interface RetirementOptions { returnTo?: string; reason?: string }
interface SessionRuntime {
  lifecycle: SessionLifecycle;
  retire: (options?: RetirementOptions) => void;
  signOut: (options?: RetirementOptions) => Promise<void>;
}
let runtime: SessionRuntime | null = null;

export function installSessionRuntime(next: SessionRuntime) {
  runtime = next;
  return () => { if (runtime === next) runtime = null; };
}

export interface SessionToken {
  lifecycle: SessionLifecycle | null;
  uid: string | null;
  generation: number;
}
export function captureSession(uid: string | null = runtime?.lifecycle.getSnapshot().uid ?? null): SessionToken {
  return { lifecycle: runtime?.lifecycle ?? null, uid, generation: runtime?.lifecycle.getSnapshot().generation ?? 0 };
}
export function isSessionCurrent(token: SessionToken) {
  if (!token.lifecycle) return runtime === null;
  const current = token.lifecycle.getSnapshot();
  return runtime?.lifecycle === token.lifecycle && current.phase === "active" &&
    current.generation === token.generation && current.uid === token.uid;
}
export function assertSessionCurrent(token: SessionToken) {
  if (!isSessionCurrent(token)) throw new SessionChangedError();
}
export function assertSessionAvailable() {
  if (runtime && runtime.lifecycle.getSnapshot().phase !== "active") throw new SessionChangedError();
}
// Authentication workflows deliberately cross the first anonymous -> UID boundary.
// Admit only that first identity; replacing an authenticated account retires instead.
export function acceptAuthenticatedIdentity(uid: string) {
  if (runtime && !runtime.lifecycle.observe(uid)) {
    runtime.retire();
    throw new SessionChangedError();
  }
  return captureSession(uid);
}
export async function runSessionOperation<T>(operation: () => Promise<T>, token = captureSession()): Promise<T> {
  assertSessionCurrent(token);
  try {
    const result = await operation();
    assertSessionCurrent(token);
    return result;
  } catch (error) {
    assertSessionCurrent(token);
    throw error;
  }
}
// Guest links are bearer capabilities independent of the signed-in UID. A first
// sign-in must not invalidate them, but retiring the document still fences work.
export async function runCapabilityOperation<T>(operation: () => Promise<T>): Promise<T> {
  const owner = runtime?.lifecycle ?? null;
  const current = () => owner ? runtime?.lifecycle === owner && owner.getSnapshot().phase === "active" : runtime === null;
  if (!current()) throw new SessionChangedError();
  try {
    const result = await operation();
    if (!current()) throw new SessionChangedError();
    return result;
  } catch (error) {
    if (!current()) throw new SessionChangedError();
    throw error;
  }
}

export function retirePrivateSession(options?: RetirementOptions) {
  runtime?.retire(options);
}
export async function signOutPrivateSession(options?: RetirementOptions) {
  if (runtime) return runtime.signOut(options);
  // Isolated consumers (e.g. an embedded account dialog) still use Firebase's
  // sign-out; the mounted application always installs the document boundary.
  const [{ signOut }, { auth }] = await Promise.all([import("firebase/auth"), import("../../config/firebase")]);
  await signOut(auth);
}
