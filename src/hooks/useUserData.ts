import { useEffect, useState, useCallback, useRef } from "react";
import { type User } from "firebase/auth";
import { executeQuery } from "firebase/data-connect";
import { dataConnect } from "../config/firebase";
import { getCurrentUserRef } from "@dataconnect/generated";
import type { UserData } from "../types";

export function useUserData(firebaseUser: User | null) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef<string | null>(null);
  const authErrorRef = useRef(false); // Track if we've hit an auth error for this user

  const fetchUserData = useCallback(async (force = false) => {
    if (!firebaseUser) {
      setUserData(null);
      hasFetchedRef.current = null;
      authErrorRef.current = false;
      return;
    }

    // Check if user has enabled claim before attempting query
    // GetCurrentUser requires enabled claim, so don't call it if user doesn't have it
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      const isEnabled = tokenResult.claims.enabled === true;
      
      if (!isEnabled) {
        // User doesn't have enabled claim, so GetCurrentUser will fail
        // Don't attempt the query
        setUserData(null);
        hasFetchedRef.current = firebaseUser.uid;
        authErrorRef.current = true;
        return;
      }
    } catch (err) {
      // If we can't check the token, don't proceed
      setUserData(null);
      hasFetchedRef.current = firebaseUser.uid;
      authErrorRef.current = true;
      return;
    }

    // Don't fetch if we're already fetching, or if we've already fetched for this user (unless forced)
    if (fetchingRef.current || (!force && hasFetchedRef.current === firebaseUser.uid)) {
      return;
    }

    // If we've already determined this user has an auth error, don't keep retrying
    if (!force && authErrorRef.current && hasFetchedRef.current === firebaseUser.uid) {
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const ref = getCurrentUserRef(dataConnect);
      const result = await executeQuery(ref);
      if (result.data?.user) {
        setUserData(result.data.user as UserData);
        authErrorRef.current = false; // Reset auth error flag on success
      } else {
        setUserData(null);
      }
      hasFetchedRef.current = firebaseUser.uid;
    } catch (err: any) {
      // Check if it's an auth error (401/403) - might be stale token or user doesn't have enabled claim
      const isAuthError = err?.code === 401 || err?.code === 403 || 
                         err?.message?.includes("unauthorized") ||
                         err?.message?.includes("permission");
      
      if (isAuthError) {
        // Mark that we've hit an auth error for this user
        authErrorRef.current = true;
        
        // Only try refreshing token if we haven't already tried (first time)
        if (hasFetchedRef.current !== firebaseUser.uid) {
          try {
            await firebaseUser.getIdToken(true);
            const ref = getCurrentUserRef(dataConnect);
            const result = await executeQuery(ref);
            if (result.data?.user) {
              setUserData(result.data.user as UserData);
              authErrorRef.current = false; // Reset on success
              hasFetchedRef.current = firebaseUser.uid;
              return;
            }
          } catch (retryErr) {
            // If retry also fails, it's a real auth error (likely user doesn't have enabled claim)
            // Don't set error state, just set userData to null
            setUserData(null);
            hasFetchedRef.current = firebaseUser.uid; // Mark as fetched to prevent retries
            return;
          }
        }
        
        // User doesn't have enabled claim or other auth issue - don't keep retrying
        setUserData(null);
        hasFetchedRef.current = firebaseUser.uid;
        return;
      }
      
      // User might not exist in database yet, which is fine
      if (err instanceof Error && !err.message.includes("not found")) {
        setError(err);
      }
      setUserData(null);
      hasFetchedRef.current = firebaseUser.uid;
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [firebaseUser]);

  useEffect(() => {
    // Reset tracking when user changes
    if (!firebaseUser) {
      hasFetchedRef.current = null;
      authErrorRef.current = false;
    } else if (hasFetchedRef.current !== firebaseUser.uid) {
      // Only fetch if we haven't fetched for this user yet
      authErrorRef.current = false;
      fetchUserData();
    }
  }, [firebaseUser, fetchUserData]);

  return { userData, loading, error, refetch: () => fetchUserData(true) };
}

