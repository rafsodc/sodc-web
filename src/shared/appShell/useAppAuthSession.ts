import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, reload, type User } from "firebase/auth";
import { auth } from "../../config/firebase";
import { captureSession, isSessionCurrent, runSessionOperation } from "./sessionLifecycle";
import { consumeLogoutConfirmation } from "./sessionBrowser";

export function useAppAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [emailCheckTrigger, setEmailCheckTrigger] = useState(0);
  const [logoutSuccess, setLogoutSuccess] = useState(false);
  const checkedNotice = useRef(false);

  useEffect(() => {
    if (!checkedNotice.current) {
      checkedNotice.current = true;
      setLogoutSuccess(consumeLogoutConfirmation());
    }
    return onAuthStateChanged(auth, (nextUser) => {
      // The boundary observer is registered first and retires before another
      // account can become visible through this secondary UI subscription.
      if (!isSessionCurrent(captureSession(nextUser?.uid ?? null))) return;
      setUser(nextUser);
      setAuthInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (user && emailCheckTrigger > 0) {
      void runSessionOperation(() => reload(user), captureSession(user.uid)).catch(() => { /* Keep the current auth state on failure. */ });
    }
  }, [emailCheckTrigger, user]);

  return { user, authInitialized, logoutSuccess, setLogoutSuccess,
    triggerEmailCheck: () => setEmailCheckTrigger((previous) => previous + 1) };
}
