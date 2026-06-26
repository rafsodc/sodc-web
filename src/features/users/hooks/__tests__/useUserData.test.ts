import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useUserData } from "../useUserData";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import * as dataConnect from "firebase/data-connect";
import { getCurrentUserRef } from "@dataconnect/generated";

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
}));

vi.mock("@dataconnect/generated", () => ({
  getCurrentUserRef: vi.fn(),
}));

vi.mock("../../../config/firebase", () => ({
  dataConnect: {},
}));

const mockRef = {};
const mockUserData = {
  id: "test-uid",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  serviceNumber: "SN123",
  membershipStatus: "REGULAR",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

function enabledUser(uid = "test-uid") {
  return createMockUser({
    uid,
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: { enabled: true } }),
  });
}

function disabledUser(uid = "test-uid") {
  return createMockUser({
    uid,
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: { enabled: false } }),
  });
}

describe("useUserData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserRef).mockReturnValue(mockRef as any);
  });

  it("returns null userData when user is null", () => {
    const { result } = renderHook(() => useUserData(null));

    expect(result.current.userData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches user data when user is enabled", async () => {
    vi.mocked(dataConnect.executeQuery).mockResolvedValue({
      data: { user: mockUserData },
    } as any);

    const { result } = renderHook(() => useUserData(enabledUser(), true));

    await waitFor(() => expect(result.current.userData).not.toBeNull());

    expect(result.current.userData).toEqual(mockUserData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("skips fetch and returns null when enabled claim is false", async () => {
    const { result } = renderHook(() => useUserData(disabledUser(), false));

    await waitFor(() => expect(result.current.userData).toBeNull());

    expect(dataConnect.executeQuery).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("fetches after account transitions from disabled to enabled", async () => {
    vi.mocked(dataConnect.executeQuery).mockResolvedValue({
      data: { user: mockUserData },
    } as any);

    const user = enabledUser();
    const { result, rerender } = renderHook(
      ({ enabled }) => useUserData(user, enabled),
      { initialProps: { enabled: false } }
    );

    await waitFor(() => expect(result.current.userData).toBeNull());
    expect(dataConnect.executeQuery).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.userData).toEqual(mockUserData));
    expect(dataConnect.executeQuery).toHaveBeenCalledTimes(1);
  });

  it("sets error state for unexpected non-auth errors", async () => {
    // The hook silences "not found" but propagates other unexpected errors via setError
    vi.mocked(dataConnect.executeQuery).mockRejectedValue(new Error("Query failed"));

    const { result } = renderHook(() => useUserData(enabledUser(), true));

    // Wait for executeQuery to be called and the error to propagate
    await waitFor(() => expect(vi.mocked(dataConnect.executeQuery)).toHaveBeenCalled());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.userData).toBeNull();
    expect(result.current.error?.message).toBe("Query failed");
  });

  it("silences 'not found' errors — userData is null but no error state", async () => {
    vi.mocked(dataConnect.executeQuery).mockRejectedValue(new Error("User not found in database"));

    const { result } = renderHook(() => useUserData(enabledUser(), true));

    // Wait for the query to be called, then confirm error is not set
    await waitFor(() => expect(vi.mocked(dataConnect.executeQuery)).toHaveBeenCalled());
    // Allow async state to settle
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

    expect(result.current.userData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns null and stops retrying when enabled claim is missing from token", async () => {
    const user = createMockUser({
      uid: "test-uid",
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }), // no enabled claim
    });

    const { result } = renderHook(() => useUserData(user, true));

    await waitFor(() => expect(result.current.userData).toBeNull());

    // Should not have attempted the data query
    expect(dataConnect.executeQuery).not.toHaveBeenCalled();
  });

  it("returns null when getIdTokenResult throws", async () => {
    const user = createMockUser({
      uid: "test-uid",
      getIdTokenResult: vi.fn().mockRejectedValue(new Error("Token error")),
    });

    const { result } = renderHook(() => useUserData(user, true));

    await waitFor(() => expect(result.current.userData).toBeNull());
    expect(dataConnect.executeQuery).not.toHaveBeenCalled();
  });

  it("exposes a refetch function that force-fetches data", async () => {
    vi.mocked(dataConnect.executeQuery).mockResolvedValue({
      data: { user: mockUserData },
    } as any);

    const { result } = renderHook(() => useUserData(enabledUser(), true));

    await waitFor(() => expect(result.current.userData).toEqual(mockUserData));

    const callCount = vi.mocked(dataConnect.executeQuery).mock.calls.length;

    await act(async () => {
      result.current.refetch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(vi.mocked(dataConnect.executeQuery).mock.calls.length).toBeGreaterThan(callCount);
    });
  });
});
