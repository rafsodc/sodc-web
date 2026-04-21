import { describe, it, expect } from 'vitest';
import { ROUTES } from '../routes';
import type { Route } from '../routes';

describe('routes', () => {
  it('should export all route constants', () => {
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.ACCOUNT).toBe('/account');
    expect(ROUTES.PROFILE).toBe('/profile');
    expect(ROUTES.PERMISSIONS).toBe('/admin/permissions');
    expect(ROUTES.MANAGE_USERS).toBe('/admin/users');
    expect(ROUTES.APPROVE_USERS).toBe('/admin/users/approvals');
    expect(ROUTES.REGISTER).toBe('/register');
    expect(ROUTES.PROFILE_COMPLETION).toBe('/profile-completion');
  });

  it('should have Route type that matches route values', () => {
    const routes: Route[] = [
      ROUTES.HOME,
      ROUTES.ACCOUNT,
      ROUTES.PROFILE,
      ROUTES.PERMISSIONS,
      ROUTES.MANAGE_USERS,
      ROUTES.APPROVE_USERS,
      ROUTES.REGISTER,
      ROUTES.PROFILE_COMPLETION,
    ];
    
    routes.forEach((route) => {
      expect(typeof route).toBe('string');
      expect(route.length).toBeGreaterThan(0);
    });
  });
});

