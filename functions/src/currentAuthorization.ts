import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { getUserSecurityState } from "./securityRepository";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

export interface CurrentAuthorization {
  uid: string;
  securityVersion: number;
  isAdmin: boolean;
  enabled: true;
}
const checkedRequests = new WeakMap<object, CurrentAuthorization>();

/** One uncached authority read per request. Never derive a privilege from JWT claims alone. */
export async function requireCurrentAuthorization(request: CallableRequest, adminRequired = false): Promise<CurrentAuthorization> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const existing = checkedRequests.get(request);
  if (existing) {
    if (adminRequired && !existing.isAdmin) throw new HttpsError("permission-denied", "Admins only", { code: "ACCESS_REVOKED" });
    return existing;
  }
  let state;
  try {
    state = (await getUserSecurityState({ userId: request.auth.uid })).data.userSecurityState;
  } catch {
    throw new HttpsError("unavailable", "Current account access could not be verified");
  }
  if (!state || !state.accessReady || state.syncStatus !== "READY" ||
      state.membershipStatus !== state.user.membershipStatus || !isNonRestrictedStatus(state.user.membershipStatus as MembershipStatus)) {
    throw new HttpsError("permission-denied", "Account access is unavailable", { code: "ACCESS_REVOKED" });
  }
  const version = request.auth.token.securityVersion;
  if (!Number.isSafeInteger(version) || version !== state.securityVersion) {
    throw new HttpsError("unauthenticated", "Refresh your sign-in session", { code: "SESSION_VERSION_STALE" });
  }
  // Claims are a restrictive compatibility mirror, never an authority grant.
  const authorization: CurrentAuthorization = {
    uid: request.auth.uid, securityVersion: state.securityVersion,
    isAdmin: state.adminReady && request.auth.token.admin === true, enabled: true,
  };
  if (adminRequired && !authorization.isAdmin) throw new HttpsError("permission-denied", "Admins only", { code: "ACCESS_REVOKED" });
  checkedRequests.set(request, authorization);
  return authorization;
}

/** Only usable after an awaited guard on this exact request. */
export function currentAuthorization(request: CallableRequest): CurrentAuthorization {
  const authorization = checkedRequests.get(request);
  if (!authorization) throw new HttpsError("internal", "Current authorization was not checked");
  return authorization;
}
