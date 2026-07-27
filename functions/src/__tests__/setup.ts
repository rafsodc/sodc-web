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
