import { describe, it, expect } from 'vitest';
import {
  isRestrictedStatus,
  canUserChangeStatus,
  NON_RESTRICTED_STATUSES,
  RESTRICTED_STATUSES,
} from '../validation';

describe('validation', () => {
  describe('isRestrictedStatus', () => {
    it('should return true for restricted statuses', () => {
      expect(isRestrictedStatus('PENDING')).toBe(true);
      expect(isRestrictedStatus('RESIGNED')).toBe(true);
      expect(isRestrictedStatus('LOST')).toBe(true);
      expect(isRestrictedStatus('DECEASED')).toBe(true);
    });

    it('should return false for non-restricted statuses', () => {
      expect(isRestrictedStatus('REGULAR')).toBe(false);
      expect(isRestrictedStatus('RETIRED')).toBe(false);
      expect(isRestrictedStatus('RESERVE')).toBe(false);
      expect(isRestrictedStatus('INDUSTRY')).toBe(false);
      expect(isRestrictedStatus('CIVIL_SERVICE')).toBe(false);
    });
  });

  describe('NON_RESTRICTED_STATUSES', () => {
    it('should contain all non-restricted statuses', () => {
      expect(NON_RESTRICTED_STATUSES).toContain('REGULAR');
      expect(NON_RESTRICTED_STATUSES).toContain('RETIRED');
      expect(NON_RESTRICTED_STATUSES).toContain('RESERVE');
      expect(NON_RESTRICTED_STATUSES).toContain('INDUSTRY');
      expect(NON_RESTRICTED_STATUSES).toContain('CIVIL_SERVICE');
    });
  });

  describe('RESTRICTED_STATUSES', () => {
    it('should contain all restricted statuses', () => {
      expect(RESTRICTED_STATUSES).toContain('PENDING');
      expect(RESTRICTED_STATUSES).toContain('RESIGNED');
      expect(RESTRICTED_STATUSES).toContain('LOST');
      expect(RESTRICTED_STATUSES).toContain('DECEASED');
    });
  });

  describe('canUserChangeStatus', () => {
    describe('admin permissions', () => {
      it('should allow admin to change any status', () => {
        const result = canUserChangeStatus('PENDING', 'REGULAR', true);
        expect(result.allowed).toBe(true);
      });

      it('should not allow admin to set another admin to restricted status', () => {
        const result = canUserChangeStatus('REGULAR', 'PENDING', true, true);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Admins cannot have restricted membership statuses');
      });
    });

    describe('regular user permissions', () => {
      it('should allow user to change between non-restricted statuses', () => {
        const result = canUserChangeStatus('REGULAR', 'RETIRED', false);
        expect(result.allowed).toBe(true);
      });

      it('should not allow user to change from restricted status', () => {
        const result = canUserChangeStatus('PENDING', 'REGULAR', false);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change from restricted status');
      });

      it('should not allow user to change to restricted status', () => {
        const result = canUserChangeStatus('REGULAR', 'PENDING', false);
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Cannot change to restricted status');
      });
    });
  });
});

