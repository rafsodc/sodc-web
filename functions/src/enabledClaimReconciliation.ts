import { synchronizeUserSecurity, transitionUserSecurity } from "./currentAuthorizationTransitions";
import { getUserSecurityState } from "./securityRepository";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

interface AuthClaimsUser {
  customClaims?: Record<string, unknown>;
}

export interface EnabledClaimAuthClient {
  getUser(userId: string): Promise<AuthClaimsUser>;
  setCustomUserClaims(userId: string, claims: Record<string, unknown>): Promise<void>;
}

export interface EnabledClaimReconciliationResult {
  enabled: boolean;
  updated: boolean;
}

/**
 * Membership status is the source of truth for enabled access. Admin status is
 * deliberately irrelevant: requireAdmin also requires enabled=true, so an
 * admin claim must never bypass a restricted membership status.
 */
export function enabledClaimForMembershipStatus(
  membershipStatus: MembershipStatus
): boolean {
  return isNonRestrictedStatus(membershipStatus);
}

/**
 * Reconciles the Firebase Auth enabled claim with the stored membership status.
 * Existing custom claims are preserved and write failures are surfaced to the
 * caller so the originating operation can be retried or repaired.
 */
export async function reconcileEnabledClaim(
  userId: string,
  membershipStatus: MembershipStatus,
  actorId: string,
): Promise<EnabledClaimReconciliationResult> {
  const state = (await getUserSecurityState({ userId })).data.userSecurityState;
  if (!state || state.user.membershipStatus !== membershipStatus) throw new Error("SECURITY_PROFILE_CONFLICT");
  if (state.syncStatus === "PENDING") {
    await synchronizeUserSecurity(state.operationId);
  } else {
    await transitionUserSecurity({ userId, actorId, reason: "RECONCILE_AUTHORIZATION" });
  }
  const latest = (await getUserSecurityState({ userId })).data.userSecurityState;
  return { enabled: latest?.accessReady === true, updated: true };
}
