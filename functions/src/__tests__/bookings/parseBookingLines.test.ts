import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { parseBookingLines, submitEventBookingRateLimitCost } from "../../bookings";
import { MAX_ATOMIC_BOOKING_LINES } from "../../bookingSubmissionPersistence";
import { CALLABLE_RATE_LIMITS } from "../../rateLimiter";

const TICKET_TYPE_ID = "10000000-0000-4000-8000-000000000001";

function line(sortOrder: number) {
  return { ticketTypeId: TICKET_TYPE_ID, sortOrder };
}

describe("parseBookingLines line-count bound (#541)", () => {
  it("accepts exactly the maximum number of lines", () => {
    const lines = Array.from({ length: MAX_ATOMIC_BOOKING_LINES }, (_, i) => line(i));
    expect(parseBookingLines(lines)).toHaveLength(MAX_ATOMIC_BOOKING_LINES);
  });

  it("rejects one more than the maximum, before any per-line validation", () => {
    const lines = Array.from({ length: MAX_ATOMIC_BOOKING_LINES + 1 }, (_, i) => line(i));
    expect(() => parseBookingLines(lines)).toThrow(HttpsError);
    try {
      parseBookingLines(lines);
      expect.unreachable("expected parseBookingLines to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpsError);
      expect((error as HttpsError).code).toBe("invalid-argument");
      expect((error as HttpsError).message).toBe(
        `lines must contain no more than ${MAX_ATOMIC_BOOKING_LINES} tickets`
      );
    }
  });

  it("rejects an empty array", () => {
    expect(() => parseBookingLines([])).toThrow(HttpsError);
  });
});

describe("submitEventBookingRateLimitCost (#541)", () => {
  const { limit } = CALLABLE_RATE_LIMITS.submitEventBooking;

  it("charges the historical flat cost of 1 for a typical small booking", () => {
    expect(submitEventBookingRateLimitCost([])).toBe(1);
    expect(submitEventBookingRateLimitCost([{}, {}, {}])).toBe(1);
    expect(submitEventBookingRateLimitCost(undefined)).toBe(1);
    expect(submitEventBookingRateLimitCost(null)).toBe(1);
  });

  it("scales cost up with line count", () => {
    expect(submitEventBookingRateLimitCost(Array.from({ length: 6 }))).toBe(2);
    expect(submitEventBookingRateLimitCost(Array.from({ length: 10 }))).toBe(2);
    expect(submitEventBookingRateLimitCost(Array.from({ length: 11 }))).toBe(3);
  });

  it("charges the full policy allowance at the maximum accepted line count", () => {
    expect(submitEventBookingRateLimitCost(Array.from({ length: MAX_ATOMIC_BOOKING_LINES }))).toBe(limit);
  });

  it("clamps an oversized or malformed payload to the policy limit rather than throwing", () => {
    expect(submitEventBookingRateLimitCost(Array.from({ length: 10_000 }))).toBe(limit);
    expect(submitEventBookingRateLimitCost("not-an-array")).toBe(1);
    expect(submitEventBookingRateLimitCost({ length: 10_000 })).toBe(1);
  });
});
