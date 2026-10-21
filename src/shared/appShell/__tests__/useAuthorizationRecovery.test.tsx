import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../test-utils/mocks/firebase";
import { captureSession, createSessionLifecycle, installSessionRuntime, runSessionOperation, SessionChangedError } from "../sessionLifecycle";
import { reportAuthorizationDenial } from "../../auth/authorizationRecoveryEvents";
import type { OwnAuthorizationStatus } from "../../auth/authorizationStatus";

const { statusMock, legacyRefresh } = vi.hoisted(() => ({ statusMock: vi.fn(), legacyRefresh: vi.fn() }));
vi.mock("../../auth/authorizationStatus", () => ({ getMyAuthorizationStatus: statusMock }));
vi.mock("../../../features/users/hooks/useTokenRefresh", () => ({ refreshToken: legacyRefresh }));
import { useSessionRecovery } from "../useSessionRecovery";

const denied = new Error("ACCESS_REVOKED");
const stale = new Error("SESSION_VERSION_STALE");
const enabled: OwnAuthorizationStatus = { status: "enabled", isAdmin: false, securityVersion: 2, tokenVersionCurrent: true, verificationRequired: false };
let uninstall: (() => void) | undefined;
let queryClient: QueryClient;
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup() {
  const lifecycle = createSessionLifecycle();
  lifecycle.observe("A");
  const retire = vi.fn(() => lifecycle.retire());
  const signOut = vi.fn(async () => lifecycle.retire());
  uninstall = installSessionRuntime({ lifecycle, retire, signOut });
  const user = createMockUser({ uid: "A", getIdToken: vi.fn().mockResolvedValue("new-token") });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onRecovered = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const hook = renderHook(({ owner }) => useSessionRecovery(owner, { onRecovered, queryTimeoutMs: 100 }), { initialProps: { owner: user }, wrapper });
  return { ...hook, lifecycle, retire, signOut, user, onRecovered };
}
beforeEach(() => { vi.clearAllMocks(); statusMock.mockResolvedValue(enabled); legacyRefresh.mockResolvedValue(undefined); });
afterEach(() => { uninstall?.(); queryClient?.clear(); vi.useRealTimers(); });

describe("current authorization session recovery", () => {
  it("coalesces concurrent query, mutation and imperative denials before cancellation can reenter", async () => {
    const firstStatus = deferred<OwnAuthorizationStatus>();
    statusMock.mockReturnValueOnce(firstStatus.promise);
    const { user, retire, signOut, onRecovered } = setup();
    const token = captureSession("A");
    const cancel = vi.spyOn(queryClient, "cancelQueries").mockImplementation(async () => { reportAuthorizationDenial(denied, token); });
    const read = vi.fn().mockRejectedValue(stale);
    const write = vi.fn().mockRejectedValue(denied);
    const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: write });
    await act(async () => {
      await Promise.allSettled([
        queryClient.fetchQuery({ queryKey: ["GetCurrentUser", null], queryFn: read }),
        mutation.execute(undefined),
        runSessionOperation(async () => { throw denied; }),
      ]);
    });
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(1));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).not.toHaveBeenCalled();
    await act(async () => firstStatus.resolve({ ...enabled, tokenVersionCurrent: false }));
    await waitFor(() => expect(retire).toHaveBeenCalledOnce());
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(user.getIdToken).toHaveBeenCalledExactlyOnceWith(true);
    expect(read).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(onRecovered).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("promotes a real in-flight legacy token refresh without a second forced refresh or read replay", async () => {
    const { refreshToken: realRefresh } = await vi.importActual<typeof import("../../../features/users/hooks/useTokenRefresh")>("../../../features/users/hooks/useTokenRefresh");
    legacyRefresh.mockImplementation(realRefresh);
    const token = deferred<string>();
    const { result, user, retire, onRecovered } = setup();
    vi.mocked(user.getIdToken).mockReturnValue(token.promise);
    let oldRecovery!: Promise<void>;
    act(() => { oldRecovery = result.current.retry(); });
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledExactlyOnceWith(true));
    act(() => { reportAuthorizationDenial(stale, captureSession("A")); });
    await act(async () => { token.resolve("new-A-token"); await oldRecovery; });
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(retire).toHaveBeenCalledOnce();
    expect(user.getIdToken).toHaveBeenCalledExactlyOnceWith(true);
    expect(onRecovered).not.toHaveBeenCalled();
  });

  it("keeps pending access masked, blocks private work and waits for an explicit bounded retry", async () => {
    statusMock.mockResolvedValueOnce({ ...enabled, status: "pending" });
    const { result, user, retire, signOut } = setup();
    act(() => { reportAuthorizationDenial(denied, captureSession("A")); });
    await waitFor(() => expect(result.current.failure).toBe("authorization-pending"));
    expect(user.getIdToken).not.toHaveBeenCalled();
    expect(retire).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    const privateRead = vi.fn(async () => "private-data");
    await expect(runSessionOperation(privateRead)).rejects.toBeInstanceOf(SessionChangedError);
    expect(privateRead).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledOnce();
    await act(async () => {
      reportAuthorizationDenial(denied, captureSession("A"));
      reportAuthorizationDenial(stale, captureSession("A"));
    });
    expect(statusMock).toHaveBeenCalledOnce();
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    act(() => window.dispatchEvent(new Event("blur")));
    now.mockReturnValue(1_000 + 10 * 60_000);
    act(() => window.dispatchEvent(new Event("focus")));
    now.mockRestore();
    expect(statusMock).toHaveBeenCalledOnce();
    await act(async () => result.current.retry());
    expect(user.getIdToken).toHaveBeenCalledExactlyOnceWith(true);
    expect(retire).toHaveBeenCalledOnce();
    expect(statusMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    { ...enabled, status: "restricted" }, { ...enabled, status: "missing" },
    { ...enabled, verificationRequired: true },
  ])("signs out confirmed terminal own status %j without refreshing or retire-only reload", async value => {
    statusMock.mockResolvedValue(value);
    const { signOut, retire, user } = setup();
    act(() => { reportAuthorizationDenial(denied, captureSession("A")); });
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(retire).not.toHaveBeenCalled();
    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("ignores a stale own-status %s after retirement", async outcome => {
    const status = deferred<OwnAuthorizationStatus>();
    statusMock.mockReturnValue(status.promise);
    const { lifecycle, signOut, retire, user } = setup();
    act(() => { reportAuthorizationDenial(denied, captureSession("A")); });
    await waitFor(() => expect(statusMock).toHaveBeenCalledOnce());
    lifecycle.retire();
    await act(async () => { if (outcome === "resolve") status.resolve({ ...enabled, status: "restricted" }); else status.reject(new Error("old status error")); });
    expect(signOut).not.toHaveBeenCalled();
    expect(retire).not.toHaveBeenCalled();
    expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it("does not use a refreshed token response after its captured UID has changed", async () => {
    const token = deferred<string>();
    const { user, lifecycle, retire, signOut } = setup();
    vi.mocked(user.getIdToken).mockReturnValue(token.promise);
    act(() => { reportAuthorizationDenial(stale, captureSession("A")); });
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledOnce());
    lifecycle.observe("B");
    await act(async () => token.resolve("old-A-token"));
    expect(statusMock).toHaveBeenCalledOnce();
    expect(retire).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps access masked when verification still has an old version after the sole refresh", async () => {
    statusMock.mockResolvedValue({ ...enabled, tokenVersionCurrent: false });
    const { result, user, retire, signOut } = setup();
    act(() => { reportAuthorizationDenial(stale, captureSession("A")); });
    await waitFor(() => expect(result.current.failure).toBe("authorization-check-failed"));
    expect(user.getIdToken).toHaveBeenCalledExactlyOnceWith(true);
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(retire).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("bounds an own-status call that never returns", async () => {
    vi.useFakeTimers();
    statusMock.mockReturnValue(new Promise(() => undefined));
    const { result, user, retire } = setup();
    await act(async () => { reportAuthorizationDenial(stale, captureSession("A")); await vi.advanceTimersByTimeAsync(101); });
    expect(result.current.failure).toBe("request-timeout");
    expect(user.getIdToken).not.toHaveBeenCalled();
    expect(retire).not.toHaveBeenCalled();
  });

  it("does not run an old mutation continuation after enabled-account reset", async () => {
    const late = deferred<string>();
    const { retire } = setup();
    const followOn = vi.fn();
    const oldMutation = runSessionOperation(() => late.promise).then(followOn);
    act(() => { reportAuthorizationDenial(denied, captureSession("A")); });
    await waitFor(() => expect(retire).toHaveBeenCalledOnce());
    late.resolve("accepted-server-write");
    await expect(oldMutation).rejects.toBeInstanceOf(SessionChangedError);
    expect(followOn).not.toHaveBeenCalled();
  });
});
