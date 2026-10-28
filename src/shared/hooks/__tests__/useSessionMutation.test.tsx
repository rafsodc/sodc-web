import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureSession, createSessionLifecycle, installSessionRuntime, SessionChangedError, suspendPrivateSession } from "../../appShell/sessionLifecycle";
import { useSessionMutation } from "../useSessionMutation";

const uninstalls: Array<() => void> = [];
function session(uid = "member-a") {
  const lifecycle = createSessionLifecycle(); lifecycle.observe(uid);
  uninstalls.push(installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() }));
  return lifecycle;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, failed) => { resolve = done; reject = failed; });
  return { promise, resolve, reject };
}
afterEach(() => { cleanup(); uninstalls.reverse().forEach(uninstall => uninstall()); uninstalls.length = 0; });

describe("session mutation journal", () => {
  it("shares one unresolved create after leaving and returning, including synchronous repeated clicks", async () => {
    session(); const pending = deferred<string>(); const create = vi.fn(() => pending.promise);
    const first = renderHook(() => useSessionMutation<string>("event:new"));
    let initial!: Promise<string>;
    act(() => { initial = first.result.current.runOnce(create); expect(first.result.current.runOnce(create)).toBe(initial); });
    expect(first.result.current).toMatchObject({ status: "pending", pending: true });
    first.unmount();
    const restored = renderHook(() => useSessionMutation<string>("event:new"));
    expect(restored.result.current.status).toBe("pending");
    act(() => expect(restored.result.current.runOnce(create)).toBe(initial));
    expect(create).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve("created-id"); await initial; });
    expect(restored.result.current).toMatchObject({ status: "success", pending: false, result: "created-id", error: null });
  });

  it("updates every mounted consumer and retains a settled success until acknowledgement", async () => {
    session(); const operation = vi.fn(async () => ({ id: "created" }));
    const first = renderHook(() => useSessionMutation<{ id: string }>("ticket:new"));
    const second = renderHook(() => useSessionMutation<{ id: string }>("ticket:new"));
    let promise!: Promise<{ id: string }>;
    await act(async () => { promise = first.result.current.runOnce(operation); await promise; });
    expect(second.result.current.result).toEqual({ id: "created" });
    first.unmount(); second.unmount();
    const restored = renderHook(() => useSessionMutation<{ id: string }>("ticket:new"));
    expect(restored.result.current.status).toBe("success");
    expect(restored.result.current.runOnce(operation)).toBe(promise);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("restores an uncertain rejection and never blindly replays a failed create", async () => {
    session(); const failure = new Error("Response lost after possible commit"); const operation = vi.fn(async () => { throw failure; });
    const first = renderHook(() => useSessionMutation("create"));
    let promise!: Promise<unknown>;
    await act(async () => { promise = first.result.current.runOnce(operation); await expect(promise).rejects.toBe(failure); });
    first.unmount();
    const restored = renderHook(() => useSessionMutation("create"));
    expect(restored.result.current).toMatchObject({ status: "error", error: failure, pending: false });
    expect(restored.result.current.runOnce(operation)).toBe(promise);
    await expect(restored.result.current.runOnce(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("does not acknowledge a pending write; explicit settled acknowledgement allows a deliberate new operation", async () => {
    session(); const pending = deferred<string>(); const operation = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce("second");
    const hook = renderHook(() => useSessionMutation<string>("create"));
    let first!: Promise<string>;
    act(() => { first = hook.result.current.runOnce(operation); hook.result.current.acknowledge(); });
    expect(hook.result.current.status).toBe("pending");
    expect(hook.result.current.runOnce(operation)).toBe(first);
    await act(async () => { pending.resolve("first"); await first; });
    act(() => hook.result.current.acknowledge());
    expect(hook.result.current).toMatchObject({ status: "idle", result: undefined, error: null });
    await act(async () => { await expect(hook.result.current.runOnce(operation)).resolves.toBe("second"); });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("permits an explicit reconciled retry after acknowledging an uncertain error", async () => {
    session(); const operation = vi.fn().mockRejectedValueOnce(new Error("Unknown result")).mockResolvedValueOnce("reconciled-create");
    const hook = renderHook(() => useSessionMutation<string>("create"));
    await act(async () => { await expect(hook.result.current.runOnce(operation)).rejects.toThrow("Unknown result"); });
    act(() => hook.result.current.acknowledge());
    await act(async () => { await hook.result.current.runOnce(operation); });
    expect(hook.result.current.result).toBe("reconciled-create");
  });

  it.each(["retire", "replace", "suspend"] as const)("isolates the same resource after session %s and fences late completion", async change => {
    const owner = session(); const pending = deferred<string>(); const operation = vi.fn(() => pending.promise);
    const first = renderHook(() => useSessionMutation<string>("same"));
    let promise!: Promise<string>;
    act(() => { promise = first.result.current.runOnce(operation); });
    if (change === "retire") act(() => owner.retire());
    if (change === "suspend") act(() => suspendPrivateSession(captureSession()));
    if (change === "replace") session();
    first.rerender();
    expect(first.result.current.status).toBe("idle");
    await act(async () => { pending.resolve("private-old-result"); await expect(promise).rejects.toBeInstanceOf(SessionChangedError); });
    session("member-b");
    const next = renderHook(() => useSessionMutation<string>("same"));
    expect(next.result.current.status).toBe("idle");
    await act(async () => { await next.result.current.runOnce(async () => "member-b-result"); });
    expect(next.result.current.result).toBe("member-b-result");
  });

  it("does not let old callbacks or completions alter the current resource, even after A to B to A", async () => {
    session(); const pending = deferred<string>(); const oldOperation = vi.fn(() => pending.promise);
    const hook = renderHook(({ key }) => useSessionMutation<string>(key), { initialProps: { key: "A" } });
    const obsolete = hook.result.current;
    let first!: Promise<string>;
    act(() => { first = obsolete.runOnce(oldOperation); });
    hook.rerender({ key: "B" });
    await act(async () => { await hook.result.current.runOnce(async () => "B result"); });
    await act(async () => { pending.resolve("A result"); await first; });
    expect(hook.result.current.result).toBe("B result");
    hook.rerender({ key: "A" });
    expect(hook.result.current.result).toBe("A result");
    act(() => obsolete.acknowledge());
    expect(hook.result.current.result).toBe("A result");
    await expect(obsolete.runOnce(oldOperation)).rejects.toBeInstanceOf(SessionChangedError);
    expect(oldOperation).toHaveBeenCalledOnce();
  });

  it("does not let unmounted callbacks start or acknowledge a later activation", async () => {
    session(); const first = renderHook(() => useSessionMutation<string>("A"));
    await act(async () => { await first.result.current.runOnce(async () => "saved"); });
    const obsolete = first.result.current; first.unmount();
    const restored = renderHook(() => useSessionMutation<string>("A"));
    act(() => obsolete.acknowledge());
    expect(restored.result.current.result).toBe("saved");
    const operation = vi.fn(async () => "should not run");
    await expect(obsolete.runOnce(operation)).rejects.toBeInstanceOf(SessionChangedError);
    expect(operation).not.toHaveBeenCalled();
  });

  it("records synchronous thrown failures without rerunning them", async () => {
    session(); const operation = vi.fn(() => { throw new Error("Synchronous failure"); });
    const hook = renderHook(() => useSessionMutation<string>("A"));
    await act(async () => { await expect(hook.result.current.runOnce(operation)).rejects.toThrow("Synchronous failure"); });
    await expect(hook.result.current.runOnce(operation)).rejects.toThrow("Synchronous failure");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("keeps isolated consumers usable without caching anonymous results across mounts", async () => {
    const first = renderHook(() => useSessionMutation<string>("A"));
    await act(async () => { await first.result.current.runOnce(async () => "isolated"); });
    expect(first.result.current.result).toBe("isolated"); first.unmount();
    expect(renderHook(() => useSessionMutation<string>("A")).result.current.status).toBe("idle");
  });
});
