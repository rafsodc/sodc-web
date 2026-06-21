import { useEffect, useState, useCallback } from "react";
import { type User } from "firebase/auth";
import { useTokenRefresh } from "./useTokenRefresh";

export interface EnabledClaimState {
  isEnabled: boolean;
  isEnabledClaimResolved: boolean;
}

export function useEnabledClaim(user: User | null): EnabledClaimState {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isEnabledClaimResolved, setIsEnabledClaimResolved] = useState(user === null);

  const checkEnabledClaim = useCallback(async () => {
    if (!user) {
      setIsEnabled(false);
      setIsEnabledClaimResolved(true);
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      setIsEnabled(tokenResult.claims.enabled === true);
    } catch (error) {
      console.error("Error checking enabled claim:", error);
      setIsEnabled(false);
    } finally {
      setIsEnabledClaimResolved(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsEnabled(false);
      setIsEnabledClaimResolved(true);
      return;
    }

    setIsEnabledClaimResolved(false);
    void checkEnabledClaim();
  }, [user, checkEnabledClaim]);

  // Set up automatic token refresh
  useTokenRefresh(user, checkEnabledClaim);

  return { isEnabled, isEnabledClaimResolved };
}
