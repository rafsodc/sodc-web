import { useEffect, useState, useCallback } from "react";
import { type User } from "firebase/auth";
import { useTokenRefresh } from "./useTokenRefresh";
import { withTimeout } from "../../../shared/utils/withTimeout";

const CLAIM_CHECK_TIMEOUT_MS = 15_000;

export function useAdminClaim(user: User | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminClaim = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      const tokenResult = await withTimeout(
        user.getIdTokenResult(),
        CLAIM_CHECK_TIMEOUT_MS,
        "Checking the administrator claim timed out",
      );
      setIsAdmin(tokenResult.claims.admin === true);
    } catch (error) {
      console.error("Error checking admin claim:", error);
      setIsAdmin(false);
    }
  }, [user]);

  useEffect(() => {
    checkAdminClaim();
  }, [checkAdminClaim]);

  // Set up automatic token refresh
  useTokenRefresh(user, checkAdminClaim);

  return isAdmin;
}
