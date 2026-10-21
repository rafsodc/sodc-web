import type { SessionToken } from "../appShell/sessionLifecycle";

// A single bounded, document-local gate. Only an explicitly started own-status
// change may defer denials; identity/generation changes never inherit the gate.
interface Update {
  session: SessionToken;
  promise: Promise<void>;
  release: () => void;
  pending: boolean;
  denial: (() => void) | null;
}
let update: Update | null = null;
let epoch = 0;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
export function subscribeAuthorizationUpdates(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const sameOwner = (a: SessionToken, b: SessionToken) => a.lifecycle === b.lifecycle && a.uid === b.uid && a.generation === b.generation;
export const authorizationReadEpoch = () => epoch;
export function authorizationUpdatePending(session: SessionToken) {
  return Boolean(update?.pending && sameOwner(update.session, session));
}
export function privateReadsBlocked(session: SessionToken) {
  return Boolean(update && sameOwner(update.session, session));
}
export async function waitForAuthorizationUpdate(session: SessionToken) {
  const owner = update;
  if (owner && sameOwner(owner.session, session) && owner.pending) await owner.promise;
}
export function deferAuthorizationDenial(session: SessionToken, deliver: () => void) {
  if (!update?.pending || !sameOwner(update.session, session)) return false;
  update.denial = deliver;
  return true;
}
export function beginAuthorizationUpdate(session: SessionToken) {
  if (update?.pending && sameOwner(update.session, session)) throw new Error("An account change is already in progress. Please wait.");
  let release!: () => void;
  const owner: Update = { session, promise: new Promise<void>(done => { release = done; }), release: () => release(), pending: true, denial: null };
  update?.release();
  update = owner;
  epoch += 1; // Old read completions must not publish old data or start recovery.
  publish();
  return {
    finish(verified: boolean, blockReads = false) {
      if (update !== owner) return;
      owner.pending = false;
      if (!blockReads) update = null;
      epoch += 1;
      owner.release();
      publish();
      if (!verified) owner.denial?.();
      owner.denial = null;
    },
  };
}
export function resumeAuthorizationReads(session: SessionToken) {
  if (update && !update.pending && sameOwner(update.session, session)) { update = null; epoch += 1; publish(); }
}
