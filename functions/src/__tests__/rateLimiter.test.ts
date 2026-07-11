import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { enforceRateLimit } from "../rateLimiter";

const mockGetCallableInvocation = vi.spyOn(admin, "getCallableInvocation");
const mockUpsertCallableInvocation = vi.spyOn(admin, "upsertCallableInvocation");

const uid = "user-1";
const fn = "testFunction";
const windowMs = 60 * 60 * 1000; // 1 hour

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertCallableInvocation.mockResolvedValue({
      data: { callableInvocation_upsert: { userId: uid, functionName: fn } },
    } as never);
  });

  it("allows the first call and records count 1", async () => {
    mockGetCallableInvocation.mockResolvedValue({ data: { callableInvocation: undefined } } as never);

    await enforceRateLimit(fn, uid, { limit: 3, windowMs });

    expect(mockUpsertCallableInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: uid, functionName: fn, count: 1 })
    );
  });

  it("allows a subsequent call within the same window while under the limit", async () => {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
    mockGetCallableInvocation.mockResolvedValue({
      data: { callableInvocation: { windowStart, count: 2 } },
    } as never);

    await enforceRateLimit(fn, uid, { limit: 3, windowMs });

    expect(mockUpsertCallableInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3 })
    );
  });

  it("rejects once the limit is reached within the current window", async () => {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
    mockGetCallableInvocation.mockResolvedValue({
      data: { callableInvocation: { windowStart, count: 3 } },
    } as never);

    await expect(enforceRateLimit(fn, uid, { limit: 3, windowMs })).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(mockUpsertCallableInvocation).not.toHaveBeenCalled();
  });

  it("resets the count when the existing row is from a previous window", async () => {
    const previousWindowStart = new Date(
      Math.floor(Date.now() / windowMs) * windowMs - windowMs
    ).toISOString();
    mockGetCallableInvocation.mockResolvedValue({
      data: { callableInvocation: { windowStart: previousWindowStart, count: 3 } },
    } as never);

    await enforceRateLimit(fn, uid, { limit: 3, windowMs });

    expect(mockUpsertCallableInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 })
    );
  });
});
