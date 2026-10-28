import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionLifecycle, installSessionRuntime, suspendPrivateSession, captureSession } from "../../appShell/sessionLifecycle";
import { useDraftUnloadWarning, useSessionDraft } from "../useSessionDraft";

const uninstalls: Array<() => void> = [];
function session(uid = "member-a") {
  const lifecycle = createSessionLifecycle();
  lifecycle.observe(uid);
  uninstalls.push(installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() }));
  return lifecycle;
}
afterEach(() => { cleanup(); uninstalls.reverse().forEach(uninstall => uninstall()); uninstalls.length = 0; vi.restoreAllMocks(); });

describe("session-scoped navigation drafts", () => {
  it("restores the exact draft after unmount/navigation without browser storage", () => {
    session();
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const first = renderHook(() => useSessionDraft("event:one", { title: "", note: "" }));
    act(() => first.result.current[1]({ title: "Unsent event", note: "Keep this" }));
    first.unmount();
    const second = renderHook(() => useSessionDraft("event:one", { title: "", note: "" }));
    expect(second.result.current[0]).toEqual({ title: "Unsent event", note: "Keep this" });
    expect(storage).not.toHaveBeenCalled();
  });
  it("preserves an explicitly empty draft instead of restoring its initial value", () => {
    session();
    const first = renderHook(() => useSessionDraft<string | null>("empty", "Original"));
    act(() => first.result.current[1](null));
    first.unmount();
    expect(renderHook(() => useSessionDraft<string | null>("empty", "Original")).result.current[0]).toBeNull();
  });
  it("isolates resources immediately and restores each when returning through history", () => {
    session();
    const hook = renderHook(({ key }) => useSessionDraft(key, ""), { initialProps: { key: "event:one" } });
    act(() => hook.result.current[1]("First"));
    hook.rerender({ key: "event:two" });
    expect(hook.result.current[0]).toBe("");
    act(() => hook.result.current[1]("Second"));
    hook.rerender({ key: "event:one" });
    expect(hook.result.current[0]).toBe("First");
    hook.rerender({ key: "event:two" });
    expect(hook.result.current[0]).toBe("Second");
  });
  it("composes batched functional updates and discards successful/cancelled work", () => {
    session();
    const hook = renderHook(() => useSessionDraft("ticket:one", 0));
    act(() => { hook.result.current[1](n => n + 1); hook.result.current[1](n => n + 1); });
    expect(hook.result.current[0]).toBe(2);
    act(() => hook.result.current[2]());
    hook.unmount();
    expect(renderHook(() => useSessionDraft("ticket:one", 0)).result.current[0]).toBe(0);
  });
  it("clears all drafts at retirement and rejects late setters/discards", () => {
    const owner = session();
    const hook = renderHook(() => useSessionDraft("announcement:one", ""));
    act(() => hook.result.current[1]("Private A"));
    const late = hook.result.current;
    act(() => owner.retire());
    session("member-b");
    act(() => { late[1]("Late A"); late[2](); });
    const next = renderHook(() => useSessionDraft("announcement:one", ""));
    expect(next.result.current[0]).toBe("");
  });
  it("does not restore after a replacement lifecycle, even for the same UID", () => {
    session();
    const hook = renderHook(() => useSessionDraft("event:one", ""));
    act(() => hook.result.current[1]("Old document"));
    hook.unmount();
    session();
    expect(renderHook(() => useSessionDraft("event:one", "")).result.current[0]).toBe("");
  });
  it("rejects suspended-session updates and never caches anonymous drafts", () => {
    session();
    const hook = renderHook(() => useSessionDraft("event:one", ""));
    const old = hook.result.current[1];
    suspendPrivateSession(captureSession());
    act(() => old("Suspended"));
    expect(hook.result.current[0]).toBe("");
    session("");
    const anonymous = renderHook(() => useSessionDraft("event:anon", ""));
    act(() => anonymous.result.current[1]("Anonymous"));
    anonymous.unmount();
    expect(renderHook(() => useSessionDraft("event:anon", "")).result.current[0]).toBe("");
  });
  it("bounds the number of drafts", () => {
    session();
    const hook = renderHook(({ key }) => useSessionDraft(key, ""), { initialProps: { key: "0" } });
    for (let i = 0; i < 41; i++) { hook.rerender({ key: String(i) }); act(() => hook.result.current[1](String(i))); }
    hook.rerender({ key: "0" });
    expect(hook.result.current[0]).toBe("");
    hook.rerender({ key: "40" });
    expect(hook.result.current[0]).toBe("40");
  });
  it("warns on document unload only while dirty and never after retirement", () => {
    const owner = session();
    renderHook(() => useDraftUnloadWarning(true));
    const active = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(active);
    expect(active.defaultPrevented).toBe(true);
    owner.retire();
    const retired = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(retired);
    expect(retired.defaultPrevented).toBe(false);
  });
});
