import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { dataConnect } from "../config/firebase";
// Note: After regenerating the Data Connect SDK, getCurrentUserRef will be available
// Run: firebase dataconnect:sdk:generate
import { getCurrentUserRef, executeQuery } from "@dataconnect/generated";

export interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  createdAt: string;
  updatedAt: string;
}

export function useUserData(firebaseUser: User | null) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setUserData(null);
      return;
    }

    const fetchUserData = async () => {
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
    };

    fetchUserData();
  }, [firebaseUser]);

  return { userData, loading, error };
}

