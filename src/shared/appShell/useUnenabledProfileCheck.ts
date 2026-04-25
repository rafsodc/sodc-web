import { useEffect, useRef, useState } from "react";
import { queryRef, executeQuery } from "firebase/data-connect";
import type { User } from "firebase/auth";
import { dataConnect } from "../../config/firebase";
import type { UserData } from "../../types";

export function useUnenabledProfileCheck(
  user: User | null,
  userData: UserData | null,
  isEnabled: boolean
) {
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [membershipStatusForUnenabled, setMembershipStatusForUnenabled] = useState<string | null>(null);
  const checkingProfileRef = useRef(false);
  const hasCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isEnabled || !user || !user.emailVerified) {
      setProfileExists(userData !== null ? true : null);
      hasCheckedRef.current = null;
      setMembershipStatusForUnenabled(null);
      return;
    }

    if (userData !== null) {
      setProfileExists(true);
      setMembershipStatusForUnenabled(null);
      hasCheckedRef.current = user.uid;
      return;
    }

    if (hasCheckedRef.current === user.uid || checkingProfileRef.current) {
      return;
    }

    checkingProfileRef.current = true;
    const ref = queryRef(dataConnect, "CheckUserProfileExists", {});
    executeQuery(ref)
      .then((result) => {
        const profileData = (result.data as { user?: { membershipStatus?: string } | null })?.user;
        setProfileExists(profileData !== null && profileData !== undefined);
        setMembershipStatusForUnenabled(profileData?.membershipStatus ?? null);
        hasCheckedRef.current = user.uid;
      })
      .catch(() => {
        setProfileExists(false);
        setMembershipStatusForUnenabled(null);
        hasCheckedRef.current = user.uid;
      })
      .finally(() => {
        checkingProfileRef.current = false;
      });
  }, [user, userData, isEnabled]);

  const needsProfileCompletion = Boolean(
    user && user.emailVerified && !isEnabled && profileExists === false && !checkingProfileRef.current
  );

  return {
    membershipStatusForUnenabled,
    needsProfileCompletion,
  };
}
