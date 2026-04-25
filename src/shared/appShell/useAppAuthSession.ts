import { useEffect, useState } from "react";
import { onAuthStateChanged, reload, type User } from "firebase/auth";
import { auth } from "../../config/firebase";

export function useAppAuthSession(onLoggedOut: () => void) {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [emailCheckTrigger, setEmailCheckTrigger] = useState(0);
  const [logoutSuccess, setLogoutSuccess] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser((previousUser) => {
        if (previousUser !== null && nextUser === null) {
          onLoggedOut();
          setEmailCheckTrigger(0);
          setLogoutSuccess(true);
        }
        return nextUser;
      });
      setAuthInitialized(true);
    });
    return () => unsub();
  }, [onLoggedOut]);

  useEffect(() => {
    if (user && emailCheckTrigger > 0) {
      reload(user).catch(() => {
        // The UI can continue using the current auth state if reload fails.
      });
    }
  }, [emailCheckTrigger, user]);

  return {
    user,
    authInitialized,
    logoutSuccess,
    setLogoutSuccess,
    triggerEmailCheck: () => setEmailCheckTrigger((prev) => prev + 1),
  };
}
