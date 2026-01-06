import { describe, it, expect } from 'vitest';
import {
  isRestrictedStatus,
  NON_RESTRICTED_STATUSES,
  RESTRICTED_STATUSES,
  canUserChangeStatus,
} from '../membershipStatusValidation';
import { MembershipStatus } from '../../../../dataconnect-generated';

describe('membershipStatusValidation', () => {
  describe('isRestrictedStatus', () => {
    it('should return true for PENDING', () => {
      expect(isRestrictedStatus(MembershipStatus.PENDING)).toBe(true);
    });

    it('should return true for RESIGNED', () => {
      expect(isRestrictedStatus(MembershipStatus.RESIGNED)).toBe(true);
    });

    it('should return true for LOST', () => {
      expect(isRestrictedStatus(MembershipStatus.LOST)).toBe(true);
    });

    it('should return true for DECEASED', () => {
      expect(isRestrictedStatus(MembershipStatus.DECEASED)).toBe(true);
    });

    it('should return false for REGULAR', () => {
      expect(isRestrictedStatus(MembershipStatus.REGULAR)).toBe(false);
    });

    it('should return false for RETIRED', () => {
      expect(isRestrictedStatus(MembershipStatus.RETIRED)).toBe(false);
    });

    it('should return false for RESERVE', () => {
      expect(isRestrictedStatus(MembershipStatus.RESERVE)).toBe(false);
    });

    it('should return false for INDUSTRY', () => {
      expect(isRestrictedStatus(MembershipStatus.INDUSTRY)).toBe(false);
    });

    it('should return false for CIVIL_SERVICE', () => {
      expect(isRestrictedStatus(MembershipStatus.CIVIL_SERVICE)).toBe(false);
    });
  });

  describe('NON_RESTRICTED_STATUSES', () => {
    it('should contain all non-restricted statuses', () => {
      expect(NON_RESTRICTED_STATUSES).toContain(MembershipStatus.REGULAR);
      expect(NON_RESTRICTED_STATUSES).toContain(MembershipStatus.RETIRED);
      expect(NON_RESTRICTED_STATUSES).toContain(MembershipStatus.RESERVE);
      expect(NON_RESTRICTED_STATUSES).toContain(MembershipStatus.INDUSTRY);
      expect(NON_RESTRICTED_STATUSES).toContain(MembershipStatus.CIVIL_SERVICE);
    });

    it('should not contain restricted statuses', () => {
      expect(NON_RESTRICTED_STATUSES).not.toContain(MembershipStatus.PENDING);
      expect(NON_RESTRICTED_STATUSES).not.toContain(MembershipStatus.RESIGNED);
      expect(NON_RESTRICTED_STATUSES).not.toContain(MembershipStatus.LOST);
      expect(NON_RESTRICTED_STATUSES).not.toContain(MembershipStatus.DECEASED);
    });
  });

  describe('RESTRICTED_STATUSES', () => {
    it('should contain all restricted statuses', () => {
      expect(RESTRICTED_STATUSES).toContain(MembershipStatus.PENDING);
      expect(RESTRICTED_STATUSES).toContain(MembershipStatus.RESIGNED);
      expect(RESTRICTED_STATUSES).toContain(MembershipStatus.LOST);
      expect(RESTRICTED_STATUSES).toContain(MembershipStatus.DECEASED);
    });

    it('should not contain non-restricted statuses', () => {
      expect(RESTRICTED_STATUSES).not.toContain(MembershipStatus.REGULAR);
      expect(RESTRICTED_STATUSES).not.toContain(MembershipStatus.RETIRED);
      expect(RESTRICTED_STATUSES).not.toContain(MembershipStatus.RESERVE);
      expect(RESTRICTED_STATUSES).not.toContain(MembershipStatus.INDUSTRY);
      expect(RESTRICTED_STATUSES).not.toContain(MembershipStatus.CIVIL_SERVICE);
    });
  });

  describe('canUserChangeStatus', () => {
    describe('admin permissions', () => {
      it('should allow admin to change any status to any status', () => {
        const result = canUserChangeStatus(
          MembershipStatus.PENDING,
          MembershipStatus.REGULAR,
          true
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow admin to change from restricted to non-restricted', () => {
        const result = canUserChangeStatus(
          MembershipStatus.RESIGNED,
          MembershipStatus.RETIRED,
          true
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow admin to change from non-restricted to restricted', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.RESIGNED,
          true
        );
        expect(result.allowed).toBe(true);
      });

      it('should not allow admin to set another admin to restricted status', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.PENDING,
          true,
          true // targetUserIsAdmin
        );
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Admins cannot have restricted membership statuses');
      });

      it('should allow admin to set another admin to non-restricted status', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.RETIRED,
          true,
          true // targetUserIsAdmin
        );
        expect(result.allowed).toBe(true);
      });
    });

    describe('regular user permissions', () => {
      it('should allow user to change between non-restricted statuses', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.RETIRED,
          false
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow user to change from REGULAR to RESERVE', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.RESERVE,
          false
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow user to change from RETIRED to INDUSTRY', () => {
        const result = canUserChangeStatus(
          MembershipStatus.RETIRED,
          MembershipStatus.INDUSTRY,
          false
        );
        expect(result.allowed).toBe(true);
      });

      it('should not allow user to change from restricted status', () => {
        const result = canUserChangeStatus(
          MembershipStatus.PENDING,
          MembershipStatus.REGULAR,
          false
        );
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change from restricted status');
      });

      it('should not allow user to change from RESIGNED', () => {
        const result = canUserChangeStatus(
          MembershipStatus.RESIGNED,
          MembershipStatus.REGULAR,
          false
        );
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change from restricted status');
      });

      it('should not allow user to change to restricted status', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.PENDING,
          false
        );
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change to restricted status');
      });

      it('should not allow user to change to RESIGNED', () => {
        const result = canUserChangeStatus(
          MembershipStatus.REGULAR,
          MembershipStatus.RESIGNED,
          false
        );
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change to restricted status');
      });

      it('should allow new user (null current status) to set non-restricted status', () => {
        const result = canUserChangeStatus(
          null,
          MembershipStatus.REGULAR,
          false
        );
        expect(result.allowed).toBe(true);
      });

      it('should not allow new user (null current status) to set restricted status', () => {
        const result = canUserChangeStatus(
          null,
          MembershipStatus.PENDING,
          false
        );
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change to restricted status');
      });
    });
  });
});

