import { describe, expect, it } from "vitest";
import { ticketPreferences } from "../../ticketPreferences";

describe("ticket preference validation", () => {
  it("normalizes names, deduplicates seating and keeps an explicit empty override", () => {
    expect(ticketPreferences({ accommodationRequested: false, accommodationNote: "  ", sitNextToUserIds: [" Alex ", "Alex", "Jamie"] }))
      .toEqual({ accommodationRequested: false, accommodationNote: "", sitNextToUserIds: ["Alex", "Jamie"] });
    expect(ticketPreferences({})).toEqual({ accommodationRequested: null, accommodationNote: null, sitNextToUserIds: null });
  });
  it.each([
    { accommodationRequested: "yes" }, { accommodationNote: 42 }, { accommodationNote: "x".repeat(2001) },
    { sitNextToUserIds: "Alex" }, { sitNextToUserIds: [""] }, { sitNextToUserIds: [42] },
    { sitNextToUserIds: ["x".repeat(129)] }, { sitNextToUserIds: Array(11).fill("Alex") },
  ])("rejects invalid preferences %j", (data) => {
    expect(() => ticketPreferences(data)).toThrow();
  });
});
