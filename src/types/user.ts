import { type MembershipStatus } from "@dataconnect/generated";

/**
 * User profile data from Data Connect
 */
export interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceNumber: string;
  membershipStatus: MembershipStatus;
  requestedMembershipStatus?: MembershipStatus | null;
  isRegular?: boolean | null;
  isReserve?: boolean | null;
  isCivilServant?: boolean | null;
  isIndustry?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User from Firebase Auth search results
 */
export interface SearchUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string | null;
  };
  customClaims: {
    admin?: boolean;
    enabled?: boolean;
    [key: string]: any;
  };
}

/**
 * Admin user from Firebase Auth
 */
export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string | null;
  };
}

/**
 * Pending user (extends UserData with id)
 */
export interface PendingUser extends UserData {
  id: string;
}

