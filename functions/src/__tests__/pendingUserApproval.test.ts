import { describe, expect, it } from "vitest";
import {
  isAwaitingMembershipApproval,
  isUserAwaitingProfile,
  isUserPendingApproval,
} from "../pendingUserApproval";

describe("isAwaitingMembershipApproval", () => {
  it("returns true for PENDING", () => {
    expect(isAwaitingMembershipApproval("PENDING")).toBe(true);
  });

  it("returns true for null and blank legacy values", () => {
    expect(isAwaitingMembershipApproval(null)).toBe(true);
    expect(isAwaitingMembershipApproval(undefined)).toBe(true);
    expect(isAwaitingMembershipApproval("")).toBe(true);
    expect(isAwaitingMembershipApproval("   ")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isAwaitingMembershipApproval("REGULAR")).toBe(false);
    expect(isAwaitingMembershipApproval("LOST")).toBe(false);
  });
});

describe("isUserAwaitingProfile", () => {
  it("returns true when not enabled and no DC profile", () => {
    expect(
      isUserAwaitingProfile({ authEnabled: false, hasDataConnectProfile: false })
    ).toBe(true);
  });

  it("returns false when enabled or profile exists", () => {
    expect(
      isUserAwaitingProfile({ authEnabled: true, hasDataConnectProfile: false })
    ).toBe(false);
    expect(
      isUserAwaitingProfile({ authEnabled: false, hasDataConnectProfile: true })
    ).toBe(false);
  });
});

describe("isUserPendingApproval", () => {
  it("returns true when email verified, not enabled, and status is PENDING", () => {
    expect(
      isUserPendingApproval({
        emailVerified: true,
        authEnabled: false,
        membershipStatus: "PENDING",
      })
    ).toBe(true);
  });

  it("returns true when membership status is blank but otherwise eligible", () => {
    expect(
      isUserPendingApproval({
        emailVerified: true,
        authEnabled: false,
        membershipStatus: null,
      })
    ).toBe(true);
  });

  it("returns false when enabled claim is true", () => {
    expect(
      isUserPendingApproval({
        emailVerified: true,
        authEnabled: true,
        membershipStatus: "PENDING",
      })
    ).toBe(false);
  });

  it("returns false when membership is not awaiting approval", () => {
    expect(
      isUserPendingApproval({
        emailVerified: true,
        authEnabled: false,
        membershipStatus: "LOST",
      })
    ).toBe(false);
  });

  it("returns false when email is not verified", () => {
    expect(
      isUserPendingApproval({
        emailVerified: false,
        authEnabled: false,
        membershipStatus: "PENDING",
      })
    ).toBe(false);
  });
});
