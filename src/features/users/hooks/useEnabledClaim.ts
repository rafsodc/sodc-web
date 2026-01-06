import { useEffect, useState, useCallback } from "react";
import { type User } from "firebase/auth";
import { useTokenRefresh } from "./useTokenRefresh";

export function useEnabledClaim(user: User | null): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  const checkEnabledClaim = useCallback(async () => {
    if (!user) {
      setIsEnabled(false);
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      setIsEnabled(tokenResult.claims.enabled === true);
    } catch (error) {
      console.error("Error checking enabled claim:", error);
      setIsEnabled(false);
    }
  }, [user]);

  useEffect(() => {
    checkEnabledClaim();
  }, [checkEnabledClaim]);

  // Set up automatic token refresh
  useTokenRefresh(user, checkEnabledClaim);

  return isEnabled;
}

