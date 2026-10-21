import { vi } from "vitest";

process.env.GOV_NOTIFY_DELIVERY_MODE = "LIVE";

// Mock firebase-admin
vi.mock("firebase-admin", () => ({
  auth: () => ({
    getUser: vi.fn(),
    listUsers: vi.fn(),
    setCustomUserClaims: vi.fn(),
    updateUser: vi.fn(),
  }),
  initializeApp: vi.fn(),
}));

// Mock firebase-functions
vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Domain unit tests use explicit versioned identities. Boundary tests override this repository.
vi.mock("../securityRepository", () => ({
  getUserSecurityState: vi.fn(async ({userId}: {userId: string}) => ({ data: { userSecurityState: {
    userId, securityVersion: 1, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: false,
    accessReady: true, adminReady: true, operationId: "test-operation", syncStatus: "READY",
    user: { membershipStatus: "REGULAR" },
  } } })),
  getSecurityTransition: vi.fn(async () => ({data: {securityTransition: null}})),
  initializeUserSecurityState: vi.fn(), beginSecurityTransition: vi.fn(), completeSecurityTransition: vi.fn(),
  recordSecuritySynchronizationFailure: vi.fn(), listPendingSecurityTransitions: vi.fn(), supersedeSecurityTransition: vi.fn(),
}));
