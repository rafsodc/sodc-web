import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileEnabledClaim } from "../../enabledClaimReconciliation";
import { getUserSecurityState } from "../../securityRepository";
import { synchronizeUserSecurity, transitionUserSecurity } from "../../currentAuthorizationTransitions";
vi.mock("../../currentAuthorizationTransitions", () => ({synchronizeUserSecurity: vi.fn(), transitionUserSecurity: vi.fn()}));
const options = {authority: {actorKind: "ADMIN" as const, actorSecurityVersion: 1}, operationId: "reconcile-test-operation"};
const lookup = vi.mocked(getUserSecurityState);

describe("versioned mirror repair", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reconciles from current profile and security intent", async () => {
    await reconcileEnabledClaim("member", "REGULAR", "reviewer", options);
    expect(transitionUserSecurity).toHaveBeenCalledWith(expect.objectContaining({userId: "member", actorId: "reviewer", reason: "RECONCILE_AUTHORIZATION", ...options.authority, operationId: options.operationId}));
  });
  it("resumes pending work before recording the new caller intent", async () => {
    lookup.mockResolvedValueOnce({data: {userSecurityState: {syncStatus: "PENDING", operationId: "pending", user: {membershipStatus: "LOST"}}}} as never);
    await reconcileEnabledClaim("member", "LOST", "reviewer", options);
    expect(synchronizeUserSecurity).toHaveBeenCalledWith("pending");
    expect(transitionUserSecurity).toHaveBeenCalledWith(expect.objectContaining({actorId: "reviewer", reason: "RECONCILE_AUTHORIZATION"}));
  });
  it("rejects a stale status snapshot", async () => {
    await expect(reconcileEnabledClaim("member", "DECEASED", "reviewer", options)).rejects.toThrow("SECURITY_PROFILE_CONFLICT");
    expect(transitionUserSecurity).not.toHaveBeenCalled();
  });
});
