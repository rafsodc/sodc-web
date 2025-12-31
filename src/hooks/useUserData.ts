import { useEffect, useState, useCallback } from "react";
import { type User } from "firebase/auth";
import { executeQuery } from "firebase/data-connect";
import { dataConnect } from "../config/firebase";
import { getCurrentUserRef } from "@dataconnect/generated";

export interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: "PENDING" | "SERVING" | "RETIRED" | "RESIGNED" | "LOST" | "DECEASED";
  createdAt: string;
  updatedAt: string;
}

export function useUserData(firebaseUser: User | null) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!firebaseUser) {
      setUserData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ref = getCurrentUserRef(dataConnect);
      const result = await executeQuery(ref);
      if (result.data?.user) {
        setUserData(result.data.user as UserData);
      } else {
        setUserData(null);
      }
    } catch (err) {
      // User might not exist in database yet, which is fine
      if (err instanceof Error && !err.message.includes("not found")) {
        setError(err);
      }
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return { userData, loading, error, refetch: fetchUserData };
}

