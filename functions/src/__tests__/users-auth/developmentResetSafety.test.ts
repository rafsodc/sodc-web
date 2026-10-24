import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertFreshDevelopmentReset } from "../../developmentResetSafety";
import { getAdminSafetyControl, listSecurityStatesForReconciliation } from "../../securityRepository";
const control = vi.mocked(getAdminSafetyControl), states = vi.mocked(listSecurityStatesForReconciliation);
beforeEach(() => {vi.resetAllMocks(); control.mockResolvedValue({data: {adminSafetyControl: null}}); states.mockResolvedValue({data: {userSecurityStates: []}});});
describe("destructive development reset fence", () => {
  it("permits only an explicitly empty current-security database", async () => {
    await expect(assertFreshDevelopmentReset()).resolves.toBeUndefined();
    expect(states).toHaveBeenCalledWith({limit: 1, offset: 0});
  });
  it.each(["control", "state", "control-outage", "state-outage"])("never reaches destructive work for %s", async failure => {
    if (failure === "control") control.mockResolvedValue({data: {adminSafetyControl: {id: "site-wide"}}} as never);
    if (failure === "state") states.mockResolvedValue({data: {userSecurityStates: [{userId: "existing"}]}} as never);
    if (failure === "control-outage") control.mockRejectedValue(new Error("unavailable"));
    if (failure === "state-outage") states.mockRejectedValue(new Error("unavailable"));
    const deleteAll = vi.fn();
    await expect((async () => {await assertFreshDevelopmentReset(); await deleteAll();})()).rejects.toThrow();
    expect(deleteAll).not.toHaveBeenCalled();
  });
});
