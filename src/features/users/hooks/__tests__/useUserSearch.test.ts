import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';
import * as searchUsers from '../../utils/searchUsers';

// Mock searchUsers
vi.mock('../../utils/searchUsers', () => ({
  searchUsers: vi.fn(),
}));

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty search term', () => {
    const { result } = renderHook(() => useUserSearch());
    
    expect(result.current.searchTerm).toBe('');
    expect(result.current.users).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should initialize with provided search term', () => {
    const { result } = renderHook(() => useUserSearch('test'));
    
    expect(result.current.searchTerm).toBe('test');
  });

  it.skip('should not search when search term is empty', async () => {
    const { result } = renderHook(() => useUserSearch(''));
    
    act(() => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(searchUsers.searchUsers).not.toHaveBeenCalled();
      expect(result.current.users).toEqual([]);
    });
  });

  it.skip('should debounce search requests', async () => {
    vi.mocked(searchUsers.searchUsers).mockResolvedValue({
      success: true,
      data: {
        users: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      },
    });

    const { result } = renderHook(() => useUserSearch('', 500));

    act(() => {
      result.current.setSearchTerm('a');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.setSearchTerm('ab');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.setSearchTerm('abc');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(searchUsers.searchUsers).toHaveBeenCalledTimes(1);
      expect(searchUsers.searchUsers).toHaveBeenCalledWith('abc', 1, 25);
    });
  });

  it.skip('should handle successful search results', async () => {
    const mockUsers = [
      { 
        uid: '1', 
        email: 'user1@example.com', 
        displayName: 'User 1',
        emailVerified: true,
        disabled: false,
        metadata: { creationTime: '2024-01-01T00:00:00Z', lastSignInTime: null },
        customClaims: {}
      },
      { 
        uid: '2', 
        email: 'user2@example.com', 
        displayName: 'User 2',
        emailVerified: true,
        disabled: false,
        metadata: { creationTime: '2024-01-01T00:00:00Z', lastSignInTime: null },
        customClaims: {}
      },
    ];

    vi.mocked(searchUsers.searchUsers).mockResolvedValue({
      success: true,
      data: {
        users: mockUsers,
        total: 2,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      },
    });

    const { result } = renderHook(() => useUserSearch('test', 0));

    act(() => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.users).toEqual(mockUsers);
      expect(result.current.total).toBe(2);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
  });

  it.skip('should handle search errors', async () => {
    vi.mocked(searchUsers.searchUsers).mockResolvedValue({
      success: false,
      error: 'Search failed',
    });

    const { result } = renderHook(() => useUserSearch('test', 0));

    act(() => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Search failed');
      expect(result.current.users).toEqual([]);
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
  });

  it.skip('should handle page changes', async () => {
    vi.mocked(searchUsers.searchUsers).mockResolvedValue({
      success: true,
      data: {
        users: [],
        total: 50,
        page: 1,
        pageSize: 25,
        totalPages: 2,
      },
    });

    const { result } = renderHook(() => useUserSearch('test', 0));

    act(() => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.page).toBe(1);
    }, { timeout: 3000 });

    vi.mocked(searchUsers.searchUsers).mockResolvedValue({
      success: true,
      data: {
        users: [],
        total: 50,
        page: 2,
        pageSize: 25,
        totalPages: 2,
      },
    });

    act(() => {
      result.current.setPage(2);
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(searchUsers.searchUsers).toHaveBeenCalledWith('test', 2, 25);
      expect(result.current.page).toBe(2);
    }, { timeout: 3000 });
  });

  it.skip('should provide refetch function', async () => {
    vi.mocked(searchUsers.searchUsers).mockResolvedValue({
      success: true,
      data: {
        users: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      },
    });

    const { result } = renderHook(() => useUserSearch('test', 0));

    act(() => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(searchUsers.searchUsers).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(searchUsers.searchUsers).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });
  });
});

