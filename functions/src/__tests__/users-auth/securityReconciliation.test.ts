import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({control: vi.fn(), pending: vi.fn(), states: vi.fn(), synchronize: vi.fn(), healthy: vi.fn(), info: vi.fn(), warn: vi.fn()}));
vi.mock("firebase-functions/v2/scheduler", () => ({onSchedule: (_options: unknown, handler: unknown) => handler}));
vi.mock("firebase-functions/logger", () => ({info: mocks.info, warn: mocks.warn}));
vi.mock("../../securityRepository", () => ({getAdminSafetyControl: mocks.control, listPendingSecurityTransitions: mocks.pending, listSecurityStatesForReconciliation: mocks.states}));
vi.mock("../../securityReconciliationBatch", async importOriginal => ({...await importOriginal<typeof import("../../securityReconciliationBatch")>(), healthySecurityMirrorUserIds: mocks.healthy}));
vi.mock("../../currentAuthorizationTransitions", () => ({synchronizeUserSecurity: mocks.synchronize}));
import { reconcilePendingSecurityTransitions } from "../../securityReconciliation";

const run = () => (reconcilePendingSecurityTransitions as unknown as () => Promise<void>)();
beforeEach(() => {
  vi.resetAllMocks();
  mocks.control.mockResolvedValue({data: {adminSafetyControl: {status: "READY"}}});
  mocks.healthy.mockResolvedValue(new Set());
  mocks.pending.mockResolvedValue({data: {securityTransitions: []}});
  mocks.states.mockResolvedValue({data: {userSecurityStates: []}});
});

describe("security reconciliation cutover boundary", () => {
  it.each([null, {status: "BOOTSTRAP"}])("does no synchronization before activation: %j", async control => {
    mocks.control.mockResolvedValue({data: {adminSafetyControl: control}});
    await run();
    expect(mocks.pending).not.toHaveBeenCalled();
    expect(mocks.states).not.toHaveBeenCalled();
    expect(mocks.synchronize).not.toHaveBeenCalled();
  });

  it("fails closed when cutover state cannot be read", async () => {
    mocks.control.mockRejectedValue(new Error("unavailable"));
    await expect(run()).rejects.toThrow("unavailable");
    expect(mocks.pending).not.toHaveBeenCalled();
    expect(mocks.states).not.toHaveBeenCalled();
    expect(mocks.synchronize).not.toHaveBeenCalled();
  });

  it.each(["READY", "RECOVERY_REQUIRED"])("retains ordinary durable repair in %s", async status => {
    mocks.control.mockResolvedValue({data: {adminSafetyControl: {status}}});
    mocks.pending.mockResolvedValue({data: {securityTransitions: [{operationId: "pending"}]}});
    mocks.states.mockResolvedValue({data: {userSecurityStates: [{operationId: "ready"}]}});
    await run();
    expect(mocks.synchronize.mock.calls).toEqual([["pending"], ["ready"]]);
    expect(mocks.info).toHaveBeenLastCalledWith("Security reconciliation completed", {
      pendingAttempts: 1, stateAttempts: 1, failedAttempts: 0, healthyMirrorChecks: 0, durationMs: expect.any(Number), phaseMetrics: expect.objectContaining({pendingRepairs: 1, stateRepairs: 1, statePages: 1, statePageReads: 1}),
    });
  });

  it("continues past individual failures and measures all paginated attempts", async () => {
    mocks.pending.mockResolvedValue({data: {securityTransitions: [{operationId: "failed"}, {operationId: "pending"}]}});
    mocks.states.mockResolvedValueOnce({data: {userSecurityStates: Array.from({length: 500}, (_, i) => ({operationId: `ready-${i}`}))}})
      .mockResolvedValueOnce({data: {userSecurityStates: [{operationId: "last"}]}});
    mocks.synchronize.mockImplementation(async (operation: string) => {if (operation === "failed" || operation === "ready-0") throw new Error("temporary");});
    await run();
    expect(mocks.synchronize).toHaveBeenCalledTimes(503);
    expect(mocks.states.mock.calls).toEqual([[{limit: 500, offset: 0}], [{limit: 500, offset: 500}]]);
    expect(mocks.info).toHaveBeenLastCalledWith("Security reconciliation completed", {
      pendingAttempts: 2, stateAttempts: 501, failedAttempts: 2, healthyMirrorChecks: 0, durationMs: expect.any(Number),
      phaseMetrics: expect.objectContaining({pendingRepairs: 2, stateRepairs: 501, statePages: 2, statePageReads: 2}),
    });
    expect(mocks.warn).toHaveBeenCalledTimes(2);
  });
});
