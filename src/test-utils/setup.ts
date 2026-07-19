import '@testing-library/jest-dom';
import { vi } from 'vitest';

// JSDOM doesn't implement matchMedia; MUI's useMediaQuery (used by ColorModeProvider to detect
// the system color-scheme preference) needs it on every render.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Firebase Auth
vi.mock('../config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    verifyPasswordResetCode: vi.fn(),
    confirmPasswordReset: vi.fn(),
    reload: vi.fn(),
  },
  dataConnect: {},
  firebaseApp: {},
}));

// Mock Firebase Data Connect
vi.mock('firebase/data-connect', () => ({
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
  queryRef: vi.fn(),
  mutationRef: vi.fn(),
}));

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));
