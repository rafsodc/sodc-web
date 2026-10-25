import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpsCallable } from "firebase/functions";
import { MembershipStatus } from "@dataconnect/generated";
import { createSessionLifecycle, installSessionRuntime } from "../../appShell/sessionLifecycle";
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("../../../config/firebase", () => ({ functions: {}, auth: { currentUser: { uid: "caller-A" } } }));
import { grantAdminClaim, revokeAdminClaim, updateMembershipStatus, resignMembership, updateUserEmail, userEmailChangeError } from "../firebaseFunctions/userAdmin";
import { confirmPotentialLostMember, type PotentialLostMember } from "../firebaseFunctions/potentialLost";
import { reconcileMyEmail } from "../firebaseFunctions/authEmailActions";
import { toProfileDomainUserFacingError } from "../../errors/profileErrors";
let uninstall: (() => void) | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  const lifecycle = createSessionLifecycle();
  lifecycle.observe("caller-A");
  uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
});
afterEach(() => uninstall?.());
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cases = [
  { action: "grantAdmin", input: { uid: "target" }, invoke: () => grantAdminClaim("target") },
  { action: "revokeAdmin", input: { uid: "target" }, invoke: () => revokeAdminClaim("target") },
  { action: "updateMembershipStatus", input: { userId: "target", newStatus: "REGULAR" }, invoke: () => updateMembershipStatus("target", MembershipStatus.REGULAR) },
  { action: "resignMembership", input: {}, invoke: () => resignMembership() },
  { action: "updateUserEmail", input: { userId: "target", email: "new@example.org", expectedEmail: "old@example.org" }, invoke: () => updateUserEmail("target", "new@example.org", "old@example.org") },
  { action: "confirmPotentialLostMember", input: { userId: "target", reviewToken: "review-evidence" }, invoke: () => confirmPotentialLostMember({ id: "target", reviewToken: "review-evidence" } as PotentialLostMember) },
  { action: "reconcileMyEmail", input: {}, invoke: () => reconcileMyEmail() },
];
describe("interactive security callable request contract", () => {
  it.each(cases)("sends a UUID and only trusted-shape client input to $action", async ({ action, input, invoke }) => {
    const callable = vi.fn().mockResolvedValue({ data: { success: true, email: "verified@example.org" } });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);
    await invoke();
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), action);
    expect(callable).toHaveBeenCalledExactlyOnceWith({ ...input, operationId: expect.stringMatching(uuid) });
    expect(callable.mock.calls[0][0]).not.toHaveProperty("actorId");
    expect(callable.mock.calls[0][0]).not.toHaveProperty("actorSecurityVersion");
  });

  it("preserves the same grant reference through the non-throwing error result and manual retry", async () => {
    const callable = vi.fn().mockRejectedValueOnce({ code: "functions/unavailable" }).mockResolvedValue({ data: { success: true } });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);
    expect((await grantAdminClaim("target")).success).toBe(false);
    expect(callable).toHaveBeenCalledOnce();
    expect((await grantAdminClaim("target")).success).toBe(true);
    expect(callable.mock.calls[1][0].operationId).toBe(callable.mock.calls[0][0].operationId);
  });

  it("preserves the exact email input reference across an incomplete outcome and retry", async () => {
    const error = { code: "functions/unavailable", details: { code: "EMAIL_CHANGE_INCOMPLETE" } };
    const callable = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ data: { success: true } });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);
    await expect(updateUserEmail("target", "new@example.org", "old@example.org")).rejects.toBe(error);
    await updateUserEmail("target", "new@example.org", "old@example.org");
    expect(callable.mock.calls[1][0]).toEqual(callable.mock.calls[0][0]);
  });

  it("makes a changed Potential Lost review token a new intent", async () => {
    const callable = vi.fn().mockRejectedValue({ code: "functions/unavailable" });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);
    await confirmPotentialLostMember({ id: "target", reviewToken: "before" } as PotentialLostMember).catch(() => undefined);
    await confirmPotentialLostMember({ id: "target", reviewToken: "after" } as PotentialLostMember).catch(() => undefined);
    expect(callable.mock.calls[1][0].operationId).not.toBe(callable.mock.calls[0][0].operationId);
  });

  it("exposes last-admin protection consistently in role, email and profile refusal copy", async () => {
    const error = { code: "functions/failed-precondition", details: { code: "LAST_ADMIN_REQUIRED" }, message: "private database state" };
    vi.mocked(httpsCallable).mockReturnValue(vi.fn().mockRejectedValue(error) as never);
    const refusal = await revokeAdminClaim("target");
    expect(refusal.error).toMatch(/Give another eligible member/);
    expect(userEmailChangeError(error)).toBe(refusal.error);
    expect(toProfileDomainUserFacingError("LAST_ADMIN_REQUIRED", "resignation").message).toBe(refusal.error);
    expect(refusal.error).not.toContain(error.message);
  });
});
