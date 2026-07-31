import { describe, expect, it } from "vitest";
import { addUtcCalendarMonths, isProfileReviewDue } from "../profileReviewDue";

describe("profile review due calculation", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");

  it("requires review when the timestamp is missing or invalid", () => {
    expect(isProfileReviewDue(null, now)).toBe(true);
    expect(isProfileReviewDue(undefined, now)).toBe(true);
    expect(isProfileReviewDue("not-a-date", now)).toBe(true);
  });

  it("does not require review just inside six calendar months", () => {
    expect(isProfileReviewDue("2026-01-30T12:00:01.000Z", now)).toBe(false);
  });

  it("does not require review at the exact six-month boundary", () => {
    expect(isProfileReviewDue("2026-01-30T12:00:00.000Z", now)).toBe(false);
  });

  it("requires review immediately after the six-month boundary", () => {
    expect(isProfileReviewDue("2026-01-30T11:59:59.999Z", now)).toBe(true);
  });

  it("clamps month-end dates using UTC calendar semantics", () => {
    expect(addUtcCalendarMonths(new Date("2024-08-31T23:30:00-05:00"), 6).toISOString()).toBe(
      "2025-03-01T04:30:00.000Z",
    );
    expect(addUtcCalendarMonths(new Date("2024-08-31T10:15:00.000Z"), 6).toISOString()).toBe(
      "2025-02-28T10:15:00.000Z",
    );
  });
});
