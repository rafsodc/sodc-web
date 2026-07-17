import { describe, it, expect, vi, beforeEach } from "vitest";
import { MembershipStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import * as helpers from "../helpers.js";

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn().mockImplementation((_opts: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockDcListUsers = vi.spyOn(admin, "listUsers");
const mockListAllAuthUsers = vi.spyOn(helpers, "listAllAuthUsers");
const mockGetCallableInvocation = vi.spyOn(admin, "getCallableInvocation");
const mockUpsertCallableInvocation = vi.spyOn(admin, "upsertCallableInvocation");

import { searchUsers, invalidateDcProfileCache } from "../users.js";

type Handler = (req: {
  auth: { uid: string; token?: Record<string, unknown> };
  data: Record<string, unknown>;
}) => Promise<unknown>;
const handler = searchUsers as unknown as Handler;

function adminRequest(data: Record<string, unknown> = {}) {
  return {
    auth: { uid: "admin-uid", token: { admin: true, enabled: true } },
    data: { searchTerm: "alice", ...data },
  };
}

function makeAuthUser(uid: string, email: string) {
  return {
    uid,
    email,
    displayName: email.split("@")[0],
    emailVerified: true,
    disabled: false,
    metadata: { creationTime: "2024-01-01T00:00:00Z", lastSignInTime: null },
    customClaims: { admin: false },
  } as unknown as import("firebase-admin").auth.UserRecord;
}

describe("searchUsers — membership status enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateDcProfileCache();
    mockGetCallableInvocation.mockResolvedValue({ data: { callableInvocation: undefined } } as never);
    mockUpsertCallableInvocation.mockResolvedValue({
      data: { callableInvocation_upsert: { userId: "admin-uid", functionName: "searchUsers" } },
    } as never);
  });

  it("attaches membershipStatus from DC profile when user has a profile", async () => {
    mockListAllAuthUsers.mockResolvedValue([makeAuthUser("user-1", "alice@example.com")]);
    mockDcListUsers.mockResolvedValue({
      data: { users: [{ id: "user-1", membershipStatus: MembershipStatus.REGULAR }] },
    } as never);

    const result = await handler(adminRequest()) as {
      users: { uid: string; membershipStatus: MembershipStatus | null }[];
    };

    expect(result.users[0].membershipStatus).toBe(MembershipStatus.REGULAR);
  });

  it("sets membershipStatus to null when user has no DC profile", async () => {
    mockListAllAuthUsers.mockResolvedValue([makeAuthUser("user-2", "alice@example.com")]);
    mockDcListUsers.mockResolvedValue({ data: { users: [] } } as never);

    const result = await handler(adminRequest()) as {
      users: { uid: string; membershipStatus: MembershipStatus | null }[];
    };

    expect(result.users[0].membershipStatus).toBeNull();
  });

  it("fetches DC profiles concurrently with Auth users", async () => {
    mockListAllAuthUsers.mockResolvedValue([]);
    mockDcListUsers.mockResolvedValue({ data: { users: [] } } as never);

    await handler(adminRequest({ searchTerm: "x" }));

    expect(mockDcListUsers).toHaveBeenCalledTimes(1);
    expect(mockListAllAuthUsers).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch DC profiles on a second search within the TTL", async () => {
    mockListAllAuthUsers.mockResolvedValue([makeAuthUser("user-1", "alice@example.com")]);
    mockDcListUsers.mockResolvedValue({ data: { users: [] } } as never);

    await handler(adminRequest());
    await handler(adminRequest());

    expect(mockDcListUsers).toHaveBeenCalledTimes(1);
  });

  it("re-fetches DC profiles after invalidateDcProfileCache, even within the TTL (see #321)", async () => {
    mockListAllAuthUsers.mockResolvedValue([makeAuthUser("user-1", "alice@example.com")]);
    mockDcListUsers.mockResolvedValue({ data: { users: [] } } as never);

    await handler(adminRequest());
    invalidateDcProfileCache();
    await handler(adminRequest());

    expect(mockDcListUsers).toHaveBeenCalledTimes(2);
  });

  it("only includes users matching the search term", async () => {
    mockListAllAuthUsers.mockResolvedValue([
      makeAuthUser("user-1", "alice@example.com"),
      makeAuthUser("user-2", "bob@example.com"),
    ]);
    mockDcListUsers.mockResolvedValue({ data: { users: [] } } as never);

    const result = await handler(adminRequest({ searchTerm: "alice" })) as {
      users: { uid: string }[];
      total: number;
    };

    expect(result.total).toBe(1);
    expect(result.users[0].uid).toBe("user-1");
  });
});
