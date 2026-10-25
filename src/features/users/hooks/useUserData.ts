import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { executeQuery, QueryFetchPolicy } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import { getCurrentUserRef } from "@dataconnect/generated";
import type { UserData } from "../../../types";
import { withTimeout } from "../../../shared/utils/withTimeout";
import { refreshToken } from "./useTokenRefresh";
import { isAuthenticationFailure } from "../../../shared/auth/isAuthenticationFailure";
import { classifyAuthorizationFailure } from "../../../shared/auth/authorizationFailure";
import { privateReadsBlocked, subscribeAuthorizationUpdates } from "../../../shared/auth/authorizationUpdate";
import { captureSession, isSessionCurrent, isPrivateSessionSuspended, runSessionRead, SessionChangedError, type SessionToken } from "../../../shared/appShell/sessionLifecycle";

export const USER_DATA_REQUEST_TIMEOUT_MS = 30_000;
interface ProfileState { uid: string | null; userData: UserData | null; loading: boolean; error: Error | null }
const EMPTY: ProfileState = { uid: null, userData: null, loading: false, error: null };

export function useUserData(firebaseUser: User | null, accountEnabled?: boolean, requestTimeoutMs = USER_DATA_REQUEST_TIMEOUT_MS) {
  const uid = firebaseUser?.uid ?? null;
  const owner = useRef(uid);
  owner.current = uid;
  const sequence = useRef(0);
  const fetched = useRef<string | null>(null);
  const fetching = useRef<{ uid: string; request: number } | null>(null);
  const interrupted = useRef<SessionToken | null>(null);
  const [state, setState] = useState<ProfileState>(EMPTY);
  const previousOwner = useRef(uid);

  const fetchUserData = useCallback(async (force = false) => {
    if (!firebaseUser || accountEnabled === false) return;
    if (!force && (fetched.current === uid || fetching.current?.uid === uid)) return;
    const request = ++sequence.current;
    const token = captureSession(uid);
    const current = () => owner.current === uid && request === sequence.current && isSessionCurrent(token) && !isPrivateSessionSuspended(token);
    if (!current()) return;
    fetching.current = { uid: firebaseUser.uid, request };
    setState({ uid, userData: null, loading: true, error: null });
    try {
      let enabled: boolean;
      try {
        const claims = await withTimeout(firebaseUser.getIdTokenResult(), requestTimeoutMs, "Checking the current user's claims timed out");
        if (!current()) return;
        enabled = claims.claims.enabled === true;
      } catch {
        if (current()) fetched.current = uid;
        return;
      }
      if (!enabled) { fetched.current = uid; return; }
      let result;
      try {
        result = await withTimeout(runSessionRead(() => executeQuery(getCurrentUserRef(dataConnect), force ? { fetchPolicy: QueryFetchPolicy.SERVER_ONLY } : undefined), token), requestTimeoutMs, "Loading the current user timed out");
      } catch (error) {
        if (!current()) return;
        // Explicit current-authority failures belong to the shared coordinator,
        // which checks own status before deciding to refresh, wait or sign out.
        if (classifyAuthorizationFailure(error)) return; // runSessionRead already signalled the coordinator.
        if (error instanceof SessionChangedError) return;
        if (!isAuthenticationFailure(error)) throw error;
        // One bounded retry, still owned by the original identity/request.
        await refreshToken(firebaseUser);
        if (!current()) return;
        result = await withTimeout(runSessionRead(() => executeQuery(getCurrentUserRef(dataConnect), { fetchPolicy: QueryFetchPolicy.SERVER_ONLY }), token), requestTimeoutMs, "Retrying the current user request timed out");
      }
      if (!current()) return;
      fetched.current = uid;
      const data = result.data?.user as UserData | undefined;
      // Defense in depth if a cache/provider ever returns a different owner.
      setState({ uid, userData: data?.id === uid ? data : null, loading: false, error: null });
    } catch (error) {
      if (!current()) return;
      if (classifyAuthorizationFailure(error)) return;
      fetched.current = uid;
      setState({ uid, userData: null, loading: false,
        error: !isAuthenticationFailure(error) && error instanceof Error && !error.message.includes("not found") ? error : null });
    } finally {
      if (current()) {
        if (fetching.current?.request === request) fetching.current = null;
        setState((previous) => previous.uid === uid ? { ...previous, loading: false } : previous);
      }
    }
  }, [firebaseUser, uid, accountEnabled, requestTimeoutMs]);

  useEffect(() => {
    if (previousOwner.current !== uid || accountEnabled === false || uid === null) {
      previousOwner.current = uid;
      sequence.current += 1;
      fetched.current = null;
      fetching.current = null;
      interrupted.current = null;
      setState(EMPTY);
    }
    void fetchUserData();
  }, [uid, accountEnabled, fetchUserData]);
  useEffect(() => {
    const session = captureSession(uid);
    const resumeInterruptedRead = () => {
      if (!uid || owner.current !== uid || accountEnabled === false || !isSessionCurrent(session) || isPrivateSessionSuspended(session)) {
        interrupted.current = null;
        return;
      }
      if (privateReadsBlocked(session)) {
        if (fetching.current?.uid === uid) {
          // Detach even a read/claims lookup which the SDK cannot cancel. Its
          // completion must not overwrite the replacement or delay its start.
          interrupted.current = session;
          sequence.current += 1;
          fetching.current = null;
          fetched.current = null;
        }
        return;
      }
      const request = interrupted.current;
      interrupted.current = null;
      if (request?.uid === uid && request.lifecycle === session.lifecycle && request.generation === session.generation && isSessionCurrent(request)) {
        void fetchUserData(true);
      }
    };
    const unsubscribe = subscribeAuthorizationUpdates(resumeInterruptedRead);
    // Also cover a hook mounted while an own-status update is already pending.
    resumeInterruptedRead();
    return unsubscribe;
  }, [uid, accountEnabled, fetchUserData]);
  useEffect(() => () => {
    sequence.current += 1;
    // StrictMode replays setup on the same hook refs. A superseded request must
    // not leave the replacement setup permanently marked as already fetching.
    fetching.current = null;
    fetched.current = null;
    interrupted.current = null;
  }, []);

  const visible = uid !== null && accountEnabled !== false && state.uid === uid && isSessionCurrent(captureSession(uid)) && !isPrivateSessionSuspended(captureSession(uid)) ? state : EMPTY;
  return { userData: visible.userData, loading: visible.loading, error: visible.error, refetch: () => fetchUserData(true) };
}
