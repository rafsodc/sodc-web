import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useUserData } from "../useUserData";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import * as dataConnect from "firebase/data-connect";
import { subscribeAuthorizationDenials } from "../../../../shared/auth/authorizationRecoveryEvents";
import { getCurrentUserRef } from "@dataconnect/generated";
import { captureSession, createSessionLifecycle, installSessionRuntime, suspendPrivateSession, type SessionToken } from "../../../../shared/appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../../../shared/auth/authorizationUpdate";

const mockAuth = vi.hoisted(() => ({ currentUser: null as { uid: string } | null }));

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
  QueryFetchPolicy: {
    SERVER_ONLY: "SERVER_ONLY",
  },
}));

vi.mock("@dataconnect/generated", () => ({
  getCurrentUserRef: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
  auth: mockAuth,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
let uninstallRuntime: (() => void) | undefined;
let activeSession: SessionToken | undefined;
let pendingUpdate: ReturnType<typeof beginAuthorizationUpdate> | undefined;
function installOwnedSession(uid = "test-uid") {
  const lifecycle = createSessionLifecycle();
  lifecycle.observe(uid);
  mockAuth.currentUser = { uid };
  uninstallRuntime = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  activeSession = captureSession(uid);
  return lifecycle;
}
afterEach(() => {
  pendingUpdate?.finish(false);
  if (activeSession) resumeAuthorizationReads(activeSession);
  uninstallRuntime?.();
  pendingUpdate = undefined; activeSession = undefined; uninstallRuntime = undefined;
  mockAuth.currentUser = null;
});

describe("useUserData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataConnect.executeQuery).mockReset();
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

  it("refreshes once and retries after an authentication error", async () => {
    vi.mocked(dataConnect.executeQuery)
      .mockRejectedValueOnce({ code: "dataconnect/unauthorized" })
      .mockResolvedValueOnce({ data: { user: mockUserData } } as any);
    const user = enabledUser();

    const { result } = renderHook(() => useUserData(user, true));

    await waitFor(() => expect(result.current.userData).toEqual(mockUserData));
    expect(user.getIdToken).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2);
  });

  it("hands explicit current-authorization denials to global recovery without a local token refresh or retry", async () => {
    const error = new Error("SESSION_VERSION_STALE");
    vi.mocked(dataConnect.executeQuery).mockRejectedValue(error);
    const denied = vi.fn();
    const unsubscribe = subscribeAuthorizationDenials(denied);
    const user = enabledUser();
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(denied).toHaveBeenCalledOnce());
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ error, session: expect.objectContaining({ uid: user.uid }) }));
    expect(user.getIdToken).not.toHaveBeenCalled();
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
    expect(result.current.userData).toBeNull();
    unsubscribe();
  });

  it("exits loading with an error when a Data Connect request never settles", async () => {
    vi.mocked(dataConnect.executeQuery).mockReturnValue(
      new Promise<never>(() => undefined),
    );

    const { result } = renderHook(() => useUserData(enabledUser("timeout-user"), true, 5));

    await waitFor(() => expect(result.current.error?.message).toBe("Loading the current user timed out"));
    expect(result.current.loading).toBe(false);
    expect(result.current.userData).toBeNull();
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
    expect(vi.mocked(dataConnect.executeQuery)).toHaveBeenLastCalledWith(
      mockRef,
      { fetchPolicy: "SERVER_ONLY" },
    );
  });
  it("clears populated data on logout and ignores an old response after B starts", async () => {
    const a = enabledUser("A");
    const b = enabledUser("B");
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    vi.mocked(dataConnect.executeQuery).mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }) as any)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }) as any);
    const { result, rerender } = renderHook(({ user }) => useUserData(user, true), { initialProps: { user: a as typeof a | null } });
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
    rerender({ user: null });
    expect(result.current.userData).toBeNull();
    expect(result.current.loading).toBe(false);
    rerender({ user: b });
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2));
    await act(async () => resolveA({ data: { user: { ...mockUserData, id: "A" } } }));
    expect(result.current.userData).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => resolveB({ data: { user: { ...mockUserData, id: "B" } } }));
    expect(result.current.userData?.id).toBe("B");
    rerender({ user: null });
    expect(result.current).toMatchObject({ userData: null, loading: false, error: null });
  });
  it("never displays a profile returned for another UID", async () => {
    vi.mocked(dataConnect.executeQuery).mockResolvedValue({ data: { user: mockUserData } } as any);
    const user = enabledUser("different-owner");
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userData).toBeNull();
  });

  it("restarts a pending initial request when StrictMode replays effects", async () => {
    const claims: Array<(value: any) => void> = [];
    let resolveProfile!: (value: unknown) => void;
    const user = createMockUser({ uid: "A", getIdTokenResult: vi.fn(() => new Promise<any>((resolve) => claims.push(resolve))) });
    vi.mocked(dataConnect.executeQuery).mockImplementation(() => new Promise((resolve) => { resolveProfile = resolve; }) as any);
    const { result } = renderHook(() => useUserData(user, true), {
      reactStrictMode: true,
    });
    await waitFor(() => expect(user.getIdTokenResult).toHaveBeenCalledTimes(2));
    await act(async () => claims[1]!({ claims: { enabled: true } }));
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
    await act(async () => claims[0]!({ claims: { enabled: true } }));
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
    await act(async () => resolveProfile({ data: { user: { ...mockUserData, id: "A" } } }));
    expect(result.current.userData?.id).toBe("A");
    expect(result.current.loading).toBe(false);
  });

  it.each(["before", "after", "unsettled"] as const)("resumes only the interrupted own-profile read when the old result settles %s handoff completion", async timing => {
    installOwnedSession();
    const oldRead = deferred<unknown>();
    const freshRead = deferred<unknown>();
    vi.mocked(dataConnect.executeQuery).mockReturnValueOnce(oldRead.promise as never).mockReturnValueOnce(freshRead.promise as never);
    const user = enabledUser();
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
    act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); });
    if (timing === "before") await act(async () => oldRead.resolve({ data: { user: mockUserData } }));
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
    act(() => pendingUpdate!.finish(true));
    // This read must start without waiting for the old unabortable promise.
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2));
    expect(dataConnect.executeQuery).toHaveBeenLastCalledWith(mockRef, { fetchPolicy: "SERVER_ONLY" });
    expect(result.current.userData).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => freshRead.resolve({ data: { user: { ...mockUserData, membershipStatus: "RESERVE" } } }));
    expect(result.current.userData?.membershipStatus).toBe("RESERVE");
    expect(result.current.loading).toBe(false);
    if (timing !== "before") await act(async () => oldRead.resolve({ data: { user: mockUserData } }));
    expect(result.current.userData?.membershipStatus).toBe("RESERVE");
    // A later update does not turn this hook into an unconditional background poll.
    act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); pendingUpdate.finish(true); });
    expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2);
  });

  it("waits for explicit recovery after a committed change cannot refresh", async () => {
    installOwnedSession();
    const oldRead = deferred<unknown>();
    vi.mocked(dataConnect.executeQuery).mockReturnValueOnce(oldRead.promise as never)
      .mockResolvedValue({ data: { user: { ...mockUserData, membershipStatus: "RESERVE" } } } as never);
    const user = enabledUser();
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
    act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); pendingUpdate.finish(false, true); });
    await act(async () => oldRead.resolve({ data: { user: mockUserData } }));
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
    expect(result.current.userData).toBeNull();
    act(() => resumeAuthorizationReads(activeSession!));
    await waitFor(() => expect(result.current.userData?.membershipStatus).toBe("RESERVE"));
    expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2);
  });

  it("resumes an interrupted load if the write fails without leaving a read fence", async () => {
    installOwnedSession();
    const oldRead = deferred<unknown>();
    vi.mocked(dataConnect.executeQuery).mockReturnValueOnce(oldRead.promise as never)
      .mockResolvedValue({ data: { user: mockUserData } } as never);
    const user = enabledUser();
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
    act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); pendingUpdate.finish(false); });
    await waitFor(() => expect(result.current.userData).toEqual(mockUserData));
    expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2);
    await act(async () => oldRead.resolve({ data: { user: mockUserData } }));
  });

  it.each(["logout", "replacement", "retirement", "disabled", "suspended", "unmount"])("does not restart interrupted work after %s", async departure => {
    const lifecycle = installOwnedSession();
    const oldRead = deferred<unknown>();
    vi.mocked(dataConnect.executeQuery).mockReturnValue(oldRead.promise as never);
    const user = enabledUser();
    const { result, rerender, unmount } = renderHook(({ owner, enabled }) => useUserData(owner, enabled),
      {initialProps: {owner: user as typeof user | null, enabled: true}});
    await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
    act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); });
    if (departure === "logout") { mockAuth.currentUser = null; lifecycle.observe(null); rerender({owner: null, enabled: true}); }
    if (departure === "replacement") { mockAuth.currentUser = {uid: "B"}; lifecycle.observe("B"); rerender({owner: enabledUser("B"), enabled: true}); }
    if (departure === "retirement") lifecycle.retire();
    if (departure === "disabled") rerender({owner: user, enabled: false});
    if (departure === "suspended") suspendPrivateSession(activeSession!);
    if (departure === "unmount") unmount();
    act(() => pendingUpdate!.finish(true));
    await act(async () => oldRead.resolve({data: {user: mockUserData}}));
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
    expect(result.current.userData).toBeNull();
  });

  it("restarts a claims lookup interrupted when the hook mounts during the handoff", async () => {
    installOwnedSession();
    act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); });
    const oldClaims = deferred<unknown>();
    const user = enabledUser();
    vi.mocked(user.getIdTokenResult).mockReturnValueOnce(oldClaims.promise as never);
    vi.mocked(dataConnect.executeQuery).mockResolvedValue({data: {user: mockUserData}} as never);
    const { result } = renderHook(() => useUserData(user, true));
    await waitFor(() => expect(user.getIdTokenResult).toHaveBeenCalledOnce());
    expect(dataConnect.executeQuery).not.toHaveBeenCalled();
    act(() => pendingUpdate!.finish(true));
    await waitFor(() => expect(result.current.userData).toEqual(mockUserData));
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
    expect(dataConnect.executeQuery).toHaveBeenLastCalledWith(mockRef, {fetchPolicy: "SERVER_ONLY"});
    await act(async () => oldClaims.resolve({claims: {enabled: true}}));
    expect(dataConnect.executeQuery).toHaveBeenCalledOnce();
  });

  it("does not recover an obsolete denial after the replacement profile has loaded", async () => {
    installOwnedSession();
    const oldRead = deferred<unknown>();
    vi.mocked(dataConnect.executeQuery).mockReturnValueOnce(oldRead.promise as never)
      .mockResolvedValue({data: {user: {...mockUserData, membershipStatus: "RESERVE"}}} as never);
    const denied = vi.fn();
    const unsubscribe = subscribeAuthorizationDenials(denied);
    try {
      const user = enabledUser();
      const { result } = renderHook(() => useUserData(user, true));
      await waitFor(() => expect(dataConnect.executeQuery).toHaveBeenCalledOnce());
      act(() => { pendingUpdate = beginAuthorizationUpdate(activeSession!); pendingUpdate.finish(true); });
      await waitFor(() => expect(result.current.userData?.membershipStatus).toBe("RESERVE"));
      await act(async () => oldRead.reject(new Error("ACCESS_REVOKED")));
      expect(result.current.userData?.membershipStatus).toBe("RESERVE");
      expect(denied).not.toHaveBeenCalled();
      expect(dataConnect.executeQuery).toHaveBeenCalledTimes(2);
    } finally { unsubscribe(); }
  });

});
