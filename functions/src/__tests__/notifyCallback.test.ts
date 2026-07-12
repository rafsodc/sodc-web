import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { handleNotifyDelivery, BOUNCE_THRESHOLD } from "../notifyCallback.js";

const mockGetUserByEmail = vi.spyOn(admin, "getUserByEmail");
const mockUpdateEmailBounceStats = vi.spyOn(admin, "updateEmailBounceStats");
const mockUpdateUserMembershipStatus = vi.spyOn(admin, "updateUserMembershipStatus");

const BEARER = "test-bearer-token";

function makeReq(overrides: Partial<{ method: string; headers: Record<string, string>; body: unknown }> = {}): Request {
  return {
    method: "POST",
    headers: { authorization: `Bearer ${BEARER}` },
    body: {
      id: "notify-id-1",
      to: "alice@example.com",
      status: "delivered",
    },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  const res = { status: vi.fn(), send: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
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

describe("handleNotifyDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEmailBounceStats.mockResolvedValue({ data: { user_update: null } } as never);
    mockUpdateUserMembershipStatus.mockResolvedValue({ data: {} } as never);
  });

  it("rejects requests with wrong bearer token", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ headers: { authorization: "Bearer wrong-token" } }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(403);
  });

  it("rejects a same-length wrong bearer token (exercises the timingSafeEqual path, not just the length check)", async () => {
    const wrongSameLength = BEARER.slice(0, -1) + (BEARER.at(-1) === "x" ? "y" : "x");
    expect(wrongSameLength.length).toBe(BEARER.length);
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ headers: { authorization: `Bearer ${wrongSameLength}` } }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(403);
  });

  it("rejects requests with no auth header", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ headers: {} }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(403);
  });

  it("rejects non-POST requests", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ method: "GET" }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(405);
  });

  it("rejects malformed body", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ body: { id: "x" } }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(400);
  });

  it("ignores temporary-failure without updating bounce count", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ body: { id: "x", to: "alice@example.com", status: "temporary-failure" } }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockUpdateEmailBounceStats).not.toHaveBeenCalled();
  });

  it("ignores technical-failure without updating bounce count", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ body: { id: "x", to: "alice@example.com", status: "technical-failure" } }), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 200 when no user is found for the email", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [] } } as never);
    const res = makeRes();
    await handleNotifyDelivery(makeReq(), res, BEARER);
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
    expect(mockUpdateEmailBounceStats).not.toHaveBeenCalled();
  });

  it("resets bounce count to 0 on delivery success", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 2 })] } } as never);
    const res = makeRes();
    await handleNotifyDelivery(makeReq(), res, BEARER);
    expect(mockUpdateEmailBounceStats).toHaveBeenCalledWith({
      userId: "user-abc",
      emailBounceCount: 0,
      emailLastBounceAt: null,
    });
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });

  it("skips reset if bounce count is already 0 on delivery", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 0 })] } } as never);
    const res = makeRes();
    await handleNotifyDelivery(makeReq(), res, BEARER);
    expect(mockUpdateEmailBounceStats).not.toHaveBeenCalled();
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });

  it("increments bounce count on permanent-failure below threshold", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: 1 })] } } as never);
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ body: { id: "x", to: "alice@example.com", status: "permanent-failure" } }), res, BEARER);
    expect(mockUpdateEmailBounceStats).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-abc", emailBounceCount: 2 })
    );
    expect(mockUpdateUserMembershipStatus).not.toHaveBeenCalled();
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });

  it(`sets membership to LOST when bounce count reaches threshold (${BOUNCE_THRESHOLD})`, async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { users: [makeUser({ emailBounceCount: BOUNCE_THRESHOLD - 1 })] } } as never);
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ body: { id: "x", to: "alice@example.com", status: "permanent-failure" } }), res, BEARER);
    expect(mockUpdateEmailBounceStats).toHaveBeenCalledWith(
      expect.objectContaining({ emailBounceCount: BOUNCE_THRESHOLD })
    );
    expect(mockUpdateUserMembershipStatus).toHaveBeenCalledWith({
      userId: "user-abc",
      membershipStatus: MembershipStatus.LOST,
    });
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });

  it("does not set LOST again if already LOST", async () => {
    mockGetUserByEmail.mockResolvedValue({
      data: { users: [makeUser({ emailBounceCount: 5, membershipStatus: MembershipStatus.LOST })] },
    } as never);
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ body: { id: "x", to: "alice@example.com", status: "permanent-failure" } }), res, BEARER);
    expect(mockUpdateUserMembershipStatus).not.toHaveBeenCalled();
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(200);
  });
});
