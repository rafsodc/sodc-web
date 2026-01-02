import { useEffect, useState } from "react";
import { type User } from "firebase/auth";

export function useEnabledClaim(user: User | null): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsEnabled(false);
      return;
    }

    const checkEnabledClaim = async () => {
      try {
        const tokenResult = await user.getIdTokenResult();
        setIsEnabled(tokenResult.claims.enabled === true);
      } catch (error) {
        console.error("Error checking enabled claim:", error);
        setIsEnabled(false);
      }
    };

    checkEnabledClaim();
  }, [user]);

  return isEnabled;
}

