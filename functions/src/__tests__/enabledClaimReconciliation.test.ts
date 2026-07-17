import { describe, expect, it, vi } from "vitest";
import {
  enabledClaimForMembershipStatus,
  reconcileEnabledClaim,
  type EnabledClaimAuthClient,
} from "../enabledClaimReconciliation";
import type { MembershipStatus } from "../validation";

function authClient(args: {
  customClaims?: Record<string, unknown>;
  setError?: Error;
} = {}) {
  const getUser = vi.fn(async () => ({ customClaims: args.customClaims }));
  const setCustomUserClaims = vi.fn(async () => {
    if (args.setError) throw args.setError;
  });
  return {
    client: { getUser, setCustomUserClaims } satisfies EnabledClaimAuthClient,
    getUser,
    setCustomUserClaims,
  };
}

describe("enabledClaimForMembershipStatus", () => {
  it.each<MembershipStatus>([
    "REGULAR",
    "RETIRED",
    "RESERVE",
    "INDUSTRY",
    "CIVIL_SERVICE",
  ])("enables non-restricted status %s", (membershipStatus) => {
    expect(enabledClaimForMembershipStatus(membershipStatus)).toBe(true);
  });

  it.each<MembershipStatus>(["PENDING", "RESIGNED", "LOST", "DECEASED"])(
    "disables restricted status %s",
    (membershipStatus) => {
      expect(enabledClaimForMembershipStatus(membershipStatus)).toBe(false);
    }
  );
});

describe("reconcileEnabledClaim", () => {
  it("preserves existing claims while enabling a non-restricted member", async () => {
    const auth = authClient({ customClaims: { admin: false, role: "moderator" } });

    const result = await reconcileEnabledClaim("user-1", "REGULAR", auth.client);

    expect(result).toEqual({ enabled: true, updated: true });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("user-1", {
      admin: false,
      role: "moderator",
      enabled: true,
    });
  });

  it("disables a restricted member even when the admin claim is present", async () => {
    const auth = authClient({ customClaims: { admin: true, enabled: true } });

    const result = await reconcileEnabledClaim("admin-1", "LOST", auth.client);

    expect(result).toEqual({ enabled: false, updated: true });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith("admin-1", {
      admin: true,
      enabled: false,
    });
  });

  it("does not rewrite claims that already match the membership status", async () => {
    const auth = authClient({ customClaims: { enabled: false, other: "kept" } });

    const result = await reconcileEnabledClaim("user-1", "RESIGNED", auth.client);

    expect(result).toEqual({ enabled: false, updated: false });
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("surfaces Firebase Auth claim-write failures", async () => {
    const failure = new Error("Auth unavailable");
    const auth = authClient({ customClaims: { enabled: true }, setError: failure });

    await expect(
      reconcileEnabledClaim("user-1", "DECEASED", auth.client)
    ).rejects.toBe(failure);
  });
});
