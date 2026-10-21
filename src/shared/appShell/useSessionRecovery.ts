import { captureSession, isSessionCurrent, retirePrivateSession, signOutPrivateSession, suspendPrivateSession, SessionChangedError } from "./sessionLifecycle";
import { classifyAuthorizationFailure } from "../auth/authorizationFailure";
import { getMyAuthorizationStatus } from "../auth/authorizationStatus";
import { subscribeAuthorizationDenials } from "../auth/authorizationRecoveryEvents";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { refreshToken } from "../../features/users/hooks/useTokenRefresh";
import { isAuthenticationFailure } from "../auth/isAuthenticationFailure";
import { OperationTimeoutError, withTimeout } from "../utils/withTimeout";

export const SESSION_IDLE_THRESHOLD_MS = 5 * 60_000;
export const PROTECTED_QUERY_TIMEOUT_MS = 30_000;

export type SessionRecoveryFailure = "refresh-failed" | "request-timeout" | "authorization-pending" | "authorization-check-failed";
export type SessionRecoveryStatus = "idle" | "recovering" | "failed";

interface UseSessionRecoveryOptions {
  idleThresholdMs?: number;
  queryTimeoutMs?: number;
  now?: () => number;
  onRecovered?: () => void | Promise<void>;
}

interface SessionRecoveryState {
  status: SessionRecoveryStatus;
  failure: SessionRecoveryFailure | null;
}

const INITIAL_STATE: SessionRecoveryState = { status: "idle", failure: null };

export function useSessionRecovery(
  user: User | null,
  options: UseSessionRecoveryOptions = {},
) {
  const queryClient = useQueryClient();
  const idleThresholdMs = options.idleThresholdMs ?? SESSION_IDLE_THRESHOLD_MS;
  const queryTimeoutMs = options.queryTimeoutMs ?? PROTECTED_QUERY_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const onRecoveredRef = useRef(options.onRecovered);
  const [state, setState] = useState<SessionRecoveryState>(INITIAL_STATE);
  const inactiveAtRef = useRef<number | null>(null);
  const recoveryRef = useRef<{ id: symbol; promise: Promise<void>; authoritative: boolean; refreshed: boolean } | null>(null);
  const authorizationRequiredRef = useRef(false);
  const recoveryGenerationRef = useRef(0);
  const currentUidRef = useRef(user?.uid);
  currentUidRef.current = user?.uid;

  useEffect(() => {
    onRecoveredRef.current = options.onRecovered;
  }, [options.onRecovered]);

  const recover = useCallback((authorizationRequired = false): Promise<void> => {
    if (!user) return Promise.resolve();
    // Once a denial has left access masked, late errors cannot automatically
    // restart status checks. Only the visible retry may start another attempt.
    if (authorizationRequired && authorizationRequiredRef.current && !recoveryRef.current) return Promise.resolve();
    if (authorizationRequired) authorizationRequiredRef.current = true;
    if (recoveryRef.current) {
      if (authorizationRequired) {
        recoveryRef.current.authoritative = true;
        suspendPrivateSession(captureSession(user.uid));
      }
      return recoveryRef.current.promise;
    }

    const session = captureSession(user.uid);
    if (!isSessionCurrent(session)) return Promise.resolve();
    const generation = recoveryGenerationRef.current;
    const current = () => generation === recoveryGenerationRef.current &&
      currentUidRef.current === user.uid && isSessionCurrent(session);
    const recovery = { id: Symbol("session-recovery"), promise: Promise.resolve(),
      authoritative: authorizationRequiredRef.current, refreshed: false };
    // Reserve ownership before cancelQueries can synchronously notify cache
    // subscribers and re-enter recovery. Explicit denial also fences new work.
    recoveryRef.current = recovery;
    if (recovery.authoritative) suspendPrivateSession(session);
    setState({ status: "recovering", failure: null });

    recovery.promise = Promise.resolve().then(async () => {
      const checkAuthority = async () => {
        const readStatus = () => withTimeout(getMyAuthorizationStatus(), queryTimeoutMs, "Checking current account access timed out");
        const status = await readStatus();
        if (!current()) return;
        const stopForStatus = async (value: typeof status) => {
          if (value.verificationRequired || value.status === "restricted" || value.status === "missing") {
            // Auth remains persisted until sign-out succeeds. Retire-only reload
            // here could repeatedly restore the rejected account.
            await signOutPrivateSession({ reason: "authorization-ended" });
            return true;
          }
          if (value.status === "pending") {
            setState({ status: "failed", failure: "authorization-pending" });
            return true;
          }
          return false;
        };
        if (await stopForStatus(status) || !current()) return;
        if (!recovery.refreshed) {
          recovery.refreshed = true;
          // Private SDK work is suspended; this sole coordinator-owned Auth
          // refresh deliberately bypasses that gate and retains identity guards.
          await withTimeout(user.getIdToken(true), queryTimeoutMs, "Refreshing current account access timed out");
          if (!current()) return;
        }
        const verified = await readStatus();
        if (!current() || await stopForStatus(verified) || !current()) return;
        if (!verified.tokenVersionCurrent) {
          setState({ status: "failed", failure: "authorization-check-failed" });
          return;
        }
        // Even an enabled/demoted account needs a new SDK cache context. Never
        // replay the rejected query or mutation in this document.
        retirePrivateSession({ reason: "authorization-updated" });
      };
      try {
        await queryClient.cancelQueries({ type: "active" });
        if (!current()) return;
        if (recovery.authoritative) { await checkAuthority(); return; }
        recovery.refreshed = true;
        try { await refreshToken(user); } catch (error) {
          // An explicit denial can suspend the document while the legacy
          // refresh is in flight. Reuse its single forced refresh, then verify.
          if (current() && recovery.authoritative && error instanceof SessionChangedError) { await checkAuthority(); return; }
          throw error;
        }
        if (!current()) return;
        if (recovery.authoritative) { await checkAuthority(); return; }
        await onRecoveredRef.current?.();
        if (!current()) return;
        if (recovery.authoritative) { await checkAuthority(); return; }
        // Generic legacy errors retain one bounded read retry. Explicit authority
        // errors above always reset the document and never replay denied writes.
        void queryClient.invalidateQueries({ type: "active" });
        setState(INITIAL_STATE);
      } catch (error) {
        if (!current()) return;
        const timedOut = error instanceof OperationTimeoutError;
        console.error("[session-recovery] account recovery failed", error);
        setState({ status: "failed", failure: timedOut ? "request-timeout" :
          recovery.authoritative ? "authorization-check-failed" : "refresh-failed" });
      } finally {
        if (recoveryRef.current?.id === recovery.id) recoveryRef.current = null;
      }
    });
    return recovery.promise;
  }, [queryClient, queryTimeoutMs, user]);

  useEffect(() => {
    recoveryGenerationRef.current += 1;
    inactiveAtRef.current = null;
    recoveryRef.current = null;
    authorizationRequiredRef.current = false;
    setState(INITIAL_STATE);
    return () => { recoveryGenerationRef.current += 1; recoveryRef.current = null; };
  }, [user?.uid]);

  useEffect(() => subscribeAuthorizationDenials(({ session }) => {
    if (user && session.uid === user.uid && currentUidRef.current === user.uid && isSessionCurrent(session)) void recover(true);
  }), [recover, user]);

  useEffect(() => {
    if (!user) return;

    const markInactive = () => {
      inactiveAtRef.current ??= now();
    };

    const resume = () => {
      const inactiveAt = inactiveAtRef.current;
      inactiveAtRef.current = null;
      if (!authorizationRequiredRef.current && inactiveAt !== null && now() - inactiveAt >= idleThresholdMs) {
        void recover();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markInactive();
      } else {
        resume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", markInactive);
    window.addEventListener("focus", resume);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", markInactive);
      window.removeEventListener("focus", resume);
    };
  }, [idleThresholdMs, now, recover, user]);

  useEffect(() => {
    if (!user) return;
    const watchedSession = captureSession(user.uid);

    const queryTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const mutationTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const authRecoveryAttempts = new Set<string>();
    const mutationRecoveryAttempts = new Set<number>();

    const syncQueryTimers = () => {
      if (currentUidRef.current !== user.uid || !isSessionCurrent(watchedSession)) return;
      const fetchingQueries = queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.fetchStatus === "fetching");
      const fetchingHashes = new Set(fetchingQueries.map((query) => query.queryHash));

      for (const [queryHash, timer] of queryTimers) {
        if (!fetchingHashes.has(queryHash)) {
          clearTimeout(timer);
          queryTimers.delete(queryHash);
        }
      }

      for (const query of fetchingQueries) {
        if (queryTimers.has(query.queryHash)) continue;

        const timer = setTimeout(() => {
          if (currentUidRef.current !== user.uid || !isSessionCurrent(watchedSession) || authorizationRequiredRef.current) return;
          queryTimers.delete(query.queryHash);
          console.error("[session-recovery] protected query timed out", {
            queryHash: query.queryHash,
          });
          void queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
          setState({ status: "failed", failure: "request-timeout" });
        }, queryTimeoutMs);
        queryTimers.set(query.queryHash, timer);
      }

      for (const query of queryClient.getQueryCache().getAll()) {
        if (query.state.status === "success") {
          authRecoveryAttempts.delete(query.queryHash);
        } else if (
          query.state.status === "error" &&
          (classifyAuthorizationFailure(query.state.error) || isAuthenticationFailure(query.state.error)) &&
          !authRecoveryAttempts.has(query.queryHash)
        ) {
          authRecoveryAttempts.add(query.queryHash);
          void recover(Boolean(classifyAuthorizationFailure(query.state.error)));
        }
      }
    };

    const syncMutationTimers = () => {
      if (currentUidRef.current !== user.uid || !isSessionCurrent(watchedSession)) return;
      const pendingMutations = queryClient
        .getMutationCache()
        .getAll()
        .filter((mutation) => mutation.state.status === "pending");
      const pendingIds = new Set(pendingMutations.map((mutation) => mutation.mutationId));

      for (const [mutationId, timer] of mutationTimers) {
        if (!pendingIds.has(mutationId)) {
          clearTimeout(timer);
          mutationTimers.delete(mutationId);
        }
      }

      for (const mutation of pendingMutations) {
        if (mutationTimers.has(mutation.mutationId)) continue;

        const timer = setTimeout(() => {
          if (currentUidRef.current !== user.uid || !isSessionCurrent(watchedSession) || authorizationRequiredRef.current) return;
          mutationTimers.delete(mutation.mutationId);
          console.error("[session-recovery] protected mutation timed out", {
            mutationId: mutation.mutationId,
          });
          // TanStack mutations cannot be cancelled. Showing the recovery screen
          // unmounts the stalled observer so its loading state cannot trap the UI.
          setState({ status: "failed", failure: "request-timeout" });
        }, queryTimeoutMs);
        mutationTimers.set(mutation.mutationId, timer);
      }
      for (const mutation of queryClient.getMutationCache().getAll()) {
        if (mutation.state.status === "error" &&
            (classifyAuthorizationFailure(mutation.state.error) || isAuthenticationFailure(mutation.state.error)) &&
            !mutationRecoveryAttempts.has(mutation.mutationId)) {
          mutationRecoveryAttempts.add(mutation.mutationId);
          void recover(Boolean(classifyAuthorizationFailure(mutation.state.error)));
        }
      }
    };

    syncQueryTimers();
    syncMutationTimers();
    const unsubscribeQueries = queryClient.getQueryCache().subscribe(syncQueryTimers);
    const unsubscribeMutations = queryClient.getMutationCache().subscribe(syncMutationTimers);
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
      queryTimers.forEach(clearTimeout);
      mutationTimers.forEach(clearTimeout);
    };
  }, [queryClient, queryTimeoutMs, recover, user]);

  return {
    ...state,
    retry: () => recover(),
  };
}
