import { MembershipStatus } from "@dataconnect/generated";
import { isNonRestrictedStatus } from "./membershipStatusValidation";

const STATUS_PREFIX = "Status:";

// Status-based access groups (auto-assigned, prefixed with "Status:")
const MEMBERSHIP_STATUS_TO_ACCESS_GROUP: Partial<Record<MembershipStatus, string>> = {
  REGULAR: "Status:Regular",
  RESERVE: "Status:Reserve",
  CIVIL_SERVICE: "Status:Civil Service",
  INDUSTRY: "Status:Industry",
  RETIRED: "Status:Retired",
  // PENDING, RESIGNED, LOST, DECEASED do not have access groups
};

/**
 * Gets the status-based access group name for a membership status
 * Returns null for restricted statuses
 * @param status - The membership status
 * @returns The access group name (e.g., "Status:Regular") or null
 */
export function getStatusBasedAccessGroupName(status: MembershipStatus): string | null {
  return MEMBERSHIP_STATUS_TO_ACCESS_GROUP[status] || null;
}

/**
 * Checks if an access group name is a status-based group (starts with "Status:")
 * @param groupName - The access group name
 * @returns True if the group is status-based
 */
export function isStatusBasedAccessGroup(groupName: string): boolean {
  return groupName.startsWith(STATUS_PREFIX);
}

/**
 * Extracts the membership status from a status-based access group name
 * @param groupName - The access group name (e.g., "Status:Regular")
 * @returns The membership status or null if not a status-based group
 */
export function getMembershipStatusFromGroupName(groupName: string): MembershipStatus | null {
  if (!isStatusBasedAccessGroup(groupName)) {
    return null;
  }
  
  const statusName = groupName.replace(STATUS_PREFIX, "");
  
  // Map display name to enum value
  const statusMap: Record<string, MembershipStatus> = {
    "Regular": MembershipStatus.REGULAR,
    "Reserve": MembershipStatus.RESERVE,
    "Civil Service": MembershipStatus.CIVIL_SERVICE,
    "Industry": MembershipStatus.INDUSTRY,
    "Retired": MembershipStatus.RETIRED,
  };
  
  return statusMap[statusName] || null;
}

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
