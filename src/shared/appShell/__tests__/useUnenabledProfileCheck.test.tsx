import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeQuery, queryRef } from "firebase/data-connect";
import type { User } from "firebase/auth";
import { useUnenabledProfileCheck } from "../useUnenabledProfileCheck";
import { createMockUser } from "../../../test-utils/mocks/firebase";
import { createMockUserData } from "../../../test-utils/mocks/dataConnect";
import { SERVER_ONLY_QUERY_OPTIONS } from "../../query/authoritativeDataConnect";
import { createSessionLifecycle, installSessionRuntime } from "../sessionLifecycle";

const empty = { membershipStatusForUnenabled: null, needsProfileCompletion: false };
let uninstall: (() => void) | undefined;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.mocked(executeQuery).mockReset().mockResolvedValue({ data: { user: null } } as never);
  vi.mocked(queryRef).mockReturnValue({} as never);
});
afterEach(() => { uninstall?.(); uninstall = undefined; });
describe("unenabled profile request ownership", () => {
  it("does not start the onboarding probe while claims are unresolved, including when they resolve enabled", async () => {
    const user = createMockUser();
    const { result, rerender } = renderHook(({ enabled, resolved }) => useUnenabledProfileCheck(user, null, enabled, resolved), {
      initialProps: { enabled: false, resolved: false },
    });
    await act(async () => {});
    expect(executeQuery).not.toHaveBeenCalled();
    expect(result.current).toEqual(empty);
    rerender({ enabled: true, resolved: true });
    await act(async () => {});
    expect(executeQuery).not.toHaveBeenCalled();
    expect(result.current).toEqual(empty);
  });

  it.each([null, "PENDING", "RESIGNED"])("checks once after a disabled claim resolves and preserves profile status %s", async status => {
    const user = createMockUser();
    vi.mocked(executeQuery).mockResolvedValue({ data: { user: status ? { membershipStatus: status } : null } } as never);
    const { result, rerender } = renderHook(({ resolved }) => useUnenabledProfileCheck(user, null, false, resolved), {
      initialProps: { resolved: false },
    });
    expect(executeQuery).not.toHaveBeenCalled();
    rerender({ resolved: true });
    await waitFor(() => expect(result.current).toEqual({ membershipStatusForUnenabled: status, needsProfileCompletion: status === null }));
    expect(executeQuery).toHaveBeenCalledExactlyOnceWith(expect.anything(), SERVER_ONLY_QUERY_OPTIONS);
    rerender({ resolved: true });
    expect(executeQuery).toHaveBeenCalledOnce();
  });

  it.each(["anonymous", "unverified", "profile already loaded"])("skips the probe for %s", async kind => {
    const user = kind === "anonymous" ? null : createMockUser({ emailVerified: kind !== "unverified" });
    const userData = kind === "profile already loaded" ? createMockUserData() : null;
    const { result } = renderHook(() => useUnenabledProfileCheck(user, userData, false, true));
    await act(async () => {});
    expect(executeQuery).not.toHaveBeenCalled();
    expect(result.current).toEqual(empty);
  });

  it("hides previous onboarding state immediately when claims become unresolved and ignores the detached read", async () => {
    const user = createMockUser();
    const old = deferred<{ data: { user: null } }>();
    vi.mocked(executeQuery).mockReturnValueOnce(old.promise as never);
    const { result, rerender } = renderHook(({ resolved }) => useUnenabledProfileCheck(user, null, false, resolved), {
      initialProps: { resolved: true },
    });
    await waitFor(() => expect(executeQuery).toHaveBeenCalledOnce());
    rerender({ resolved: false });
    await act(async () => old.resolve({ data: { user: null } }));
    expect(result.current).toEqual(empty);
    vi.mocked(executeQuery).mockResolvedValueOnce({ data: { user: { membershipStatus: "PENDING" } } } as never);
    rerender({ resolved: true });
    await waitFor(() => expect(result.current.membershipStatusForUnenabled).toBe("PENDING"));
    expect(result.current.needsProfileCompletion).toBe(false);
    expect(executeQuery).toHaveBeenCalledTimes(2);
    rerender({ resolved: false });
    expect(result.current).toEqual(empty);
  });

  it("does not publish a pending existence result after the session retires", async () => {
    const user = createMockUser();
    const lifecycle = createSessionLifecycle(); lifecycle.observe(user.uid);
    uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
    const pending = deferred<{ data: { user: null } }>();
    vi.mocked(executeQuery).mockReturnValueOnce(pending.promise as never);
    const { result } = renderHook(() => useUnenabledProfileCheck(user, null, false, true));
    await waitFor(() => expect(executeQuery).toHaveBeenCalledOnce());
    act(() => lifecycle.retire());
    await act(async () => pending.resolve({ data: { user: null } }));
    expect(result.current).toEqual(empty);
  });

  it("preserves the existing missing-profile fallback when the permitted probe fails", async () => {
    const user = createMockUser();
    vi.mocked(executeQuery).mockRejectedValueOnce(new Error("Profile unavailable"));
    const { result } = renderHook(() => useUnenabledProfileCheck(user, null, false, true));
    await waitFor(() => expect(result.current.needsProfileCompletion).toBe(true));
    expect(result.current.membershipStatusForUnenabled).toBeNull();
  });

  it("does not query anonymously and ignores A's completion after B starts", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    vi.mocked(executeQuery).mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }) as never)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }) as never);
    const a = createMockUser({ uid: "A" });
    const b = createMockUser({ uid: "B" });
    const { result, rerender } = renderHook(({ user }: { user: User | null }) => useUnenabledProfileCheck(user, null, false, true), { initialProps: { user: null as User | null } });
    expect(executeQuery).not.toHaveBeenCalled();
    rerender({ user: a });
    await waitFor(() => expect(executeQuery).toHaveBeenCalledOnce());
    rerender({ user: b });
    await waitFor(() => expect(executeQuery).toHaveBeenCalledTimes(2));
    await act(async () => resolveA({ data: { user: { membershipStatus: "RESIGNED" } } }));
    expect(result.current).toEqual({ membershipStatusForUnenabled: null, needsProfileCompletion: false });
    await act(async () => resolveB({ data: { user: { membershipStatus: "PENDING" } } }));
    expect(result.current.membershipStatusForUnenabled).toBe("PENDING");
    rerender({ user: null });
    expect(result.current).toEqual({ membershipStatusForUnenabled: null, needsProfileCompletion: false });
  });
});
