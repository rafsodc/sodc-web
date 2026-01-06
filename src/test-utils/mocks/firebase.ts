import { vi } from 'vitest';
import type { User } from 'firebase/auth';

/**
 * Firebase Auth mocks
 */
export const createMockUser = (overrides?: Partial<User>): User => {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    emailVerified: true,
    displayName: 'Test User',
    photoURL: null,
    phoneNumber: null,
    isAnonymous: false,
    metadata: {
      creationTime: '2024-01-01T00:00:00Z',
      lastSignInTime: '2024-01-01T00:00:00Z',
    },
    providerData: [],
    refreshToken: 'mock-refresh-token',
    tenantId: null,
    delete: vi.fn(),
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    getIdTokenResult: vi.fn().mockResolvedValue({
      token: 'mock-token',
      expirationTime: '2024-12-31T23:59:59Z',
      issuedAtTime: '2024-01-01T00:00:00Z',
      signInProvider: 'password',
      signInSecondFactor: null,
      claims: {
        admin: false,
        enabled: true,
      },
    }),
    reload: vi.fn().mockResolvedValue(undefined),
    toJSON: vi.fn(),
    ...overrides,
  } as User;
};

export const mockAuth = {
  currentUser: null as User | null,
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  reload: vi.fn(),
};

