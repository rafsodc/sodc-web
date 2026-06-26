import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useUserSearch } from "../useUserSearch";
import * as searchUsersModule from "../../utils/searchUsers";

vi.mock("../../utils/searchUsers", () => ({
  searchUsers: vi.fn(),
}));

const mockSearchUsers = vi.mocked(searchUsersModule.searchUsers);

const emptyResult = {
  success: true as const,
  data: { users: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
};

const mockUsers = [
  {
    uid: "1",
    email: "user1@example.com",
    displayName: "User 1",
    emailVerified: true,
    disabled: false,
    metadata: { creationTime: "2024-01-01T00:00:00Z", lastSignInTime: null },
    customClaims: {},
  },
  {
    uid: "2",
    email: "user2@example.com",
    displayName: "User 2",
    emailVerified: true,
    disabled: false,
    metadata: { creationTime: "2024-01-01T00:00:00Z", lastSignInTime: null },
    customClaims: {},
  },
];

describe("useUserSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initialises with empty state when no search term provided", () => {
    const { result } = renderHook(() => useUserSearch());

    expect(result.current.searchTerm).toBe("");
    expect(result.current.users).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.total).toBe(0);
  });

  it("does not search when search term is empty", async () => {
    renderHook(() => useUserSearch(""));

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it("searches with initial search term after debounce", async () => {
    mockSearchUsers.mockResolvedValue(emptyResult);

    renderHook(() => useUserSearch("test"));

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockSearchUsers).toHaveBeenCalledWith("test", 1, 25);
  });

  it("debounces rapid typing — only fires once for the final term", async () => {
    mockSearchUsers.mockResolvedValue(emptyResult);

    const { result } = renderHook(() => useUserSearch("", 500));

    act(() => result.current.setSearchTerm("a"));
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve(); });

    act(() => result.current.setSearchTerm("ab"));
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve(); });

    act(() => result.current.setSearchTerm("abc"));
    await act(async () => { vi.advanceTimersByTime(600); await Promise.resolve(); });

    expect(mockSearchUsers).toHaveBeenCalledTimes(1);
    expect(mockSearchUsers).toHaveBeenCalledWith("abc", 1, 25);
  });

  it("populates users and totals on successful search", async () => {
    vi.useRealTimers();
    mockSearchUsers.mockResolvedValue({
      success: true,
      data: { users: mockUsers, total: 2, page: 1, pageSize: 25, totalPages: 1 },
    });

    const { result } = renderHook(() => useUserSearch("test", 0));

    await waitFor(() => expect(result.current.users).toEqual(mockUsers));

    expect(result.current.total).toBe(2);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error and clears users on failed search", async () => {
    vi.useRealTimers();
    mockSearchUsers.mockResolvedValue({ success: false, error: "Search failed" });

    const { result } = renderHook(() => useUserSearch("test", 0));

    await waitFor(() => expect(result.current.error).toBe("Search failed"));

    expect(result.current.users).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("sets error on thrown exception", async () => {
    vi.useRealTimers();
    mockSearchUsers.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUserSearch("test", 0));

    await waitFor(() => expect(result.current.error).toBe("Network error"));
  });

  it("clears results when search term is cleared", async () => {
    // Use real timers for this test to avoid waitFor deadlock with fake timers
    vi.useRealTimers();

    mockSearchUsers.mockResolvedValue({
      success: true,
      data: { users: mockUsers, total: 2, page: 1, pageSize: 25, totalPages: 1 },
    });

    const { result } = renderHook(() => useUserSearch("test", 0));

    await waitFor(() => expect(result.current.users).toEqual(mockUsers));

    act(() => result.current.setSearchTerm(""));

    await waitFor(() => expect(result.current.users).toEqual([]));
    expect(result.current.error).toBeNull();
  });

  it("fetches the new page when setPage is called", async () => {
    vi.useRealTimers();

    mockSearchUsers.mockResolvedValue({
      success: true,
      data: { users: [], total: 50, page: 1, pageSize: 25, totalPages: 2 },
    });

    const { result } = renderHook(() => useUserSearch("test", 0));

    await waitFor(() => expect(result.current.page).toBe(1));

    mockSearchUsers.mockResolvedValue({
      success: true,
      data: { users: [], total: 50, page: 2, pageSize: 25, totalPages: 2 },
    });

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(mockSearchUsers).toHaveBeenCalledWith("test", 2, 25);
    });

    expect(result.current.page).toBe(2);
  });

  it("refetch re-runs the current search", async () => {
    vi.useRealTimers();

    mockSearchUsers.mockResolvedValue(emptyResult);

    const { result } = renderHook(() => useUserSearch("test", 0));

    // Wait for initial mount searches to settle (page effect + debounce both fire with debounceMs=0)
    await waitFor(() => expect(mockSearchUsers).toHaveBeenCalled());
    const callsBefore = vi.mocked(searchUsersModule.searchUsers).mock.calls.length;

    act(() => result.current.refetch());

    await waitFor(() =>
      expect(vi.mocked(searchUsersModule.searchUsers).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });
});
