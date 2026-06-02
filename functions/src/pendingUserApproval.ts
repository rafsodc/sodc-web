/**
 * Membership values that mean the user still needs admin approval.
 * Legacy rows may have null/blank status instead of explicit PENDING.
 */
export function isAwaitingMembershipApproval(
  membershipStatus: string | null | undefined
): boolean {
  if (membershipStatus === "PENDING") {
    return true;
  }
  if (membershipStatus == null) {
    return true;
  }
  if (typeof membershipStatus === "string" && membershipStatus.trim() === "") {
    return true;
  }
  return false;
}

/**
 * Auth account exists but no Data Connect profile yet (not enabled via claim).
 */
export function isUserAwaitingProfile(params: {
  authEnabled: boolean;
  hasDataConnectProfile: boolean;
}): boolean {
  return !params.authEnabled && !params.hasDataConnectProfile;
}

/**
 * Determines whether a user should appear on the admin Approve Users queue:
 * verified email, Auth `enabled` claim not true, and membership awaiting approval.
 */
export function isUserPendingApproval(params: {
  emailVerified: boolean;
  /** True only when custom claim enabled === true (unset counts as not enabled). */
  authEnabled: boolean;
  membershipStatus: string | null | undefined;
}): boolean {
  return (
    params.emailVerified === true &&
    !params.authEnabled &&
    isAwaitingMembershipApproval(params.membershipStatus)
  );
}
