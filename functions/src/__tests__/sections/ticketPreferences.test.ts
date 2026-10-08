import { describe, expect, it } from "vitest";
import { ticketPreferences } from "../../ticketPreferences";

describe("ticket preference validation", () => {
  it("normalizes names, deduplicates seating and keeps an explicit empty override", () => {
    expect(ticketPreferences({ accommodationRequested: false, accommodationNote: "  ", seatingPreferences: [" Alex ", "Alex", "Jamie"] }))
      .toEqual({ accommodationRequested: false, accommodationNote: "", seatingPreferences: ["Alex", "Jamie"] });
    expect(ticketPreferences({})).toEqual({ accommodationRequested: null, accommodationNote: null, seatingPreferences: null });
  });
  it.each([
    { accommodationRequested: "yes" }, { accommodationNote: 42 }, { accommodationNote: "x".repeat(2001) },
    { seatingPreferences: "Alex" }, { seatingPreferences: [""] }, { seatingPreferences: [42] },
    { seatingPreferences: ["x".repeat(201)] }, { seatingPreferences: Array(21).fill("Alex") },
  ])("rejects invalid preferences %j", (data) => {
    expect(() => ticketPreferences(data)).toThrow();
  });
});
