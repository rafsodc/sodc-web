import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase Auth
vi.mock('../config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
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

