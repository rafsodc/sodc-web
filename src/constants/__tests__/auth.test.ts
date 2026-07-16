import { describe, it, expect } from 'vitest';
import {
  AUTH_EXPRESSIONS,
  FIREBASE_MIN_PASSWORD_LENGTH,
  REGISTRATION_MIN_PASSWORD_LENGTH,
  type AuthExpression,
} from '../auth';

describe('auth constants', () => {
  it('should export password length constants for onboarding', () => {
    expect(FIREBASE_MIN_PASSWORD_LENGTH).toBe(6);
    expect(REGISTRATION_MIN_PASSWORD_LENGTH).toBe(12);
  });
  it('should export USER_ACCESS expression', () => {
    expect(AUTH_EXPRESSIONS.USER_ACCESS).toBe('auth.token.enabled == true');
  });

  it('should export ADMIN_ACCESS expression', () => {
    expect(AUTH_EXPRESSIONS.ADMIN_ACCESS).toBe('auth.token.admin == true && auth.token.enabled == true');
  });

  it('should export NO_ACCESS constant', () => {
    expect(AUTH_EXPRESSIONS.NO_ACCESS).toBe('NO_ACCESS');
  });

  it('should have AuthExpression type that matches expression values', () => {
    const expressions: AuthExpression[] = [
      AUTH_EXPRESSIONS.USER_ACCESS,
      AUTH_EXPRESSIONS.ADMIN_ACCESS,
      AUTH_EXPRESSIONS.NO_ACCESS,
    ];
    
    expressions.forEach((expr) => {
      expect(typeof expr).toBe('string');
      expect(expr.length).toBeGreaterThan(0);
    });
  });
});

