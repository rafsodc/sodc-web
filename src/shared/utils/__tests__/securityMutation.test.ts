import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSecurityMutationRunner, securityMutationError } from "../securityMutation";
import { createSessionLifecycle, installSessionRuntime, SessionChangedError } from "../../appShell/sessionLifecycle";

const mockAuth = vi.hoisted(() => ({ currentUser: { uid: "admin-A" } as { uid: string } | null }));
vi.mock("../../../config/firebase", () => ({ auth: mockAuth }));
let uninstall: (() => void) | undefined;
function owner(uid: string) {
  uninstall?.();
  mockAuth.currentUser = { uid };
  const lifecycle = createSessionLifecycle();
  lifecycle.observe(uid);
  uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  return lifecycle;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => owner("admin-A"));
afterEach(() => { uninstall?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const uncertain = { code: "functions/unavailable" };

describe("security mutation intent ownership", () => {
  it("retains one UUID for explicit retry after uncertainty, never retries by itself, and completes the intent on success", async () => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValueOnce(uncertain).mockResolvedValue({ success: true });
    await expect(run("revokeAdmin", { uid: "target" }, write)).rejects.toBe(uncertain);
    await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
    await expect(run("revokeAdmin", { uid: "target" }, write)).resolves.toEqual({ success: true });
    const first = write.mock.calls[0][0].operationId;
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(write.mock.calls[1][0]).toEqual({ uid: "target", operationId: first });
    await run("revokeAdmin", { uid: "target" }, write);
    expect(write.mock.calls[2][0].operationId).not.toBe(first);
  });

  it("shares a pending identical submission without a duplicate server write", async () => {
    const run = createSecurityMutationRunner();
    const result = deferred<string>();
    const write = vi.fn(() => result.promise);
    const first = run("grantAdmin", { uid: "target" }, write);
    const second = run("grantAdmin", { uid: "target" }, write);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
    result.resolve("saved");
    await expect(first).resolves.toBe("saved");
  });

  it.each([
    [{ userId: "target", email: "new@example.org", expectedEmail: "old@example.org" }, { userId: "other", email: "new@example.org", expectedEmail: "old@example.org" }],
    [{ userId: "target", email: "new@example.org", expectedEmail: "old@example.org" }, { userId: "target", email: "other@example.org", expectedEmail: "old@example.org" }],
    [{ userId: "target", email: "new@example.org", expectedEmail: "old@example.org" }, { userId: "target", email: "new@example.org", expectedEmail: "changed@example.org" }],
  ])("uses a new ID when any submitted email intent field changes", async (first, second) => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValue(uncertain);
    await run("updateUserEmail", first, write).catch(() => undefined);
    await run("updateUserEmail", second, write).catch(() => undefined);
    expect(write.mock.calls[1][0].operationId).not.toBe(write.mock.calls[0][0].operationId);
  });

  it("does not reuse an old revoke ID after an intervening grant intent", async () => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValue(uncertain);
    await run("revokeAdmin", { uid: "target" }, write).catch(() => undefined);
    await run("grantAdmin", { uid: "target" }, write).catch(() => undefined);
    await run("revokeAdmin", { uid: "target" }, write).catch(() => undefined);
    expect(new Set(write.mock.calls.map(([input]) => input.operationId)).size).toBe(3);
  });

  it.each(["LAST_ADMIN_REQUIRED", "ADMIN_SAFETY_RECOVERY_REQUIRED", "SECURITY_OPERATION_CONFLICT"])("starts a new intent after the definite %s refusal", async code => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValue({ code: "functions/failed-precondition", details: { code } });
    await run("resignMembership", {}, write).catch(() => undefined);
    await run("resignMembership", {}, write).catch(() => undefined);
    expect(write.mock.calls[1][0].operationId).not.toBe(write.mock.calls[0][0].operationId);
  });

  it("preserves the reference after a conservative SECURITY_CONFLICT_RETRY outcome", async () => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValue({ code: "functions/aborted", details: { code: "SECURITY_CONFLICT_RETRY" } });
    await run("updateMembershipStatus", { userId: "target", newStatus: "REGULAR" }, write).catch(() => undefined);
    await run("updateMembershipStatus", { userId: "target", newStatus: "REGULAR" }, write).catch(() => undefined);
    expect(write.mock.calls[1][0].operationId).toBe(write.mock.calls[0][0].operationId);
    await run("updateMembershipStatus", { userId: "target", newStatus: "RESERVE" }, write).catch(() => undefined);
    expect(write.mock.calls[2][0].operationId).not.toBe(write.mock.calls[0][0].operationId);
  });

  it.each(["admin-A", "admin-B"])("cannot reuse an ID in a new document session owned by %s", async uid => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValue(uncertain);
    await run("revokeAdmin", { uid: "target" }, write).catch(() => undefined);
    owner(uid);
    await run("revokeAdmin", { uid: "target" }, write).catch(() => undefined);
    expect(write.mock.calls[1][0].operationId).not.toBe(write.mock.calls[0][0].operationId);
  });

  it("fences old responses without clearing a newer session's pending intent", async () => {
    const run = createSecurityMutationRunner();
    const old = deferred<string>();
    const next = deferred<string>();
    const write = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const first = run("revokeAdmin", { uid: "target" }, write);
    await Promise.resolve();
    owner("admin-B");
    const second = run("revokeAdmin", { uid: "target" }, write);
    await Promise.resolve();
    old.resolve("old result");
    await expect(first).rejects.toBeInstanceOf(SessionChangedError);
    expect(run("revokeAdmin", { uid: "target" }, write)).toBe(second);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0].operationId).not.toBe(write.mock.calls[0][0].operationId);
    next.resolve("new result");
    await expect(second).resolves.toBe("new result");
  });

  it.each(["admin-B", null])("refuses actual Auth replacement %s before the accepted-session observer publishes it", async uid => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockRejectedValue(uncertain);
    await run("revokeAdmin", { uid: "target" }, write).catch(() => undefined);
    const firstId = write.mock.calls[0][0].operationId;
    mockAuth.currentUser = uid ? { uid } : null;
    await expect(run("revokeAdmin", { uid: "target" }, write)).rejects.toBeInstanceOf(SessionChangedError);
    expect(write).toHaveBeenCalledOnce();
    mockAuth.currentUser = { uid: "admin-A" };
    await run("revokeAdmin", { uid: "target" }, write).catch(() => undefined);
    expect(write.mock.calls[1][0].operationId).not.toBe(firstId);
  });

  it("checks actual Auth again immediately before invoking a queued security writer", async () => {
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockResolvedValue("saved");
    const pending = run("grantAdmin", { uid: "target" }, write);
    mockAuth.currentUser = { uid: "admin-B" };
    await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects a late completion after actual Auth changes but the accepted session still says A", async () => {
    const run = createSecurityMutationRunner();
    const result = deferred<string>();
    const write = vi.fn(() => result.promise);
    const followOn = vi.fn();
    const pending = run("grantAdmin", { uid: "target" }, write).then(followOn);
    await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
    mockAuth.currentUser = { uid: "admin-B" };
    result.resolve("old-A-result");
    await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
    expect(followOn).not.toHaveBeenCalled();
  });

  it("works with blocked browser storage and a secure UUID fallback", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const persist = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => { bytes.fill(0); return bytes; } });
    const run = createSecurityMutationRunner();
    const write = vi.fn().mockResolvedValue("saved");
    await run("reconcileMyEmail", {}, write);
    expect(write.mock.calls[0][0].operationId).toBe("00000000-0000-4000-8000-000000000000");
    expect(read).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("keeps refusal copy useful without exposing backend text", () => {
    expect(securityMutationError({ message: "private backend text", details: { code: "LAST_ADMIN_REQUIRED" } }, "fallback")).toMatch(/Give another eligible member/);
    expect(securityMutationError(new Error("private backend text"), "fallback")).toBe("fallback");
  });
});
