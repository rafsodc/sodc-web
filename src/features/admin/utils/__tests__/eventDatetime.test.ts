import { describe, it, expect } from "vitest";
import { toDatetimeLocal, fromDatetimeLocal, validateEventDateTimes, EVENT_DATE_TIME_FIELDS } from "../eventDatetime";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

  it.each(["", "not-a-date", "2026-00-20T10:00", "2026-13-20T10:00", "2026-02-30T10:00",
    "2025-02-29T10:00", "2026-01-00T10:00", "2026-01-20T24:00", "2026-01-20T10:60",
    "2026-01-20T10:00:60", "2026-01-20T10:00Z", "0000-01-01T10:00"])("rejects malformed/rolled-over local time %j", value => {
    expect(() => fromDatetimeLocal(value)).toThrow(RangeError);
  });

  it("accepts a real leap day and retains supplied seconds", () => {
    const date = new Date(fromDatetimeLocal("2028-02-29T10:00:59.123"));
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getSeconds(), date.getMilliseconds()]).toEqual([2028, 1, 29, 59, 123]);
  });

  it("handles BST, GMT and DST boundaries under a real London timezone", () => {
    const moduleUrl = pathToFileURL(resolve("src/features/admin/utils/eventDatetime.ts")).href;
    // A child isolates TZ from concurrent tests and uses the same source utility.
    execFileSync(process.execPath, ["--input-type=module", "-e", `
      import assert from "node:assert/strict";
      import {fromDatetimeLocal, validateEventDateTimes} from ${JSON.stringify(moduleUrl)};
      assert.equal(fromDatetimeLocal("2026-07-27T19:30"), "2026-07-27T18:30:00.000Z");
      assert.equal(fromDatetimeLocal("2026-12-27T19:30"), "2026-12-27T19:30:00.000Z");
      assert.equal(fromDatetimeLocal("2026-07-28"), "2026-07-27T23:00:00.000Z");
      assert.throws(() => fromDatetimeLocal("2026-03-29T01:30"), RangeError);
      assert.equal(fromDatetimeLocal("2026-10-25T01:30"), "2026-10-25T00:30:00.000Z");
      const spring = validateEventDateTimes({startDateTime:"2026-03-29T00:30",endDateTime:"2026-03-29T02:30",bookingStartDateTime:"2026-03-28T00:00",bookingEndDateTime:"2026-03-28T01:00"});
      assert.equal(spring.valid, true);
      assert.equal(Date.parse(spring.timestamps.endDateTime)-Date.parse(spring.timestamps.startDateTime), 3600000);
      const gap = validateEventDateTimes({startDateTime:"2026-03-29T01:30",endDateTime:"2026-03-29T02:30",bookingStartDateTime:"2026-03-28T00:00",bookingEndDateTime:"2026-03-28T01:00"});
      assert.equal(gap.valid, false);
      assert.equal(gap.errors.startDateTime, "Enter a valid start date/time.");
    `], { env: { ...process.env, TZ: "Europe/London" }, timeout: 10_000, stdio: "pipe" });
  });
});

describe("event date validation", () => {
  const dates = {
    startDateTime: "2026-11-20T13:00", endDateTime: "2026-11-20T22:30",
    bookingStartDateTime: "2026-10-01T09:00", bookingEndDateTime: "2026-11-12T17:00",
  };

  it.each(EVENT_DATE_TIME_FIELDS)("requires a parseable local date and time for %s", field => {
    expect(validateEventDateTimes({ ...dates, [field]: "" })).toMatchObject({ valid: false, errors: { [field]: expect.stringContaining("is required") } });
    expect(validateEventDateTimes({ ...dates, [field]: "2026-02-30T10:00" })).toMatchObject({ valid: false, errors: { [field]: expect.stringContaining("Enter a valid") } });
    expect(validateEventDateTimes({ ...dates, [field]: "2026-11-20" })).toMatchObject({ valid: false, errors: { [field]: expect.stringContaining("Enter a valid") } });
  });

  it("rejects reversed event and booking intervals independently", () => {
    expect(validateEventDateTimes({ ...dates, endDateTime: "2026-11-20T12:59" })).toMatchObject({ valid: false, errors: { endDateTime: "End date/time must be on or after start date/time." } });
    expect(validateEventDateTimes({ ...dates, bookingEndDateTime: "2026-10-01T08:59" })).toMatchObject({ valid: false, errors: { bookingEndDateTime: "Booking window end must be on or after booking window start." } });
  });

  it("allows equal endpoints and booking windows after the event", () => {
    const result = validateEventDateTimes({ ...dates, endDateTime: dates.startDateTime,
      bookingStartDateTime: "2026-12-01T09:00", bookingEndDateTime: "2026-12-01T09:00" });
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("Expected valid dates");
    expect(result.timestamps.startDateTime).toBe(result.timestamps.endDateTime);
    expect(result.timestamps.bookingStartDateTime).toBe(result.timestamps.bookingEndDateTime);
  });
});
