import { describe, expect, it } from "vitest";
import { formatEventGuestPolicy, guestCountNeedsModerationNotice } from "../eventGuestPolicy";

describe("eventGuestPolicy", () => {
  it("formats guest policy copy without exposing raw field names", () => {
    expect(formatEventGuestPolicy(null)).toMatch(/organiser review/i);
    expect(formatEventGuestPolicy(0)).toMatch(/require organiser review/i);
    expect(formatEventGuestPolicy(1)).toMatch(/up to 1 guest ticket/i);
    expect(formatEventGuestPolicy(2)).toMatch(/up to 2 guest tickets/i);
  });

  it("flags when guest count exceeds auto-approval threshold", () => {
    expect(guestCountNeedsModerationNotice(0, 1)).toBe(false);
    expect(guestCountNeedsModerationNotice(1, 1)).toBe(false);
    expect(guestCountNeedsModerationNotice(2, 1)).toBe(true);
    expect(guestCountNeedsModerationNotice(1, null)).toBe(true);
  });
});
