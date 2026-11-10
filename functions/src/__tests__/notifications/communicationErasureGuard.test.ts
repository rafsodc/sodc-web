import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({read: vi.fn()}));
vi.unmock("../../communicationErasureGuard");
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: () => ({executeGraphqlRead: mocks.read})}));
import { erasingUserIds, erasureEmailHash, isErasedContact, isUserErasing } from "../../communicationErasureGuard";

beforeEach(() => vi.resetAllMocks());
it("blocks only erased identities and bounds the suppression lookup to requested IDs", async () => {
  mocks.read.mockResolvedValue({data: {accountErasures: [{userId: "removed"}]}});
  expect(await erasingUserIds(["removed", "survivor", "removed"])).toEqual(new Set(["removed"]));
  expect(mocks.read.mock.calls[0][1]).toEqual({variables: {ids: ["removed", "survivor"]}});
  expect(await isUserErasing("removed")).toBe(true);
});
it("does not recreate email-hash receipts for an erased contact, while permitting a new identity at the same address", async () => {
  mocks.read.mockResolvedValue({data: {accountErasures: [{userId: "old-identity"}]}});
  expect(await isErasedContact(" Person@Example.invalid ", null)).toBe(true);
  expect(await isErasedContact("person@example.invalid", "old-identity")).toBe(true);
  expect(await isErasedContact("person@example.invalid", "new-identity")).toBe(false);
  expect(mocks.read.mock.calls[0][1].variables.hash).toBe(erasureEmailHash("person@example.invalid"));
});
it("fails closed on missing or potentially truncated suppression results", async () => {
  mocks.read.mockResolvedValue({data: {}});
  await expect(isUserErasing("member")).rejects.toThrow("UNAVAILABLE");
  mocks.read.mockResolvedValue({data: {accountErasures: Array(10000).fill({userId: "member"})}});
  await expect(isErasedContact("person@example.invalid")).rejects.toThrow("UNAVAILABLE");
});
