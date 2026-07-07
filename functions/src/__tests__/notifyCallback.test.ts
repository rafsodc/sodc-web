import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import { Request, Response } from "firebase-functions/v2/https";

// Mock secrets before importing the module under test
vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn().mockReturnValue({
    value: vi.fn().mockReturnValue("test-bearer-token"),
  }),
}));

// Mock the Cloud Function framework so onRequest returns the handler directly
vi.mock("firebase-functions/v2/https", () => ({
  onRequest: vi.fn().mockImplementation((_opts: unknown, handler: unknown) => handler),
}));

const mockGetUserByEmail = vi.spyOn(admin, "getUserByEmail");
const mockUpdateEmailBounceStats = vi.spyOn(admin, "updateEmailBounceStats");
const mockUpdateUserMembershipStatus = vi.spyOn(admin, "updateUserMembershipStatus");

// Import after mocks are in place
const { notifyDeliveryCallback } = await import("../notifyCallback");

type Handler = (req: Partial<Request>, res: Partial<Response>) => Promise<void>;
const handler = notifyDeliveryCallback as unknown as Handler;

function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: "POST",
    headers: { authorization: "Bearer test-bearer-token" },
    body: {
      id: "notify-id-1",
      to: "alice@example.com",
      status: "delivered",
    },
    ...overrides,
  };
}

function makeRes(): { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; statusCode?: number; body?: string } {
  const res = { status: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function makeUser(overrides: Partial<{ id: string; membershipStatus: MembershipStatus; emailBounceCount: number }> = {}) {
  return {
    id: "user-abc",
    membershipStatus: MembershipStatus.REGULAR,
    emailBounceCount: 0,
    ...overrides,
  };
}

describe("notifyDeliveryCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEmailBounceStats.mockResolvedValue({ data: { user_update: null } } as never);
    mockUpdateUserMembershipStatus.mockResolvedValue({ data: {} } as never);
  });

  it("rejects requests with wrong bearer token", async () => {
    const res = makeRes();
    await handler(makeReq({ headers: { authorization: "Bearer wrong-token" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects requests with no auth header", async () => {
    const res = makeRes();
    await handler(makeReq({ headers: {} }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects non-POST requests", async () => {
    const res = makeRes();
    await handler(makeReq({ method: "GET" }), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("rejects malformed body", async () => {
    const res = makeRes();
    await handler(makeReq({ body: { id: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("ignores temporary-failure without updating bounce count", async () => {
    const res = makeRes();
    await handler(makeReq({ body: { id: "x", to: "alice@example.com", status: "temporary-failure" } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockUpdateEmailBounceStats).not.toHaveBeenCalled();
  });

  it("ignores technical-failure without updating bounce count", async () => {
    const res = makeRes();
    await handler(makeReq({ body: { id: "x", to: "alice@example.com", status: "technical-failure" } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 200 when no user is found for the email", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [] } } as never);
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockUpdateEmailBounceStats).not.toHaveBeenCalled();
  });

  it("resets bounce count to 0 on delivery success", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 2 })] } } as never);
    const res = makeRes();
    await handler(makeReq(), res);
    expect(mockUpdateEmailBounceStats).toHaveBeenCalledWith({
      userId: "user-abc",
      emailBounceCount: 0,
      emailLastBounceAt: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("skips reset if bounce count is already 0 on delivery", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 0 })] } } as never);
    const res = makeRes();
    await handler(makeReq(), res);
    expect(mockUpdateEmailBounceStats).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("increments bounce count on permanent-failure", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 1 })] } } as never);
    const res = makeRes();
    await handler(makeReq({ body: { id: "x", to: "alice@example.com", status: "permanent-failure" } }), res);
    expect(mockUpdateEmailBounceStats).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-abc", emailBounceCount: 2 })
    );
    expect(mockUpdateUserMembershipStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("sets membership to LOST when bounce threshold is reached", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 2 })] } } as never);
    const res = makeRes();
    await handler(makeReq({ body: { id: "x", to: "alice@example.com", status: "permanent-failure" } }), res);
    expect(mockUpdateEmailBounceStats).toHaveBeenCalledWith(
      expect.objectContaining({ emailBounceCount: 3 })
    );
    expect(mockUpdateUserMembershipStatus).toHaveBeenCalledWith({
      userId: "user-abc",
      membershipStatus: MembershipStatus.LOST,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not set LOST again if already LOST", async () => {
    mockGetUserByEmail.mockResolvedValue({
      data: { users: [makeUser({ emailBounceCount: 5, membershipStatus: MembershipStatus.LOST })] },
    } as never);
    const res = makeRes();
    await handler(makeReq({ body: { id: "x", to: "alice@example.com", status: "permanent-failure" } }), res);
    expect(mockUpdateUserMembershipStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
