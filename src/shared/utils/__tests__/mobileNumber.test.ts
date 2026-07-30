import { describe, expect, it } from "vitest";
import { normalizeMobileNumber } from "../mobileNumber";

describe("normalizeMobileNumber", () => {
  it.each([
    ["07700 900123", "+447700900123"],
    ["+44 7700 900123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
    ["+44 (0) 7700-900123", "+447700900123"],
    ["+1 202-555-0123", "+12025550123"],
  ])("normalises %s to E.164", (input, expected) => {
    expect(normalizeMobileNumber(input)).toBe(expected);
  });

  it.each(["", "   ", "077", "not-a-number", "7700900123"])(
    "rejects blank or ambiguous input %j",
    (input) => {
      expect(normalizeMobileNumber(input)).toBeNull();
    },
  );
});
