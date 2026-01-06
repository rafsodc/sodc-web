import type { UserData, SearchUser, AdminUser } from '../../types';
import { MembershipStatus } from '@dataconnect/generated';

/**
 * Factory functions for creating test user data
 */

export const createUserData = (overrides?: Partial<UserData>): UserData => ({
  id: 'test-uid-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  serviceNumber: 'SN123456',
  membershipStatus: MembershipStatus.REGULAR,
  requestedMembershipStatus: null,
  isRegular: true,
  isReserve: false,
  isCivilServant: false,
  isIndustry: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createSearchUser = (overrides?: Partial<SearchUser>): SearchUser => ({
  uid: 'test-uid-123',
  email: 'john.doe@example.com',
  displayName: 'Doe, John',
  emailVerified: true,
  disabled: false,
  metadata: {
    creationTime: '2024-01-01T00:00:00Z',
    lastSignInTime: '2024-01-01T00:00:00Z',
  },
  customClaims: {
    admin: false,
    enabled: true,
  },
  ...overrides,
});

export const createAdminUser = (overrides?: Partial<AdminUser>): AdminUser => ({
  uid: 'admin-uid-123',
  email: 'admin@example.com',
  displayName: 'Admin User',
  emailVerified: true,
  disabled: false,
  metadata: {
    creationTime: '2024-01-01T00:00:00Z',
    lastSignInTime: '2024-01-01T00:00:00Z',
  },
  ...overrides,
});

