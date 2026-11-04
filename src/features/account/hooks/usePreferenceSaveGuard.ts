import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { captureSession, isPrivateSessionSuspended, isSessionCurrent } from "../../../shared/appShell/sessionLifecycle";
import { authorizationReadEpoch, privateReadsBlocked, subscribeAuthorizationUpdates } from "../../../shared/auth/authorizationUpdate";

/** Serialize a mounted preference control's writes/refreshes synchronously.
 * Cache refresh may finish after navigation for the same private session, while
 * feedback belongs only to the view that started it. No writes are retried.
 */
export function usePreferenceSaveGuard(key: string) {
  const { lifecycle, uid, generation } = captureSession();
  const session = useMemo(() => ({ lifecycle, uid, generation }), [lifecycle, uid, generation]);
  const resource = useMemo(() => ({ key, session }), [key, session]);
  const active = useRef<typeof resource | null>(resource);
  const pending = useRef<object | null>(null);
  const epoch = useSyncExternalStore(subscribeAuthorizationUpdates, authorizationReadEpoch, authorizationReadEpoch);
  useLayoutEffect(() => {
    active.current = resource;
    return () => { active.current = null; pending.current = null; };
  }, [resource]);

  const begin = useCallback(() => {
    const hasSessionOwner = () => isSessionCurrent(session) && !isPrivateSessionSuspended(session);
    const hasCurrentSession = () => hasSessionOwner() &&
      !privateReadsBlocked(session) && authorizationReadEpoch() === epoch;
    if (active.current !== resource || pending.current || !hasCurrentSession()) return null;
    const request = {};
    pending.current = request;
    return {
      hasCurrentSession,
      hasSessionOwner,
      // Authorization changes must still allow the owning mounted view to
      // clear pending UI and ask for a fresh read, without publishing old data.
      ownsView: () => active.current === resource && pending.current === request && hasSessionOwner(),
      isCurrent: () => active.current === resource && pending.current === request && hasCurrentSession(),
      finish: () => { if (pending.current === request) pending.current = null; },
    };
  }, [resource, session, epoch]);
  return { begin, available: isSessionCurrent(session) && !isPrivateSessionSuspended(session) && !privateReadsBlocked(session) };
}
