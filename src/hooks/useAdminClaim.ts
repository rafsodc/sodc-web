import { useEffect, useState } from "react";
import { type User } from "firebase/auth";

export function useAdminClaim(user: User | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const checkAdminClaim = async () => {
      try {
        const tokenResult = await user.getIdTokenResult();
        setIsAdmin(tokenResult.claims.admin === true);
      } catch (error) {
        console.error("Error checking admin claim:", error);
        setIsAdmin(false);
      }
    };

    checkAdminClaim();
  }, [user]);

  return isAdmin;
}

