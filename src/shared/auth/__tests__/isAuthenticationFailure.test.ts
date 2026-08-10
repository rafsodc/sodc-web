import { describe, expect, it } from "vitest";
import { isAuthenticationFailure } from "../isAuthenticationFailure";

describe("isAuthenticationFailure", () => {
  it.each([
    { code: 401 },
    { status: 403 },
    { code: "dataconnect/unauthorized" },
    { code: "functions/permission-denied" },
    new Error("Request is unauthenticated"),
  ])("recognises an authentication or authorization response", (error) => {
    expect(isAuthenticationFailure(error)).toBe(true);
  });

  it("does not classify ordinary transport errors as authentication failures", () => {
    expect(isAuthenticationFailure(new Error("network unavailable"))).toBe(false);
  });
});
