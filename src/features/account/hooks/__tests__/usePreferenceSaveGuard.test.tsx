import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { captureSession, createSessionLifecycle, installSessionRuntime, suspendPrivateSession } from "../../../../shared/appShell/sessionLifecycle";
import { usePreferenceSaveGuard } from "../usePreferenceSaveGuard";

const authorization = vi.hoisted(() => ({ epoch: 0, blocked: false }));
vi.mock("../../../../shared/auth/authorizationUpdate", async importOriginal => ({
  ...await importOriginal<typeof import("../../../../shared/auth/authorizationUpdate")>(),
  authorizationReadEpoch: () => authorization.epoch,
  privateReadsBlocked: () => authorization.blocked,
}));
const uninstalls: Array<() => void> = [];
function session(uid = "member-a") {
  const owner = createSessionLifecycle(); owner.observe(uid);
  uninstalls.push(installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() }));
  return owner;
}
beforeEach(() => { authorization.epoch = 0; authorization.blocked = false; });
afterEach(() => { cleanup(); uninstalls.reverse().forEach(uninstall => uninstall()); uninstalls.length = 0; vi.restoreAllMocks(); });

it("rejects same-tick repeated requests until the current operation finishes", () => {
  session(); const hook = renderHook(() => usePreferenceSaveGuard("account"));
  const first = hook.result.current.begin()!;
  expect(first.isCurrent()).toBe(true); expect(hook.result.current.begin()).toBeNull();
  first.finish(); expect(hook.result.current.begin()!.isCurrent()).toBe(true);
});
it("keeps same-session cache work eligible after unmount but drops view feedback", () => {
  session(); const hook = renderHook(() => usePreferenceSaveGuard("section-a")); const first = hook.result.current.begin()!;
  hook.unmount(); expect(first.hasCurrentSession()).toBe(true); expect(first.isCurrent()).toBe(false);
});
it("scope changes including A to B to A cannot revive old callbacks or release a new request", () => {
  session(); const hook = renderHook(({ key }) => usePreferenceSaveGuard(key), { initialProps: { key: "a" } });
  const oldBegin = hook.result.current.begin, first = oldBegin()!;
  hook.rerender({ key: "b" }); hook.rerender({ key: "a" });
  const next = hook.result.current.begin()!;
  expect(first.isCurrent()).toBe(false); expect(oldBegin()).toBeNull();
  first.finish(); expect(next.isCurrent()).toBe(true); expect(hook.result.current.begin()).toBeNull();
});
it.each(["retire", "replace", "suspend", "authorization", "blocked"] as const)("fences cache and feedback after %s", change => {
  const owner = session(); const hook = renderHook(() => usePreferenceSaveGuard("account")); const operation = hook.result.current.begin()!;
  act(() => {
    if (change === "retire") owner.retire();
    if (change === "replace") session("member-b");
    if (change === "suspend") suspendPrivateSession(captureSession());
    if (change === "authorization") authorization.epoch++;
    if (change === "blocked") authorization.blocked = true;
  });
  expect(operation.hasCurrentSession()).toBe(false); expect(operation.isCurrent()).toBe(false);
  expect(operation.ownsView()).toBe(change === "authorization" || change === "blocked");
});
