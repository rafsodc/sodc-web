import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptAuthenticatedIdentity, assertSessionCurrent, captureSession, createSessionLifecycle, installSessionRuntime, isSessionCurrent, runCapabilityOperation, runSessionOperation, SessionChangedError, retirePrivateSession, signOutPrivateSession } from "../sessionLifecycle";

let uninstall: (() => void) | undefined;
afterEach(() => uninstall?.());
function runtime(uid: string | null = null) {
  const lifecycle = createSessionLifecycle();
  lifecycle.observe(uid);
  const retire = vi.fn(() => lifecycle.retire());
  const signOut = vi.fn(async () => lifecycle.retire());
  uninstall = installSessionRuntime({ lifecycle, retire, signOut });
  return { lifecycle, retire, signOut };
}
describe("document session lifecycle", () => {
  it("restores initial auth and accepts first memory-only sign-in without retiring", () => {
    const { lifecycle } = runtime();
    expect(lifecycle.getSnapshot().uid).toBeNull();
    const session = acceptAuthenticatedIdentity("A");
    expect(isSessionCurrent(session)).toBe(true);
    expect(lifecycle.getSnapshot()).toMatchObject({ uid: "A", phase: "active" });
  });
  it.each([null, "B"])("permanently retires A when its observed replacement is %s", (next) => {
    const { lifecycle } = runtime("A");
    const session = captureSession("A");
    expect(lifecycle.observe(next)).toBe(false);
    expect(lifecycle.observe("B")).toBe(false);
    expect(lifecycle.getSnapshot()).toMatchObject({ uid: null, phase: "retiring" });
    expect(() => assertSessionCurrent(session)).toThrow(SessionChangedError);
  });
  it("does not reset generation for repeated events or same-UID refresh", () => {
    const { lifecycle } = runtime("A");
    const session = captureSession("A");
    lifecycle.observe("A");
    lifecycle.observe("A");
    expect(isSessionCurrent(session)).toBe(true);
  });
  it("rejects old success and failure before follow-on operations", async () => {
    const { lifecycle } = runtime("A");
    let resolve!: (value: string) => void;
    const followOn = vi.fn();
    const pending = runSessionOperation(() => new Promise<string>((done) => { resolve = done; })).then(followOn);
    lifecycle.retire();
    resolve("private A result");
    await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
    expect(followOn).not.toHaveBeenCalled();
    const operation = vi.fn(async () => "another request");
    await expect(runSessionOperation(operation)).rejects.toBeInstanceOf(SessionChangedError);
    expect(operation).not.toHaveBeenCalled();
  });
  it("provides the public retirement and terminal-signout seams", async () => {
    const state = runtime("A");
    retirePrivateSession({ reason: "account-changed" });
    await signOutPrivateSession({ reason: "authorization-changed" });
    expect(state.retire).toHaveBeenCalledWith({ reason: "account-changed" });
    expect(state.signOut).toHaveBeenCalledWith({ reason: "authorization-changed" });
  });
  it("keeps anonymous guest capability work valid through first login but fences retirement", async () => {
    const { lifecycle } = runtime();
    let resolve!: (value: string) => void;
    const pending = runCapabilityOperation(() => new Promise<string>((done) => { resolve = done; }));
    lifecycle.observe("first-user");
    resolve("same public guest ticket");
    await expect(pending).resolves.toBe("same public guest ticket");
    lifecycle.retire();
    await expect(runCapabilityOperation(async () => "never")).rejects.toBeInstanceOf(SessionChangedError);
  });

});
