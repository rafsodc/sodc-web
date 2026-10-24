import { classifyAuthorizationFailure } from "./authorizationFailure";
import type { SessionToken } from "../appShell/sessionLifecycle";
import { deferAuthorizationDenial } from "./authorizationUpdate";

export interface AuthorizationDenial { error: unknown; session: SessionToken }
const listeners = new Set<(denial: AuthorizationDenial) => void>();
/** Private imperative work shares the same coordinator as generated cache errors. */
export function reportAuthorizationDenial(error: unknown, session: SessionToken): boolean {
  if (!classifyAuthorizationFailure(error)) return false;
  const deliver = () => listeners.forEach(listener => listener({ error, session }));
  if (!deferAuthorizationDenial(session, deliver)) deliver();
  return true;
}
export function subscribeAuthorizationDenials(listener: (denial: AuthorizationDenial) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
