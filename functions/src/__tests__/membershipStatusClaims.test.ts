import { describe, expect, it, vi } from "vitest";
import { persistMembershipStatusWithEnabledClaim } from "../membershipStatus";
import type { MembershipStatus } from "../validation";

function dependencies(events: string[]) {
  const updateMembershipStatus = vi.fn(
    async (_userId: string, membershipStatus: MembershipStatus) => {
      events.push(`status:${membershipStatus}`);
    }
  );
  const reconcileEnabledClaim = vi.fn(
    async (_userId: string, membershipStatus: MembershipStatus) => {
      events.push(`claim:${membershipStatus}`);
      return {
        enabled: membershipStatus === "REGULAR",
        updated: true,
      };
    }
  );
  return { updateMembershipStatus, reconcileEnabledClaim };
}

describe("persistMembershipStatusWithEnabledClaim", () => {
  it("revokes the claim before persisting a restricted status", async () => {
    const events: string[] = [];
    await persistMembershipStatusWithEnabledClaim(
      "user-1",
      "RESIGNED",
      dependencies(events)
    );

    expect(events).toEqual(["claim:RESIGNED", "status:RESIGNED"]);
  });

  it("persists an active status before granting enabled access", async () => {
    const events: string[] = [];
    await persistMembershipStatusWithEnabledClaim(
      "user-1",
      "REGULAR",
      dependencies(events)
    );

    expect(events).toEqual(["status:REGULAR", "claim:REGULAR"]);
  });

  it("does not persist a restricted status when claim revocation fails", async () => {
    const updateMembershipStatus = vi.fn(
      async (_userId: string, _membershipStatus: MembershipStatus) => undefined
    );
    const failure = new Error("Auth unavailable");
    const reconcileEnabledClaim = vi.fn(async () => {
      throw failure;
    });

    await expect(
      persistMembershipStatusWithEnabledClaim("user-1", "LOST", {
        updateMembershipStatus,
        reconcileEnabledClaim,
      })
    ).rejects.toBe(failure);
    expect(updateMembershipStatus).not.toHaveBeenCalled();
  });

  it("surfaces activation claim failures after the status is persisted", async () => {
    const events: string[] = [];
    const updateMembershipStatus = vi.fn(async () => {
      events.push("status");
    });
    const failure = new Error("Auth unavailable");
    const reconcileEnabledClaim = vi.fn(async () => {
      events.push("claim");
      throw failure;
    });

    await expect(
      persistMembershipStatusWithEnabledClaim("user-1", "REGULAR", {
        updateMembershipStatus,
        reconcileEnabledClaim,
      })
    ).rejects.toBe(failure);
    expect(events).toEqual(["status", "claim"]);
  });
});
