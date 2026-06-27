import { describe, it, expect } from "vitest";
import { toDatetimeLocal, fromDatetimeLocal } from "../eventDatetime";

describe("toDatetimeLocal", () => {
  it("formats an ISO string as a datetime-local value in local time", () => {
    // Use a fixed local date to avoid DST ambiguity in the test
    const local = new Date(2026, 6, 27, 19, 30); // 27 Jul 2026 19:30 local
    const result = toDatetimeLocal(local.toISOString());
    expect(result).toBe("2026-07-27T19:30");
  });
});

describe("fromDatetimeLocal", () => {
  it("round-trips through toDatetimeLocal without shifting the time", () => {
    const original = new Date(2026, 6, 27, 19, 30); // 27 Jul 2026 19:30 local
    const localString = toDatetimeLocal(original.toISOString());
    const roundTripped = new Date(fromDatetimeLocal(localString));
    expect(roundTripped.getFullYear()).toBe(2026);
    expect(roundTripped.getMonth()).toBe(6); // July (0-indexed)
    expect(roundTripped.getDate()).toBe(27);
    expect(roundTripped.getHours()).toBe(19);
    expect(roundTripped.getMinutes()).toBe(30);
  });

  it("treats a date-only value as midnight local time, not midnight UTC", () => {
    // "2026-07-28" with no time — new Date("2026-07-28") would give midnight UTC,
    // which is 23:00 BST the night before. fromDatetimeLocal must avoid this.
    const result = new Date(fromDatetimeLocal("2026-07-28"));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(28);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("correctly converts a future datetime — event should not appear as past", () => {
    const futureLocal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const localString = toDatetimeLocal(futureLocal.toISOString());
    const stored = fromDatetimeLocal(localString);
    expect(new Date(stored).getTime()).toBeGreaterThan(Date.now());
  });
});
