import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../config/firebase";

export function useAppAuthSession(onLoggedOut: () => void) {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [logoutSuccess, setLogoutSuccess] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser((previousUser) => {
        if (previousUser !== null && nextUser === null) {
          onLoggedOut();
          setLogoutSuccess(true);
        }
        return nextUser;
      });
      setAuthInitialized(true);
    });
    return () => unsub();
  }, [onLoggedOut]);

  return {
    user,
    authInitialized,
    logoutSuccess,
    setLogoutSuccess,
  };
}
