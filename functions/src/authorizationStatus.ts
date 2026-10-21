import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { FUNCTIONS_REGION } from "./constants";
import { getUserSecurityState } from "./securityRepository";
import { synchronizeUserSecurity } from "./currentAuthorizationTransitions";
import { isNonRestrictedStatus } from "./validation";

/** Auth-only exception: returns only the caller's session metadata, never member data. */
export const getMyAuthorizationStatus = onCall({region: FUNCTIONS_REGION}, async request => {
  requireAuth(request);
  const uid = request.auth!.uid;
  await enforceRateLimit("getMyAuthorizationStatus", uid);
  let state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
  const result = (status: "enabled" | "restricted" | "pending" | "missing", verificationRequired = false) => ({
    status, isAdmin: status === "enabled" && state?.adminReady === true,
    securityVersion: state?.securityVersion ?? null,
    tokenVersionCurrent: state?.securityVersion === request.auth!.token.securityVersion,
    verificationRequired,
  });
  if (!state) return result("missing");
  let identity;
  try {identity = await admin.auth().getUser(uid);}
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found") return result("restricted");
    throw new HttpsError("unavailable", "Current sign-in status could not be checked");
  }
  if (identity.disabled || !identity.emailVerified || state.verificationEmail ||
      !isNonRestrictedStatus(state.user.membershipStatus) || state.membershipStatus !== state.user.membershipStatus) {
    return result("restricted", !identity.emailVerified || Boolean(state.verificationEmail));
  }
  if (!state.desiredEnabled) return result("restricted");
  if (state.syncStatus !== "READY") return result("pending");
  // Repair only an existing READY intent. No client-supplied UID, flags or version
  // can create a row, start a grant, or release an email verification hold here.
  await synchronizeUserSecurity(state.operationId);
  state = (await getUserSecurityState({userId: uid})).data.userSecurityState;
  if (!state) return result("missing");
  if (state.syncStatus !== "READY") return result("pending");
  return result(state.accessReady ? "enabled" : "restricted");
});
