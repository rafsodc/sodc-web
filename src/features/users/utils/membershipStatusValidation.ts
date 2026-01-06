import { MembershipStatus } from "../../../dataconnect-generated";

/**
 * Non-restricted membership statuses that users can change between
 */
export const NON_RESTRICTED_STATUSES: MembershipStatus[] = [
  MembershipStatus.REGULAR,
  MembershipStatus.RETIRED,
  MembershipStatus.RESERVE,
  MembershipStatus.INDUSTRY,
  MembershipStatus.CIVIL_SERVICE,
];

/**
 * Restricted membership statuses that users cannot change from or to
 */
export const RESTRICTED_STATUSES: MembershipStatus[] = [
  MembershipStatus.PENDING,
  MembershipStatus.RESIGNED,
  MembershipStatus.LOST,
  MembershipStatus.DECEASED,
];

/**
 * Checks if a membership status is in the non-restricted pool
 */
export function isNonRestrictedStatus(status: MembershipStatus): boolean {
  return NON_RESTRICTED_STATUSES.includes(status);
}

/**
 * Checks if a membership status is restricted
 */
export function isRestrictedStatus(status: MembershipStatus): boolean {
  return RESTRICTED_STATUSES.includes(status);
}

/**
 * Validates if a user can change from one membership status to another
 * @param currentStatus - The user's current membership status (null if new user)
 * @param newStatus - The desired new membership status
 * @param isAdmin - Whether the user making the change is an admin
 * @param targetUserIsAdmin - Whether the target user (whose status is being changed) is an admin
 * @returns Object with allowed boolean and optional error message
 */
export function canUserChangeStatus(
  currentStatus: MembershipStatus | null,
  newStatus: MembershipStatus,
  isAdmin: boolean,
  targetUserIsAdmin: boolean = false
): { allowed: boolean; error?: string } {
  // If target user is an admin, they cannot have a restricted status
  if (targetUserIsAdmin && isRestrictedStatus(newStatus)) {
    return {
      allowed: false,
      error: "Admins cannot have restricted membership statuses",
    };
  }

  // Admins can change any status to any status (except restricted for admin users, handled above)
  if (isAdmin) {
    return { allowed: true };
  }

  // If current status is restricted, user cannot change it
  if (currentStatus && isRestrictedStatus(currentStatus)) {
    return {
      allowed: false,
      error: "Cannot change from restricted status",
    };
  }

  // If new status is restricted, user cannot change to it
  if (isRestrictedStatus(newStatus)) {
    return {
      allowed: false,
      error: "Cannot change to restricted status",
    };
  }

  // If both are non-restricted (or current is null for new users), allow the change
  return { allowed: true };
}

