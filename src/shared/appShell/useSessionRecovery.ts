import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { refreshToken } from "../../features/users/hooks/useTokenRefresh";
import { isAuthenticationFailure } from "../auth/isAuthenticationFailure";

export const SESSION_IDLE_THRESHOLD_MS = 5 * 60_000;
export const PROTECTED_QUERY_TIMEOUT_MS = 30_000;

export type SessionRecoveryFailure = "refresh-failed" | "request-timeout";
export type SessionRecoveryStatus = "idle" | "recovering" | "failed";

interface UseSessionRecoveryOptions {
  idleThresholdMs?: number;
  queryTimeoutMs?: number;
  now?: () => number;
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
  const [state, setState] = useState<SessionRecoveryState>(INITIAL_STATE);
  const inactiveAtRef = useRef<number | null>(null);
  const recoveryRef = useRef<Promise<void> | null>(null);

  const recover = useCallback(async () => {
    if (!user) return;
    if (recoveryRef.current) return recoveryRef.current;

    const operation = (async () => {
      setState({ status: "recovering", failure: null });

      try {
        // Detach any pre-resume promises from query state before refreshing. Firebase
        // Data Connect does not consume TanStack Query's AbortSignal, but cancelling
        // still ensures a late result from the stale promise is ignored.
        await queryClient.cancelQueries({ type: "active" });
        await refreshToken(user);

        // Do not await refetches here: the query watchdog below owns their bounded
        // loading time and can offer recovery if the replacement transport also stalls.
        void queryClient.invalidateQueries({ type: "active" });
        setState(INITIAL_STATE);
      } catch (error) {
        console.error("[session-recovery] token refresh failed", error);
        setState({ status: "failed", failure: "refresh-failed" });
      } finally {
        recoveryRef.current = null;
      }
    })();

    recoveryRef.current = operation;
    return operation;
  }, [queryClient, user]);

  useEffect(() => {
    inactiveAtRef.current = null;
    recoveryRef.current = null;
    setState(INITIAL_STATE);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;

    const markInactive = () => {
      inactiveAtRef.current ??= now();
    };

    const resume = () => {
      const inactiveAt = inactiveAtRef.current;
      inactiveAtRef.current = null;
      if (inactiveAt !== null && now() - inactiveAt >= idleThresholdMs) {
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

    const queryTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const mutationTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const authRecoveryAttempts = new Set<string>();

    const syncQueryTimers = () => {
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
          isAuthenticationFailure(query.state.error) &&
          !authRecoveryAttempts.has(query.queryHash)
        ) {
          authRecoveryAttempts.add(query.queryHash);
          void recover();
        }
      }
    };

    const syncMutationTimers = () => {
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
    retry: recover,
  };
}
