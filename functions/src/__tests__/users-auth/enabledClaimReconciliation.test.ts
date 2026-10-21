import { beforeEach, describe, expect, it, vi } from "vitest";
import { enabledClaimForMembershipStatus, reconcileEnabledClaim } from "../../enabledClaimReconciliation";
import { getUserSecurityState } from "../../securityRepository";
import { synchronizeUserSecurity, transitionUserSecurity } from "../../currentAuthorizationTransitions";
vi.mock("../../currentAuthorizationTransitions", () => ({synchronizeUserSecurity: vi.fn(), transitionUserSecurity: vi.fn()}));
const lookup = vi.mocked(getUserSecurityState);

describe("enabled claim mapping", () => {
  it.each(["REGULAR", "RETIRED", "RESERVE", "INDUSTRY", "CIVIL_SERVICE"] as const)("enables %s", status => expect(enabledClaimForMembershipStatus(status)).toBe(true));
  it.each(["PENDING", "RESIGNED", "LOST", "DECEASED"] as const)("restricts %s", status => expect(enabledClaimForMembershipStatus(status)).toBe(false));
});
describe("versioned mirror repair", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reconciles from current profile and security intent", async () => {
    await reconcileEnabledClaim("member", "REGULAR");
    expect(transitionUserSecurity).toHaveBeenCalledWith({userId: "member", actorId: "member", reason: "RECONCILE_AUTHORIZATION"});
  });
  it("resumes a pending transition instead of inventing a new grant", async () => {
    lookup.mockResolvedValueOnce({data: {userSecurityState: {syncStatus: "PENDING", operationId: "pending", user: {membershipStatus: "LOST"}}}} as never);
    await reconcileEnabledClaim("member", "LOST");
    expect(synchronizeUserSecurity).toHaveBeenCalledWith("pending");
    expect(transitionUserSecurity).not.toHaveBeenCalled();
  });
  it("rejects a stale status snapshot", async () => {
    await expect(reconcileEnabledClaim("member", "DECEASED")).rejects.toThrow("SECURITY_PROFILE_CONFLICT");
    expect(transitionUserSecurity).not.toHaveBeenCalled();
  });
});
