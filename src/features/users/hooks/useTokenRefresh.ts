import { useEffect } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { withTimeout } from "../../../shared/utils/withTimeout";

export const TOKEN_REFRESH_TIMEOUT_MS = 15_000;

// Global singleton to ensure only one onIdTokenChanged listener exists
let tokenRefreshSetup: {
  unsubscribe: (() => void) | null;
  callbacks: Set<() => void>;
  currentUser: User | null;
  lastNotifiedToken: string | null;
} = {
  unsubscribe: null,
  callbacks: new Set(),
  currentUser: null,
  lastNotifiedToken: null,
};

let refreshInFlight: { uid: string; promise: Promise<void> } | null = null;

function notifyTokenCallbacks(token: string) {
  if (tokenRefreshSetup.lastNotifiedToken === token) return;
  tokenRefreshSetup.lastNotifiedToken = token;
  tokenRefreshSetup.callbacks.forEach((callback) => callback());
}

/**
 * Hook to detect claim changes via onIdTokenChanged
 * Only refreshes when claims are actually updated server-side
 * Provides a manual refresh function for handling auth errors
 */
export function useTokenRefresh(user: User | null, onTokenChange?: () => void) {
  useEffect(() => {
    if (!onTokenChange) return;
    tokenRefreshSetup.callbacks.add(onTokenChange);
    return () => {
      tokenRefreshSetup.callbacks.delete(onTokenChange);
    };
  }, [onTokenChange]);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Only set up listener once (when currentUser is null or different)
    if (tokenRefreshSetup.currentUser?.uid !== user.uid) {
      // Clean up old setup if user changed
      if (tokenRefreshSetup.unsubscribe) {
        tokenRefreshSetup.unsubscribe();
      }

      // Listen for token changes (fires when claims are updated server-side)
      tokenRefreshSetup.lastNotifiedToken = null;
      const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (currentUser && currentUser.uid === user.uid) {
          try {
            // Read the token emitted by Firebase without forcing another refresh from
            // inside the token-change listener.
            const token = await currentUser.getIdToken();
            notifyTokenCallbacks(token);
          } catch (error) {
            console.error("Error reading changed ID token:", error);
          }
        }
      });

      // Store setup
      tokenRefreshSetup = {
        unsubscribe,
        callbacks: tokenRefreshSetup.callbacks,
        currentUser: user,
        lastNotifiedToken: tokenRefreshSetup.lastNotifiedToken,
      };
    }
  }, [user]);
}

/**
 * Manually refresh token (useful when handling auth errors)
 */
export function refreshToken(
  user: User | null,
  timeoutMs = TOKEN_REFRESH_TIMEOUT_MS,
): Promise<void> {
  if (!user) return Promise.reject(new Error("No authenticated user to refresh"));

  if (refreshInFlight?.uid === user.uid) {
    return refreshInFlight.promise;
  }

  const promise = withTimeout(
    user.getIdToken(true),
    timeoutMs,
    "Refreshing the authenticated session timed out",
  )
    .then((token) => notifyTokenCallbacks(token))
    .catch((error) => {
      console.error("Error refreshing token:", error);
      throw error;
    })
    .finally(() => {
      if (refreshInFlight?.promise === promise) {
        refreshInFlight = null;
      }
    });

  refreshInFlight = { uid: user.uid, promise };
  return promise;
}
