import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useTokenRefresh } from "./useTokenRefresh";
import { withTimeout } from "../../../shared/utils/withTimeout";
import { captureSession, isSessionCurrent } from "../../../shared/appShell/sessionLifecycle";

export function useAccountClaim(user: User | null, claim: "admin" | "enabled") {
  const uid = user?.uid ?? null;
  const owner = useRef(uid);
  owner.current = uid;
  const sequence = useRef(0);
  const [state, setState] = useState<{ uid: string | null; value: boolean; resolved: boolean }>({ uid: null, value: false, resolved: uid === null });
  const check = useCallback(async () => {
    const request = ++sequence.current;
    const token = captureSession(uid);
    const current = () => owner.current === uid && sequence.current === request && isSessionCurrent(token);
    if (!user) {
      setState({ uid: null, value: false, resolved: true });
      return;
    }
    try {
      const result = await withTimeout(user.getIdTokenResult(), 15_000, "Checking account permissions timed out");
      if (current()) setState({ uid, value: result.claims[claim] === true, resolved: true });
    } catch {
      if (current()) setState({ uid, value: false, resolved: true });
    }
  }, [user, uid, claim]);
  useEffect(() => {
    void check();
    return () => { sequence.current += 1; };
  }, [check]);
  useTokenRefresh(user, check);
  if (uid === null) return { value: false, resolved: true };
  return state.uid === uid && isSessionCurrent(captureSession(uid)) ? state : { value: false, resolved: false };
}
