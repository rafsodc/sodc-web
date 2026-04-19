import { describe, it, expect } from "vitest";
import { toCanonicalUuid } from "../uuid";

describe("toCanonicalUuid", () => {
  it("normalizes compact 32-char hex", () => {
    expect(toCanonicalUuid("cf9cb661d2264eee976155426109ae8d")).toBe(
      "cf9cb661-d226-4eee-9761-55426109ae8d"
    );
  });

  it("passes through canonical hyphenated form", () => {
    expect(toCanonicalUuid("ad65cd97-07f9-4e04-8999-d73e264b1924")).toBe(
      "ad65cd97-07f9-4e04-8999-d73e264b1924"
    );
  });

  it("throws on invalid input", () => {
    expect(() => toCanonicalUuid("short")).toThrow(/Invalid UUID/);
  });
});
