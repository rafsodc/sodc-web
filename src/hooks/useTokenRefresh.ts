import { useEffect, useRef } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "../config/firebase";

// Global singleton to ensure only one onIdTokenChanged listener exists
let tokenRefreshSetup: {
  unsubscribe: (() => void) | null;
  callbacks: Set<() => void>;
  currentUser: User | null;
} = {
  unsubscribe: null,
  callbacks: new Set(),
  currentUser: null,
};

/**
 * Hook to detect claim changes via onIdTokenChanged
 * Only refreshes when claims are actually updated server-side
 * Provides a manual refresh function for handling auth errors
 */
export function useTokenRefresh(user: User | null, onTokenChange?: () => void) {
  const onTokenChangeRef = useRef(onTokenChange);

  // Keep refs up to date
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!user) {
      // Remove callback if user logs out
      if (onTokenChangeRef.current) {
        tokenRefreshSetup.callbacks.delete(onTokenChangeRef.current);
      }
      return;
    }

    // Add callback to set
    if (onTokenChangeRef.current) {
      tokenRefreshSetup.callbacks.add(onTokenChangeRef.current);
    }

    // Only set up listener once (when currentUser is null or different)
    if (tokenRefreshSetup.currentUser?.uid !== user.uid) {
      // Clean up old setup if user changed
      if (tokenRefreshSetup.unsubscribe) {
        tokenRefreshSetup.unsubscribe();
      }

      // Listen for token changes (fires when claims are updated server-side)
      const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (currentUser && currentUser.uid === user.uid) {
          // Force refresh to get latest claims
          await currentUser.getIdToken(true);
          // Notify all callbacks
          tokenRefreshSetup.callbacks.forEach(callback => callback());
        }
      });

      // Store setup
      tokenRefreshSetup = {
        unsubscribe,
        callbacks: tokenRefreshSetup.callbacks,
        currentUser: user,
      };
    }

    // Cleanup: remove callback when component unmounts
    return () => {
      if (onTokenChangeRef.current) {
        tokenRefreshSetup.callbacks.delete(onTokenChangeRef.current);
      }
    };
  }, [user]);
}

/**
 * Manually refresh token (useful when handling auth errors)
 */
export async function refreshToken(user: User | null): Promise<void> {
  if (!user) return;
  
  try {
    await user.getIdToken(true);
    // Notify all callbacks
    tokenRefreshSetup.callbacks.forEach(callback => callback());
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
}

