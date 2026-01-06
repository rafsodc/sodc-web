import { describe, it, expect } from 'vitest';
import { parseDisplayName, validateUserForm } from '../userHelpers';

describe('userHelpers', () => {
  describe('parseDisplayName', () => {
    it('should parse "LastName, FirstName" format', () => {
      const result = parseDisplayName('Doe, John');
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should parse "FirstName LastName" format', () => {
      const result = parseDisplayName('John Doe');
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should handle single name', () => {
      const result = parseDisplayName('John');
      expect(result).toEqual({
        firstName: 'John',
        lastName: '',
      });
    });

    it('should handle multiple last names', () => {
      const result = parseDisplayName('John van der Berg');
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'van der Berg',
      });
    });

    it('should return empty strings for undefined input', () => {
      const result = parseDisplayName(undefined);
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });

    it('should return empty strings for empty string input', () => {
      const result = parseDisplayName('');
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });

    it('should handle "LastName, FirstName MiddleName" format', () => {
      const result = parseDisplayName('Doe, John Michael');
      expect(result).toEqual({
        firstName: 'John Michael',
        lastName: 'Doe',
      });
    });
  });

  describe('validateUserForm', () => {
    it('should validate a correct form', () => {
      const result = validateUserForm('John', 'Doe', 'john@example.com', 'SN123456');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty first name', () => {
      const result = validateUserForm('', 'Doe', 'john@example.com', 'SN123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('First name is required');
    });

    it('should reject whitespace-only first name', () => {
      const result = validateUserForm('   ', 'Doe', 'john@example.com', 'SN123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('First name is required');
    });

    it('should reject empty last name', () => {
      const result = validateUserForm('John', '', 'john@example.com', 'SN123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Last name is required');
    });

    it('should reject empty email', () => {
      const result = validateUserForm('John', 'Doe', '', 'SN123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject invalid email format', () => {
      const result = validateUserForm('John', 'Doe', 'invalid-email', 'SN123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject email without domain', () => {
      const result = validateUserForm('John', 'Doe', 'john@', 'SN123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'john@example.com',
        'john.doe@example.co.uk',
        'john+tag@example.com',
      ];

      validEmails.forEach((email) => {
        const result = validateUserForm('John', 'Doe', email, 'SN123456');
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject empty service number', () => {
      const result = validateUserForm('John', 'Doe', 'john@example.com', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Service number is required');
    });

    it('should trim whitespace from email before validation', () => {
      const result = validateUserForm('John', 'Doe', '  john@example.com  ', 'SN123456');
      expect(result.isValid).toBe(true);
    });
  });
});

