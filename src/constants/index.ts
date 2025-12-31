/**
 * Application-wide constants
 */

// Pagination
export const ITEMS_PER_PAGE = 25;

// Debounce delays (in milliseconds)
export const SEARCH_DEBOUNCE_MS = 500;

// UI timeouts (in milliseconds)
export const SUCCESS_MESSAGE_TIMEOUT = 1500;
export const ERROR_MESSAGE_TIMEOUT = 5000;

// Membership status options for UI
import { MembershipStatus } from "../dataconnect-generated";

export const MEMBERSHIP_STATUS_OPTIONS = [
  { value: MembershipStatus.PENDING, label: "Pending" },
  { value: MembershipStatus.SERVING, label: "Serving" },
  { value: MembershipStatus.RETIRED, label: "Retired" },
  { value: MembershipStatus.RESIGNED, label: "Resigned" },
  { value: MembershipStatus.LOST, label: "Lost" },
  { value: MembershipStatus.DECEASED, label: "Deceased" },
] as const;

