import { useEffect, useRef, useState } from "react";
import { queryRef } from "firebase/data-connect";
import type { User } from "firebase/auth";
import { dataConnect } from "../../config/firebase";
import type { UserData } from "../../types";
import { executeDataConnectQuery } from "../query/dataConnectExecution";
import { captureSession, isSessionCurrent } from "./sessionLifecycle";

export function useUnenabledProfileCheck(user: User | null, userData: UserData | null, isEnabled: boolean) {
  const uid = user?.uid ?? null;
  const owner = useRef(uid);
  owner.current = uid;
  const [state, setState] = useState<{ uid: string | null; exists: boolean | null; status: string | null }>({ uid: null, exists: null, status: null });
  useEffect(() => {
    const token = captureSession(uid);
    let active = true;
    const current = () => active && owner.current === uid && isSessionCurrent(token);
    if (!user || !user.emailVerified || isEnabled || userData !== null) return;
    void executeDataConnectQuery(queryRef(dataConnect, "CheckUserProfileExists", {})).then((result) => {
      if (!current()) return;
      const profile = (result.data as { user?: { membershipStatus?: string } | null })?.user;
      setState({ uid, exists: Boolean(profile), status: profile?.membershipStatus ?? null });
    }).catch(() => {
      if (current()) setState({ uid, exists: false, status: null });
    });
    return () => { active = false; };
  }, [user, uid, userData, isEnabled]);
  const visible = state.uid === uid && isSessionCurrent(captureSession(uid));
  return {
    membershipStatusForUnenabled: visible && !isEnabled ? state.status : null,
    needsProfileCompletion: Boolean(user?.emailVerified && !isEnabled && !userData && visible && state.exists === false),
  };
}
