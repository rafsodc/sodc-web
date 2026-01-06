/**
 * Application-wide constants
 */

// Re-export route constants
export * from "./routes";

// Re-export auth constants
export * from "./auth";

// Pagination
export const ITEMS_PER_PAGE = 25;

// Debounce delays (in milliseconds)
export const SEARCH_DEBOUNCE_MS = 500;

// UI timeouts (in milliseconds)
export const SUCCESS_MESSAGE_TIMEOUT = 1500;
export const ERROR_MESSAGE_TIMEOUT = 5000;

// Membership status options for UI
import { MembershipStatus } from "../dataconnect-generated";

// Re-export validation constants
export { NON_RESTRICTED_STATUSES, RESTRICTED_STATUSES } from "../features/users/utils/membershipStatusValidation";

export const MEMBERSHIP_STATUS_OPTIONS = [
  { value: MembershipStatus.PENDING, label: "Pending" },
  { value: MembershipStatus.REGULAR, label: "Regular" },
  { value: MembershipStatus.RESERVE, label: "Reserve" },
  { value: MembershipStatus.CIVIL_SERVICE, label: "Civil Service" },
  { value: MembershipStatus.INDUSTRY, label: "Industry" },
  { value: MembershipStatus.RETIRED, label: "Retired" },
  { value: MembershipStatus.RESIGNED, label: "Resigned" },
  { value: MembershipStatus.LOST, label: "Lost" },
  { value: MembershipStatus.DECEASED, label: "Deceased" },
] as const;

