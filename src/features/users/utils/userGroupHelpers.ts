import { MembershipStatus } from "@dataconnect/generated";
import { isNonRestrictedStatus } from "./membershipStatusValidation";

/**
 * Checks if a user with the given membership status can have user groups
 * Returns false for restricted statuses
 * @param status - The membership status
 * @returns True if the user can have user groups
 */
export function canUserHaveUserGroups(status: MembershipStatus): boolean {
  return isNonRestrictedStatus(status);
}

/**
 * Checks if a user is eligible to register for a section
 * User is eligible if they are in any of the allowed user groups
 * @param userUserGroupIds - Array of user group IDs the user belongs to
 * @param allowedUserGroupIds - Array of user group IDs allowed to register
 * @returns True if the user is eligible
 */
export function isUserEligibleForSection(
  userUserGroupIds: string[],
  allowedUserGroupIds: string[]
): boolean {
  if (!allowedUserGroupIds || allowedUserGroupIds.length === 0) {
    return false;
  }
  
  return userUserGroupIds.some((groupId) => allowedUserGroupIds.includes(groupId));
}
