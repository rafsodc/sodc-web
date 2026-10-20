import { describe, expect, it } from "vitest";
import { newMembersCsv, reportDateStart } from "../newMembersReport";

describe("new member report dates", () => {
  it.each([
    ["2026-08-06", "2026-08-05T23:00:00.000Z"], ["2026-01-01", "2026-01-01T00:00:00.000Z"],
    ["2026-03-29", "2026-03-29T00:00:00.000Z"], ["2026-03-30", "2026-03-29T23:00:00.000Z"],
    ["2026-10-25", "2026-10-24T23:00:00.000Z"], ["2026-10-26", "2026-10-26T00:00:00.000Z"],
  ])("uses UK midnight for %s", (input, expected) => expect(reportDateStart(input)).toBe(expected));
  it.each(["", "bad", "2026-02-30", "2026-13-01"])("rejects invalid calendar date %s", (value) => expect(reportDateStart(value)).toBeNull());
});

it("exports names, status and registration date with safe spreadsheet cells", () => {
  const csv = newMembersCsv([{ id: "1", firstName: '=HYPERLINK("bad")', lastName: "Name, Jr", rank: null,
    email: "+formula@example.com", membershipStatus: "REGULAR", joinedAt: "2026-08-07T12:00:00Z" }]);
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  expect(csv).toContain('"Name, Jr"');
  expect(csv).toContain('"\'+formula@example.com"');
  expect(csv).toContain('"2026-08-07T12:00:00Z"');
});
