import { MembershipStatus } from "@dataconnect/generated";
import { isNonRestrictedStatus } from "./membershipStatusValidation";

/**
 * Checks if a user with the given membership status can have access groups
 * Returns false for restricted statuses
 * @param status - The membership status
 * @returns True if the user can have access groups
 */
export function canUserHaveAccessGroups(status: MembershipStatus): boolean {
  return isNonRestrictedStatus(status);
}

/**
 * Checks if a user is eligible to register for a section
 * User is eligible if they are in any of the allowed access groups
 * @param userAccessGroupIds - Array of access group IDs the user belongs to
 * @param allowedAccessGroupIds - Array of access group IDs allowed to register
 * @returns True if the user is eligible
 */
export function isUserEligibleForSection(
  userAccessGroupIds: string[],
  allowedAccessGroupIds: string[]
): boolean {
  if (!allowedAccessGroupIds || allowedAccessGroupIds.length === 0) {
    return false;
  }
  
  return userAccessGroupIds.some((groupId) => allowedAccessGroupIds.includes(groupId));
}
