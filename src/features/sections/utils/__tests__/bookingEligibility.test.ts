import { describe, it, expect } from "vitest";
import {
  evaluateBookingGatePreview,
  userMatchesUserGroup,
  userHasBookerPurpose,
} from "../bookingEligibility";
import { MembershipStatus } from "@dataconnect/generated";

describe("bookingEligibility", () => {
  describe("userMatchesUserGroup", () => {
    it("matches explicit group membership", () => {
      const ids = new Set(["g1"]);
      expect(userMatchesUserGroup(MembershipStatus.REGULAR, { id: "g1" }, ids)).toBe(true);
    });

    it("matches by membership status when not explicitly in group", () => {
      const ids = new Set<string>();
      expect(
        userMatchesUserGroup(MembershipStatus.REGULAR, { id: "g1", membershipStatuses: ["REGULAR"] }, ids)
      ).toBe(true);
    });

    it("rejects when neither explicit nor status matches", () => {
      const ids = new Set<string>();
      expect(
        userMatchesUserGroup(MembershipStatus.RESERVE, { id: "g1", membershipStatuses: ["REGULAR"] }, ids)
      ).toBe(false);
    });
  });

  describe("userHasBookerPurpose", () => {
    const links = [
      { purpose: "BOOKER", userGroup: { id: "bg", membershipStatuses: ["REGULAR"] as string[] } },
    ];
    it("is true when user matches a BOOKER link", () => {
      expect(userHasBookerPurpose(links, new Set(), MembershipStatus.REGULAR)).toBe(true);
    });
    it("is false when no BOOKER rows", () => {
      expect(userHasBookerPurpose([], new Set(), MembershipStatus.REGULAR)).toBe(false);
    });
  });

  describe("evaluateBookingGatePreview", () => {
    const window = {
      bookingStartDateTime: "2025-01-01T00:00:00.000Z",
      bookingEndDateTime: "2025-12-31T23:59:59.000Z",
    };

    const baseLinks = [
      { purpose: "ACCESS", userGroup: { id: "ag", membershipStatuses: ["REGULAR"] as string[] } },
      { purpose: "BOOKER", userGroup: { id: "bg", membershipStatuses: ["REGULAR"] as string[] } },
    ];

    it("passes when access, booker, and inside window", () => {
      const r = evaluateBookingGatePreview({
        purposeLinks: baseLinks,
        membershipStatus: MembershipStatus.REGULAR,
        explicitGroupIds: new Set(),
        ...window,
        nowMs: Date.parse("2025-06-01T12:00:00.000Z"),
      });
      expect(r.ok).toBe(true);
    });

    it("fails outside booking window", () => {
      const r = evaluateBookingGatePreview({
        purposeLinks: baseLinks,
        membershipStatus: MembershipStatus.REGULAR,
        explicitGroupIds: new Set(),
        ...window,
        nowMs: Date.parse("2024-06-01T12:00:00.000Z"),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("OUTSIDE_BOOKING_WINDOW");
    });

    it("fails without BOOKER purpose", () => {
      const r = evaluateBookingGatePreview({
        purposeLinks: [{ purpose: "ACCESS", userGroup: { id: "ag", membershipStatuses: ["REGULAR"] } }],
        membershipStatus: MembershipStatus.REGULAR,
        explicitGroupIds: new Set(),
        ...window,
        nowMs: Date.parse("2025-06-01T12:00:00.000Z"),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("NO_BOOKER_PURPOSE");
    });
  });
});
