import { describe, expect, it, vi } from "vitest";
import { persistMembershipStatusWithEnabledClaim } from "../../membershipStatus";

describe("membership security boundary", () => {
  it.each(["REGULAR", "LOST", "RESIGNED"] as const)("routes %s through one versioned transition", async (membershipStatus) => {
    const transition = vi.fn(async () => undefined);
    await persistMembershipStatusWithEnabledClaim("member", membershipStatus, {transition, actorId: "reviewer"});
    expect(transition).toHaveBeenCalledExactlyOnceWith({userId: "member", membershipStatus, actorId: "reviewer", reason: "MEMBERSHIP_STATUS"});
  });
  it("surfaces a partial Auth failure without reversing the database restriction", async () => {
    const failure = new Error("Auth unavailable");
    const transition = vi.fn(async () => {throw failure;});
    await expect(persistMembershipStatusWithEnabledClaim("member", "LOST", {transition})).rejects.toBe(failure);
    expect(transition).toHaveBeenCalledOnce();
  });
});
