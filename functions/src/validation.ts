/**
 * Shared validation logic for membership status transitions
 * This mirrors the client-side validation in src/utils/membershipStatusValidation.ts
 */

// Non-restricted membership statuses that users can change between
const NON_RESTRICTED_STATUSES = [
  "REGULAR",
  "RETIRED",
  "RESERVE",
  "INDUSTRY",
  "CIVIL_SERVICE",
];

// Restricted membership statuses that users cannot change from or to
const RESTRICTED_STATUSES = [
  "PENDING",
  "RESIGNED",
  "LOST",
  "DECEASED",
];

type MembershipStatus = 
  | "PENDING"
  | "REGULAR"
  | "RESERVE"
  | "CIVIL_SERVICE"
  | "INDUSTRY"
  | "RETIRED"
  | "RESIGNED"
  | "LOST"
  | "DECEASED";

/** Values from Data Connect or legacy rows (may be blank). */
export type MembershipStatusInput = MembershipStatus | null | undefined | string;

export type MembershipValidationCode =
  | "ADMIN_RESTRICTED_STATUS"
  | "ACCOUNT_NOT_ENABLED"
  | "CURRENT_STATUS_RESTRICTED"
  | "TARGET_STATUS_RESTRICTED"
  | "MEMBERSHIP_STATUS_CHANGE_NOT_ALLOWED"
  | "ADMIN_RESIGNATION_NOT_ALLOWED"
  | "MEMBERSHIP_RESIGNATION_NOT_ALLOWED";

interface MembershipValidationResult {
  allowed: boolean;
  error?: string;
  code?: MembershipValidationCode;
}

/**
 * Checks if a membership status is restricted
 */
export function isRestrictedStatus(status: MembershipStatus): boolean {
  return RESTRICTED_STATUSES.includes(status);
}

/**
 * Checks if a membership status is non-restricted (enabled)
 */
export function isNonRestrictedStatus(status: MembershipStatus): boolean {
  return NON_RESTRICTED_STATUSES.includes(status);
}

/** True when status is null, undefined, or whitespace-only (legacy rows). */
export function isBlankMembershipStatus(
  status: MembershipStatusInput
): boolean {
  if (status == null) {
    return true;
  }
  if (typeof status === "string" && status.trim() === "") {
    return true;
  }
  return false;
}

/**
 * Statuses that block non-admin self-service changes (awaiting admin approval or unknown).
 */
export function isActivationBlockedStatus(
  status: MembershipStatusInput
): boolean {
  if (isBlankMembershipStatus(status)) {
    return true;
  }
  return isRestrictedStatus(status as MembershipStatus);
}

/**
 * Validates if a user can change from one membership status to another
 * @param currentStatus - The user's current membership status (null/blank if unknown or no row)
 * @param newStatus - The desired new membership status
 * @param isAdmin - Whether the user making the change is an admin
 * @param targetUserIsAdmin - Whether the target user (whose status is being changed) is an admin
 * @param callerEnabled - Whether the caller has auth.token.enabled === true
 * @returns Object with allowed boolean and optional error message
 */
export function canUserChangeStatus(
  currentStatus: MembershipStatusInput,
  newStatus: MembershipStatus,
  isAdmin: boolean,
  targetUserIsAdmin: boolean = false,
  callerEnabled: boolean = false
): MembershipValidationResult {
  // If target user is an admin, they cannot have a restricted status
  if (targetUserIsAdmin && isRestrictedStatus(newStatus)) {
    return {
      allowed: false,
      error: "Admins cannot have restricted membership statuses",
      code: "ADMIN_RESTRICTED_STATUS",
    };
  }

  // Admins can change any status to any status (except restricted for admin users, handled above)
  if (isAdmin) {
    return { allowed: true };
  }

  if (!callerEnabled) {
    return {
      allowed: false,
      error: "Account must be enabled",
      code: "ACCOUNT_NOT_ENABLED",
    };
  }

  if (isActivationBlockedStatus(currentStatus)) {
    return {
      allowed: false,
      error: "Cannot change from restricted status",
      code: "CURRENT_STATUS_RESTRICTED",
    };
  }

  if (isRestrictedStatus(newStatus)) {
    return {
      allowed: false,
      error: "Cannot change to restricted status",
      code: "TARGET_STATUS_RESTRICTED",
    };
  }

  if (
    typeof currentStatus !== "string" ||
    !isNonRestrictedStatus(currentStatus as MembershipStatus)
  ) {
    return {
      allowed: false,
      error: "Cannot change membership status",
      code: "MEMBERSHIP_STATUS_CHANGE_NOT_ALLOWED",
    };
  }

  return { allowed: true };
}

/**
 * Whether an enabled non-admin member may resign (transition to RESIGNED).
 */
export function canUserResignMembership(
  currentStatus: MembershipStatusInput,
  targetUserIsAdmin: boolean,
  callerEnabled: boolean
): MembershipValidationResult {
  if (targetUserIsAdmin) {
    return {
      allowed: false,
      error: "Admin accounts cannot resign through this flow",
      code: "ADMIN_RESIGNATION_NOT_ALLOWED",
    };
  }

  if (!callerEnabled) {
    return {
      allowed: false,
      error: "Account must be enabled",
      code: "ACCOUNT_NOT_ENABLED",
    };
  }

  if (isActivationBlockedStatus(currentStatus)) {
    return {
      allowed: false,
      error: "Cannot resign from current membership status",
      code: "MEMBERSHIP_RESIGNATION_NOT_ALLOWED",
    };
  }

  if (
    typeof currentStatus !== "string" ||
    !isNonRestrictedStatus(currentStatus as MembershipStatus)
  ) {
    return {
      allowed: false,
      error: "Cannot resign from current membership status",
      code: "MEMBERSHIP_RESIGNATION_NOT_ALLOWED",
    };
  }

  return { allowed: true };
}

export { NON_RESTRICTED_STATUSES, RESTRICTED_STATUSES };
export type { MembershipStatus };
