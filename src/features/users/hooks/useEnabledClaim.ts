import { useEffect, useState, useCallback } from "react";
import { type User } from "firebase/auth";
import { useTokenRefresh } from "./useTokenRefresh";
import { withTimeout } from "../../../shared/utils/withTimeout";

const CLAIM_CHECK_TIMEOUT_MS = 15_000;

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
      const tokenResult = await withTimeout(
        user.getIdTokenResult(),
        CLAIM_CHECK_TIMEOUT_MS,
        "Checking the enabled account claim timed out",
      );
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
