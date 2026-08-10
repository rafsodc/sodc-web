import { describe, expect, it } from "vitest";
import { isAuthenticationFailure } from "../isAuthenticationFailure";

describe("isAuthenticationFailure", () => {
  it.each([
    { code: 401 },
    { status: 403 },
    { code: "dataconnect/unauthorized" },
    { code: "functions/permission-denied" },
    { code: "auth/unauthenticated" },
  ])("recognises an authentication or authorization response", (error) => {
    expect(isAuthenticationFailure(error)).toBe(true);
  });

  it("does not classify ordinary transport errors as authentication failures", () => {
    expect(isAuthenticationFailure(new Error("network unavailable"))).toBe(false);
  });

  it.each([
    { status: 500, message: "unauthorized text from an upstream service" },
    { code: "functions/invalid-argument", message: "permission denied is not the code" },
    { code: "operation-timeout", message: "unauthenticated request timed out" },
  ])("does not trust message text when the structured code is not an auth failure", (error) => {
    expect(isAuthenticationFailure(error)).toBe(false);
  });
});
