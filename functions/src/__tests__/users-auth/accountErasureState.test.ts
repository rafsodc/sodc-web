import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({read: vi.fn(), write: vi.fn(), remove: vi.fn()}));
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: () => ({executeGraphqlRead: mocks.read, executeGraphql: mocks.write})}));
vi.mock("firebase-admin/functions", () => ({getFunctions: () => ({taskQueue: () => ({delete: mocks.remove})})}));
import { accountErasureState, cancelErasureTasks, startAccountErasure } from "../../accountErasureState";
import { erasureEmailHash } from "../../communicationErasureGuard";
beforeEach(() => vi.resetAllMocks());
it("preserves the original drain clock when adding an historical address or retrying", async () => {
  const rows = [{emailHash: erasureEmailHash("current@example.invalid"), startedAt: "2026-01-01T00:00:00Z", profileDeletedAt: null, completedAt: null}];
  mocks.read.mockImplementation(async () => ({data: {accountErasures: [...rows]}}));
  mocks.write.mockImplementation(async (_query, options) => {rows.push({...rows[0], emailHash: options.variables.hash});});
  await startAccountErasure("member", ["current@example.invalid", "former@example.invalid"]);
  expect(mocks.write).toHaveBeenCalledOnce();
  expect(mocks.write.mock.calls[0][1].variables.startedAt).toBe(rows[0].startedAt);
  await startAccountErasure("member", ["former@example.invalid"]);
  expect(mocks.write).toHaveBeenCalledOnce();
});
it("accepts uncertain insertion only after independently observing the matching marker", async () => {
  const row = {emailHash: erasureEmailHash("member@example.invalid"), startedAt: "2026-01-01T00:00:00Z"};
  mocks.read.mockResolvedValueOnce({data: {accountErasures: []}}).mockResolvedValue({data: {accountErasures: [row]}});
  mocks.write.mockRejectedValue(new Error("connection lost"));
  await expect(startAccountErasure("member", ["member@example.invalid"])).resolves.toEqual(row);
  mocks.read.mockResolvedValue({data: {accountErasures: []}});
  await expect(startAccountErasure("member", ["member@example.invalid"])).rejects.toThrow("connection lost");
});
it("refuses unavailable or truncated marker state", async () => {
  mocks.read.mockResolvedValue({data: {}});
  await expect(accountErasureState("member")).rejects.toThrow("UNAVAILABLE");
  mocks.read.mockResolvedValue({data: {accountErasures: Array(1001).fill({})}});
  await expect(accountErasureState("member")).rejects.toThrow("UNAVAILABLE");
});
it("ignores already-absent tasks while stopping deletion on cancellation failure", async () => {
  mocks.remove.mockRejectedValueOnce({code: "functions/task-not-found"}).mockResolvedValueOnce(undefined);
  await cancelErasureTasks(new Set(["own-one", "own-two"]));
  expect(mocks.remove.mock.calls.map(call => call[0])).toEqual(["own-one", "own-two"]);
  mocks.remove.mockRejectedValue({code: "functions/permission-denied"});
  await expect(cancelErasureTasks(new Set(["own-three"]))).rejects.toMatchObject({code: "functions/permission-denied"});
});
