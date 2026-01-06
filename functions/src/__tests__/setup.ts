import { vi } from 'vitest';

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
  auth: () => ({
    getUser: vi.fn(),
    listUsers: vi.fn(),
    setCustomUserClaims: vi.fn(),
    updateUser: vi.fn(),
  }),
  initializeApp: vi.fn(),
}));

// Mock firebase-functions
vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

