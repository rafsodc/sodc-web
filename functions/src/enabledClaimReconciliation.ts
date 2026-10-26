import { synchronizeUserSecurity, transitionUserSecurity, type SecurityAuthority } from "./currentAuthorizationTransitions";
import { getUserSecurityState } from "./securityRepository";
import type { MembershipStatus } from "./validation";

export interface EnabledClaimReconciliationResult {
  enabled: boolean;
  updated: boolean;
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
  options: {authority: SecurityAuthority; operationId: string; reason?: string; membershipStatus?: MembershipStatus},
): Promise<EnabledClaimReconciliationResult> {
  const state = (await getUserSecurityState({ userId })).data.userSecurityState;
  if (!state || state.user.membershipStatus !== membershipStatus) throw new Error("SECURITY_PROFILE_CONFLICT");
  if (state.syncStatus === "PENDING") await synchronizeUserSecurity(state.operationId);
  await transitionUserSecurity({ userId, actorId, reason: options.reason ?? "RECONCILE_AUTHORIZATION",
    membershipStatus: options.membershipStatus, ...options.authority, operationId: options.operationId });
  const latest = (await getUserSecurityState({ userId })).data.userSecurityState;
  return { enabled: latest?.accessReady === true, updated: true };
}
