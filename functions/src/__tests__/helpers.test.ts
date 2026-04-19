import { describe, it, expect } from "vitest";
import { validateUUID } from "../helpers";
import { HttpsError } from "firebase-functions/v2/https";

describe("validateUUID", () => {
  it("accepts hyphenated UUIDs and returns lowercase canonical form", () => {
    expect(validateUUID("AD65CD97-07F9-4E04-8999-D73E264B1924")).toBe(
      "ad65cd97-07f9-4e04-8999-d73e264b1924"
    );
  });

  it("accepts 32-char hex without hyphens", () => {
    expect(validateUUID("cf9cb661d2264eee976155426109ae8d")).toBe(
      "cf9cb661-d226-4eee-9761-55426109ae8d"
    );
  });

  it("throws invalid-argument for bad input", () => {
    expect(() => validateUUID("not-a-uuid", "eventId")).toThrow(HttpsError);
    expect(() => validateUUID("cf9cb661-d226-4eee-9761", "eventId")).toThrow(HttpsError);
  });
});
