import { vi } from 'vitest';
import type { UserData } from '../../types';

/**
 * Data Connect mocks
 */
export const createMockUserData = (overrides?: Partial<UserData>): UserData => {
  return {
    id: 'test-uid-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    serviceNumber: 'SN123456',
    membershipStatus: 'REGULAR',
    requestedMembershipStatus: null,
    isRegular: true,
    isReserve: false,
    isCivilServant: false,
    isIndustry: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
};

export const mockExecuteQuery = vi.fn();
export const mockExecuteMutation = vi.fn();
export const mockQueryRef = vi.fn();
export const mockMutationRef = vi.fn();

