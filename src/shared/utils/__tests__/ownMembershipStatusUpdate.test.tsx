import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MembershipStatus } from "@dataconnect/generated";
import { createMockUser } from "../../../test-utils/mocks/firebase";
import { createAppQueryClient } from "../../query/queryClient";
import { captureSession, createSessionLifecycle, installSessionRuntime, runSessionRead, SessionChangedError } from "../../appShell/sessionLifecycle";
import { useSessionRecovery } from "../../appShell/useSessionRecovery";
import { reportAuthorizationDenial, subscribeAuthorizationDenials } from "../../auth/authorizationRecoveryEvents";
import { resumeAuthorizationReads } from "../../auth/authorizationUpdate";

const mocks = vi.hoisted(() => ({ auth: { currentUser: null as ReturnType<typeof createMockUser> | null }, write: vi.fn(), status: vi.fn() }));
vi.mock("../../../config/firebase", () => ({ auth: mocks.auth, functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => mocks.write }));
vi.mock("../../auth/authorizationStatus", () => ({ getMyAuthorizationStatus: mocks.status }));
import { updateMembershipStatus } from "../firebaseFunctions/userAdmin";

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
let uninstall: (() => void) | undefined;
let tokenVersion: number;
let serverVersion: number;
let user: ReturnType<typeof createMockUser>;
let client: ReturnType<typeof createAppQueryClient>;
let lifecycle: ReturnType<typeof createSessionLifecycle>;
let retire: Mock<() => void>;
let signOut: Mock<() => Promise<void>>;
beforeEach(() => {
  vi.clearAllMocks();
  tokenVersion = serverVersion = 1;
  user = createMockUser({ uid: "member-A", getIdToken: vi.fn(async force => { if (force) tokenVersion = serverVersion; return `token-v${tokenVersion}`; }) });
  mocks.auth.currentUser = user;
  mocks.write.mockImplementation(async () => { serverVersion += 1; return { data: { success: true } }; });
  mocks.status.mockImplementation(async () => ({ status: "enabled", isAdmin: false, verificationRequired: false, tokenVersionCurrent: tokenVersion === serverVersion, securityVersion: serverVersion }));
  client = createAppQueryClient();
  lifecycle = createSessionLifecycle(); lifecycle.observe(user.uid);
  retire = vi.fn(() => lifecycle.retire()); signOut = vi.fn(async () => lifecycle.retire());
  uninstall = installSessionRuntime({ lifecycle, queryClient: client, retire, signOut });
});
afterEach(() => { resumeAuthorizationReads(captureSession(user.uid)); uninstall?.(); client.clear(); vi.useRealTimers(); });

describe("own-status authority handoff", () => {
  it("refreshes N to N+1 before the caller can perform its next protected write", async () => {
    const confirm = vi.fn(async () => { if (tokenVersion !== serverVersion) throw new Error("SESSION_VERSION_STALE"); });
    expect(await updateMembershipStatus(user.uid, MembershipStatus.RESERVE)).toEqual({ success: true });
    await confirm();
    expect(tokenVersion).toBe(2);
    expect(user.getIdToken).toHaveBeenCalledExactlyOnceWith(true);
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(retire).not.toHaveBeenCalled();
  });

  it("leaves another target's update independent of the caller token", async () => {
    expect(await updateMembershipStatus("another-member", MembershipStatus.RESERVE)).toEqual({ success: true });
    expect(user.getIdToken).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("does not cancel an outstanding public bearer query during a private status update", async () => {
    const ticket = deferred<string>();
    const queryFn = vi.fn(() => ticket.promise);
    const pending = client.fetchQuery({ queryKey: ["guest-ticket", "bearer"], meta: { sessionBoundary: "capability" }, queryFn });
    await waitFor(() => expect(queryFn).toHaveBeenCalledOnce());
    await expect(updateMembershipStatus(user.uid, MembershipStatus.RESERVE)).resolves.toEqual({ success: true });
    ticket.resolve("public ticket");
    await expect(pending).resolves.toBe("public ticket");
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("holds new query functions until refresh, discards an old unabortable denial, and never retires mid-save", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSessionRecovery(user), { wrapper });
    const old = deferred<string>();
    const interruptedRead = vi.fn().mockImplementationOnce(() => old.promise).mockImplementation(async () => `fresh-${tokenVersion}`);
    const observer = new QueryObserver(client, { queryKey: ["old-read"], queryFn: interruptedRead });
    const unsubscribe = observer.subscribe(() => undefined);
    await waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe("fetching"));
    const refresh = deferred<string>();
    vi.mocked(user.getIdToken).mockImplementation(() => refresh.promise.then(value => { tokenVersion = serverVersion; return value; }));
    const pending = updateMembershipStatus(user.uid, MembershipStatus.RESERVE);
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledOnce());
    const read = vi.fn(async () => tokenVersion);
    const next = client.fetchQuery({ queryKey: ["new-read"], queryFn: read }).catch(() => undefined);
    await act(async () => { old.reject(new Error("SESSION_VERSION_STALE")); await Promise.resolve(); });
    expect(read).not.toHaveBeenCalled();
    expect(retire).not.toHaveBeenCalled();
    refresh.resolve("token-v2");
    await expect(pending).resolves.toEqual({ success: true });
    await waitFor(() => expect(observer.getCurrentResult().data).toBe("fresh-2"));
    expect(interruptedRead).toHaveBeenCalledTimes(2);
    // Refresh cancels queued observers as well; an explicit fresh read is safe.
    await next;
    await expect(client.fetchQuery({ queryKey: ["new-read"], queryFn: read })).resolves.toBe(2);
    expect(result.current.status).toBe("idle");
    expect(retire).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("does not let query or mutation watchdogs time out work waiting for the bounded own update", async () => {
    vi.useFakeTimers();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSessionRecovery(user, { queryTimeoutMs: 10 }), { wrapper });
    const refresh = deferred<string>();
    vi.mocked(user.getIdToken).mockImplementation(() => refresh.promise.then(value => { tokenVersion = serverVersion; return value; }));
    let pending!: Promise<unknown>;
    await act(async () => { pending = updateMembershipStatus(user.uid, MembershipStatus.RESERVE); });
    expect(user.getIdToken).toHaveBeenCalledOnce();
    const read = vi.fn(async () => tokenVersion);
    const observer = new QueryObserver(client, { queryKey: ["waiting-at-gate"], queryFn: read });
    const unsubscribe = observer.subscribe(() => undefined);
    const unrelated = deferred<string>();
    const mutation = client.getMutationCache().build(client, { mutationFn: () => unrelated.promise });
    const heldMutation = mutation.execute(undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(31); });
    expect(read).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    await act(async () => { refresh.resolve("fresh-token"); await pending; });
    expect(result.current.status).toBe("idle");
    expect(retire).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(11); });
    expect(result.current.failure).toBe("request-timeout");
    await act(async () => { unrelated.resolve("finished"); await heldMutation; });
    unsubscribe();
  });

  it("reports a committed status truthfully when refresh fails, blocks reads and does not replay", async () => {
    vi.mocked(user.getIdToken).mockRejectedValue(new Error("offline"));
    const outcome = await updateMembershipStatus(user.uid, MembershipStatus.RESERVE);
    expect(outcome).toMatchObject({ success: false, domainCode: "MEMBERSHIP_STATUS_SAVED_REFRESH_FAILED" });
    expect(outcome.error).toMatch(/status was saved/);
    const read = vi.fn();
    await expect(runSessionRead(read)).rejects.toBeInstanceOf(SessionChangedError);
    expect(read).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledOnce();
  });

  it("keeps a partial-change fence when an explicit retry cannot refresh before writing", async () => {
    vi.mocked(user.getIdToken).mockRejectedValue(new Error("offline"));
    await updateMembershipStatus(user.uid, MembershipStatus.RESERVE);
    expect((await updateMembershipStatus(user.uid, MembershipStatus.RESERVE)).domainCode).toBe("MEMBERSHIP_STATUS_SAVED_REFRESH_FAILED");
    expect(mocks.write).toHaveBeenCalledOnce();
    const read = vi.fn();
    await expect(runSessionRead(read)).rejects.toBeInstanceOf(SessionChangedError);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["member-B", null])("fences refresh completion after actual Auth becomes %s", async uid => {
    const refresh = deferred<string>();
    vi.mocked(user.getIdToken).mockReturnValue(refresh.promise);
    const pending = updateMembershipStatus(user.uid, MembershipStatus.RESERVE);
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledOnce());
    mocks.auth.currentUser = uid ? createMockUser({ uid }) : null;
    refresh.resolve("old-A-token");
    expect((await pending).success).toBe(false);
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledOnce();
  });

  it("flushes an authoritative denial when the write fails", async () => {
    const write = deferred<never>(); mocks.write.mockReturnValue(write.promise);
    const denied = vi.fn(); const unsubscribe = subscribeAuthorizationDenials(denied);
    const pending = updateMembershipStatus(user.uid, MembershipStatus.RESERVE);
    await waitFor(() => expect(mocks.write).toHaveBeenCalledOnce());
    reportAuthorizationDenial(new Error("ACCESS_REVOKED"), captureSession(user.uid));
    expect(denied).not.toHaveBeenCalled();
    write.reject(new Error("offline"));
    await pending;
    expect(denied).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("does not continue after the original session generation retires during refresh", async () => {
    const refresh = deferred<string>();
    vi.mocked(user.getIdToken).mockReturnValue(refresh.promise);
    const pending = updateMembershipStatus(user.uid, MembershipStatus.RESERVE);
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledOnce());
    lifecycle.retire();
    refresh.resolve("old-generation-token");
    expect((await pending).success).toBe(false);
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledOnce();
  });

  it("hands a concurrent admin demotion to a document reset", async () => {
    vi.mocked(user.getIdTokenResult).mockResolvedValue({ claims: { admin: true, enabled: true, securityVersion: 1 } } as never);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    renderHook(() => useSessionRecovery(user), { wrapper });
    await act(async () => { await updateMembershipStatus(user.uid, MembershipStatus.RESERVE); });
    await waitFor(() => expect(retire).toHaveBeenCalledOnce());
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("hands a concurrent restriction to terminal recovery instead of treating refresh as authority", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    mocks.status.mockResolvedValue({ status: "restricted", verificationRequired: false, tokenVersionCurrent: true });
    renderHook(() => useSessionRecovery(user), { wrapper });
    await act(async () => { await updateMembershipStatus(user.uid, MembershipStatus.RESERVE); });
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(mocks.write).toHaveBeenCalledOnce();
  });
});
