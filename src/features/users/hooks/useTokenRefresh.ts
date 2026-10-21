import { useEffect } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { withTimeout } from "../../../shared/utils/withTimeout";
import { captureSession, isSessionCurrent, assertSessionCurrent, type SessionToken } from "../../../shared/appShell/sessionLifecycle";

export const TOKEN_REFRESH_TIMEOUT_MS = 15_000;
interface Callback { uid: string; run: () => void; session: SessionToken }
const callbacks = new Set<Callback>();
let unsubscribe: (() => void) | null = null;
let listenerUid: string | null = null;
let lastToken: string | null = null;
let refreshInFlight: { uid: string; session: SessionToken; promise: Promise<void> } | null = null;

function notify(token: string, session: SessionToken) {
  if (!isSessionCurrent(session) || lastToken === token) return;
  lastToken = token;
  callbacks.forEach((callback) => {
    if (callback.uid === session.uid && isSessionCurrent(callback.session)) callback.run();
  });
}
export function useTokenRefresh(user: User | null, onTokenChange?: () => void) {
  useEffect(() => {
    if (!user || !onTokenChange) return;
    const session = captureSession(user.uid);
    const callback = { uid: user.uid, run: onTokenChange, session };
    callbacks.add(callback);
    if (listenerUid !== user.uid || !unsubscribe) {
      unsubscribe?.();
      listenerUid = user.uid;
      lastToken = null;
      unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (currentUser?.uid !== session.uid || !isSessionCurrent(session)) return;
        try {
          const token = await currentUser.getIdToken();
          if (listenerUid === currentUser.uid) notify(token, session);
        } catch { /* Claim readers expose a safe unresolved/denied state. */ }
      });
    }
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        unsubscribe?.();
        unsubscribe = null;
        listenerUid = null;
        lastToken = null;
        refreshInFlight = null;
      }
    };
  }, [user, onTokenChange]);
}
export function refreshToken(user: User | null, timeoutMs = TOKEN_REFRESH_TIMEOUT_MS): Promise<void> {
  if (!user) return Promise.reject(new Error("No authenticated user to refresh"));
  const session = captureSession(user.uid);
  try { assertSessionCurrent(session); } catch (error) { return Promise.reject(error); }
  if (refreshInFlight?.uid === user.uid && isSessionCurrent(refreshInFlight.session)) return refreshInFlight.promise;
  const promise = withTimeout(user.getIdToken(true), timeoutMs, "Refreshing the authenticated session timed out")
    .then((token) => { assertSessionCurrent(session); notify(token, session); })
    .finally(() => { if (refreshInFlight?.promise === promise) refreshInFlight = null; });
  refreshInFlight = { uid: user.uid, session, promise };
  return promise;
}
