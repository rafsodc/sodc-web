import { auth } from "../../config/firebase";
import { assertSessionCurrent, SessionChangedError, captureSession, isSessionCurrent, isPrivateSessionSuspended, runSessionOperation, type SessionToken } from "../appShell/sessionLifecycle";
import { extractDomainErrorCode } from "../errors/errorHandling";

export type SecurityMutationAction = "grantAdmin" | "revokeAdmin" | "updateMembershipStatus" |
  "resignMembership" | "updateUserEmail" | "confirmPotentialLostMember" | "reconcileMyEmail";
type Input = Record<string, string | number | boolean | null>;

const REFUSALS: Record<string, string> = {
  MEMBERSHIP_STATUS_SAVED_REFRESH_FAILED: "Your membership status was saved, but your session could not be refreshed. Some other changes may still need saving. Retry to finish, or reload this page.",
  LAST_ADMIN_REQUIRED: "Keep at least one active, verified administrator. Give another eligible member administrator access before trying this change again.",
  ADMIN_SAFETY_RECOVERY_REQUIRED: "Administrator access needs recovery. Contact site support before trying this change again.",
  SECURITY_OPERATION_CONFLICT: "This request no longer matches the original change. Close and reopen the form before trying again.",
  SECURITY_CONFLICT_RETRY: "The change could not be confirmed. Try again to check and finish the same request.",
};
export function securityMutationError(error: unknown, fallback: string): string {
  return REFUSALS[extractDomainErrorCode(error) ?? ""] ?? fallback;
}

function uncertain(error: unknown) {
  const domain = extractDomainErrorCode(error);
  if (domain === "SECURITY_CONFLICT_RETRY" || domain === "EMAIL_CHANGE_INCOMPLETE") return true;
  if (domain && REFUSALS[domain]) return false;
  const code = error && typeof error === "object" && "code" in error ? String(error.code).replace(/^functions\//, "") : "";
  return !["invalid-argument", "failed-precondition", "permission-denied", "unauthenticated", "not-found", "already-exists", "resource-exhausted"].includes(code);
}
function sameSession(a: SessionToken, b: SessionToken) {
  return a.lifecycle === b.lifecycle && a.uid === b.uid && a.generation === b.generation;
}
function assertOwner(session: SessionToken) {
  assertSessionCurrent(session);
  // Firebase may publish currentUser before its auth observer retires A's UI.
  // This request must still belong to the originally accepted caller.
  if (!session.uid || auth.currentUser?.uid !== session.uid) throw new SessionChangedError();
}
function newOperationId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One in-memory intent, shared by security writers. No storage, automatic retry,
 * or growing per-member map. Changing ANY action/input retires the prior intent,
 * including revoke -> grant -> revoke, which must not reuse the first revocation.
 */
export function createSecurityMutationRunner(createId = newOperationId) {
  let current: { signature: string; session: SessionToken; operationId: string; pending: boolean; promise: Promise<unknown> } | null = null;
  return function run<T extends Input, Result>(action: SecurityMutationAction, input: T,
    operation: (request: T & { operationId: string }) => Promise<Result>): Promise<Result> {
    const accepted = captureSession();
    const session = accepted.lifecycle ? accepted : captureSession(auth.currentUser?.uid ?? null);
    try { assertOwner(session); } catch (error) { current = null; return Promise.reject(error); }
    const signature = JSON.stringify([action, Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)))]);
    const previous = current;
    const reusable = previous && previous.signature === signature && sameSession(previous.session, session) && isSessionCurrent(session);
    if (reusable && previous.pending) return previous.promise as Promise<Result>;
    const attempt = { signature, session, operationId: reusable ? previous.operationId : createId(), pending: true, promise: Promise.resolve() as Promise<unknown> };
    current = attempt;
    // Reserve before running code that can synchronously re-enter a wrapper.
    attempt.promise = Promise.resolve().then(() => runSessionOperation(async () => {
      assertOwner(session);
      try {
        const result = await operation({ ...input, operationId: attempt.operationId });
        assertOwner(session);
        return result;
      } catch (error) { assertOwner(session); throw error; }
    }, session)).then(result => {
      if (current === attempt) current = null;
      return result;
    }, error => {
      if (current === attempt) {
        if (isSessionCurrent(session) && auth.currentUser?.uid === session.uid && !isPrivateSessionSuspended(session) && uncertain(error)) attempt.pending = false;
        else current = null;
      }
      throw error;
    });
    return attempt.promise as Promise<Result>;
  };
}

export const runSecurityMutation = createSecurityMutationRunner();
