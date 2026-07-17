import { describe, it, expect } from "vitest";
import {
  isRestrictedStatus,
  isBlankMembershipStatus,
  isActivationBlockedStatus,
  canUserChangeStatus,
  canUserResignMembership,
  NON_RESTRICTED_STATUSES,
  RESTRICTED_STATUSES,
} from "../validation";

describe("validation", () => {
  describe("isRestrictedStatus", () => {
    it("should return true for restricted statuses", () => {
      expect(isRestrictedStatus("PENDING")).toBe(true);
      expect(isRestrictedStatus("RESIGNED")).toBe(true);
      expect(isRestrictedStatus("LOST")).toBe(true);
      expect(isRestrictedStatus("DECEASED")).toBe(true);
    });

    it("should return false for non-restricted statuses", () => {
      expect(isRestrictedStatus("REGULAR")).toBe(false);
      expect(isRestrictedStatus("RETIRED")).toBe(false);
      expect(isRestrictedStatus("RESERVE")).toBe(false);
      expect(isRestrictedStatus("INDUSTRY")).toBe(false);
      expect(isRestrictedStatus("CIVIL_SERVICE")).toBe(false);
    });
  });

  describe("isBlankMembershipStatus", () => {
    it("treats null, undefined, and blank as blank", () => {
      expect(isBlankMembershipStatus(null)).toBe(true);
      expect(isBlankMembershipStatus(undefined)).toBe(true);
      expect(isBlankMembershipStatus("")).toBe(true);
      expect(isBlankMembershipStatus("   ")).toBe(true);
      expect(isBlankMembershipStatus("REGULAR")).toBe(false);
    });
  });

  describe("isActivationBlockedStatus", () => {
    it("blocks PENDING, blank, and null", () => {
      expect(isActivationBlockedStatus("PENDING")).toBe(true);
      expect(isActivationBlockedStatus(null)).toBe(true);
      expect(isActivationBlockedStatus("")).toBe(true);
      expect(isActivationBlockedStatus("REGULAR")).toBe(false);
    });
  });

  describe("NON_RESTRICTED_STATUSES", () => {
    it("should contain all non-restricted statuses", () => {
      expect(NON_RESTRICTED_STATUSES).toContain("REGULAR");
      expect(NON_RESTRICTED_STATUSES).toContain("RETIRED");
      expect(NON_RESTRICTED_STATUSES).toContain("RESERVE");
      expect(NON_RESTRICTED_STATUSES).toContain("INDUSTRY");
      expect(NON_RESTRICTED_STATUSES).toContain("CIVIL_SERVICE");
    });
  });

  describe("RESTRICTED_STATUSES", () => {
    it("should contain all restricted statuses", () => {
      expect(RESTRICTED_STATUSES).toContain("PENDING");
      expect(RESTRICTED_STATUSES).toContain("RESIGNED");
      expect(RESTRICTED_STATUSES).toContain("LOST");
      expect(RESTRICTED_STATUSES).toContain("DECEASED");
    });
  });

  describe("canUserChangeStatus", () => {
    describe("admin permissions", () => {
      it("should allow admin to change any status", () => {
        const result = canUserChangeStatus("PENDING", "REGULAR", true);
        expect(result.allowed).toBe(true);
      });

      it("should allow admin activation from null without caller enabled", () => {
        const result = canUserChangeStatus(null, "REGULAR", true, false, false);
        expect(result.allowed).toBe(true);
      });

      it("should not allow admin to set another admin to restricted status", () => {
        const result = canUserChangeStatus("REGULAR", "PENDING", true, true);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Admins cannot have restricted membership statuses");
      });
    });

    describe("regular user permissions", () => {
      it("should allow enabled user to change between non-restricted statuses", () => {
        const result = canUserChangeStatus("REGULAR", "RETIRED", false, false, true);
        expect(result.allowed).toBe(true);
      });

      it("should reject when caller is not enabled", () => {
        const result = canUserChangeStatus("REGULAR", "RETIRED", false, false, false);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Account must be enabled");
      });

      it("should not allow user to change from PENDING", () => {
        const result = canUserChangeStatus("PENDING", "REGULAR", false, false, true);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Cannot change from restricted status");
      });

      it("should not allow user to self-activate from null status", () => {
        const result = canUserChangeStatus(null, "REGULAR", false, false, true);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Cannot change from restricted status");
      });

      it("should not allow user to self-activate from blank legacy status", () => {
        const result = canUserChangeStatus("", "REGULAR", false, false, true);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Cannot change from restricted status");
      });

      it("should not allow user to change to restricted status", () => {
        const result = canUserChangeStatus("REGULAR", "PENDING", false, false, true);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Cannot change to restricted status");
      });
    });
  });

  describe("canUserResignMembership", () => {
    it("allows enabled non-admin member with non-restricted status to resign", () => {
      const result = canUserResignMembership("REGULAR", false, true);
      expect(result.allowed).toBe(true);
    });

    it("rejects when caller is not enabled", () => {
      const result = canUserResignMembership("REGULAR", false, false);
      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Account must be enabled");
    });

    it("rejects admin accounts", () => {
      const result = canUserResignMembership("REGULAR", true, true);
      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Admin accounts cannot resign through this flow");
    });

    it("rejects restricted current statuses", () => {
      expect(canUserResignMembership("PENDING", false, true).allowed).toBe(false);
      expect(canUserResignMembership("RESIGNED", false, true).allowed).toBe(false);
      expect(canUserResignMembership(null, false, true).allowed).toBe(false);
    });
  });
});
