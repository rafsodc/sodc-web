import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserData } from '../useUserData';
import { createMockUser } from '../../../../test-utils/mocks/firebase';
import * as dataConnect from 'firebase/data-connect';
import { getCurrentUserRef } from '@dataconnect/generated';

// Mock Firebase Data Connect
vi.mock('firebase/data-connect', () => ({
  executeQuery: vi.fn(),
}));

vi.mock('@dataconnect/generated', () => ({
  getCurrentUserRef: vi.fn(),
}));

vi.mock('../../../config/firebase', () => ({
  dataConnect: {},
}));

describe('useUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null userData when user is null', () => {
    const { result } = renderHook(() => useUserData(null));
    
    expect(result.current.userData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch user data when user is provided and enabled', async () => {
    const mockUser = createMockUser({
      uid: 'test-uid',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { enabled: true },
      }),
    });

    const mockUserData = {
      id: 'test-uid',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      serviceNumber: 'SN123',
      membershipStatus: 'REGULAR',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const mockRef = {};
    vi.mocked(getCurrentUserRef).mockReturnValue(mockRef as any);
    vi.mocked(dataConnect.executeQuery).mockResolvedValue({
      data: { user: mockUserData },
    } as any);

    const { result } = renderHook(() => useUserData(mockUser));

    await waitFor(() => {
      expect(result.current.userData).not.toBeNull();
    });

    expect(result.current.userData).toEqual(mockUserData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch user data when user is not enabled', async () => {
    const mockUser = createMockUser({
      uid: 'test-uid',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { enabled: false },
      }),
    });

    const { result } = renderHook(() => useUserData(mockUser));

    await waitFor(() => {
      expect(result.current.userData).toBeNull();
    });

    expect(dataConnect.executeQuery).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it.skip('should handle errors gracefully', async () => {
    const mockUser = createMockUser({
      uid: 'test-uid',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { enabled: true },
      }),
    });

    const mockRef = {};
    vi.mocked(getCurrentUserRef).mockReturnValue(mockRef as any);
    vi.mocked(dataConnect.executeQuery).mockRejectedValue(
      new Error('Query failed')
    );

    const { result } = renderHook(() => useUserData(mockUser));

    await waitFor(() => {
      expect(result.current.userData).toBeNull();
    });

    expect(result.current.error).toBeNull(); // Errors are handled silently
    expect(result.current.loading).toBe(false);
  });
});

