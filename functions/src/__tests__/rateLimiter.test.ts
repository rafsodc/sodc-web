import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { CALLABLE_RATE_LIMITS, enforceRateLimit } from "../rateLimiter";

const mockConsumeCallableRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const mockEnsureCallableRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const uid = "user-1";

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:07:30.000Z"));
    mockEnsureCallableRateLimitBucket.mockResolvedValue({ data: {} } as never);
    mockConsumeCallableRateLimit.mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("consumes the centralized limit in the current fixed window", async () => {
    await enforceRateLimit("updateDisplayName", uid);

    expect(mockConsumeCallableRateLimit).toHaveBeenCalledWith({
      userId: uid,
      functionName: "updateDisplayName",
      windowStart: "2026-07-17T12:00:00.000Z",
      limit: CALLABLE_RATE_LIMITS.updateDisplayName.limit,
    });
  });

  it("ensures the bucket row exists in a prior, separately-committed call before consuming it (#401)", async () => {
    const callOrder: string[] = [];
    mockEnsureCallableRateLimitBucket.mockImplementation(async () => {
      callOrder.push("ensure");
      return { data: {} } as never;
    });
    mockConsumeCallableRateLimit.mockImplementation(async () => {
      callOrder.push("consume");
      return { data: {} } as never;
    });

    await enforceRateLimit("updateDisplayName", uid);

    expect(mockEnsureCallableRateLimitBucket).toHaveBeenCalledWith({
      userId: uid,
      functionName: "updateDisplayName",
      windowStart: "2026-07-17T12:00:00.000Z",
    });
    expect(callOrder).toEqual(["ensure", "consume"]);
  });

  it("starts a fresh bucket after the window rolls over", async () => {
    await enforceRateLimit("updateDisplayName", uid);
    vi.setSystemTime(new Date("2026-07-17T13:00:00.000Z"));
    await enforceRateLimit("updateDisplayName", uid);

    expect(mockConsumeCallableRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ windowStart: "2026-07-17T13:00:00.000Z" })
    );
  });

  it("allows requests through the threshold and rejects the next request", async () => {
    let consumed = 0;
    const limit = CALLABLE_RATE_LIMITS.updateDisplayName.limit;
    mockConsumeCallableRateLimit.mockImplementation(async () => {
      consumed += 1;
      if (consumed > limit) throw new Error("RATE_LIMIT_EXCEEDED");
      return { data: {} } as never;
    });

    for (let i = 0; i < limit; i += 1) {
      await expect(enforceRateLimit("updateDisplayName", uid)).resolves.toBeUndefined();
    }
    await expect(enforceRateLimit("updateDisplayName", uid)).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });

  it("rejects concurrent requests beyond the atomic backend threshold", async () => {
    let consumed = 0;
    const limit = CALLABLE_RATE_LIMITS.updateDisplayName.limit;
    mockConsumeCallableRateLimit.mockImplementation(async () => {
      consumed += 1;
      if (consumed > limit) throw new Error("RATE_LIMIT_EXCEEDED");
      return { data: {} } as never;
    });

    const results = await Promise.allSettled(
      Array.from({ length: limit + 2 }, () => enforceRateLimit("updateDisplayName", uid))
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(limit);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(2);
    for (const result of rejected) {
      expect(result.reason).toMatchObject({ code: "resource-exhausted" });
    }
  });

  it("does not hide backend failures unrelated to rate limiting", async () => {
    const backendError = new Error("database unavailable");
    mockConsumeCallableRateLimit.mockRejectedValue(backendError);

    await expect(enforceRateLimit("updateDisplayName", uid)).rejects.toBe(backendError);
  });

  it("recognizes a rate-limit marker nested in backend error details", async () => {
    mockConsumeCallableRateLimit.mockRejectedValue({
      message: "mutation failed",
      errors: [{ message: "RATE_LIMIT_EXCEEDED" }],
    });

    await expect(enforceRateLimit("updateDisplayName", uid)).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });
});
