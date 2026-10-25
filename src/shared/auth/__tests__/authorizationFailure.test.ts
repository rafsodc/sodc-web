import { describe, expect, it, vi } from "vitest";
import { classifyAuthorizationFailure } from "../authorizationFailure";
describe("current-authorization denial markers", () => {
  it.each([
    {code: "functions/unauthenticated", details: {code: "SESSION_VERSION_STALE"}},
    {code: "data-connect/other", message: "Operation failed", errors: [{message: "SESSION_VERSION_STALE"}]},
    {response: {data: {errors: [{extensions: {message: "SESSION_VERSION_STALE"}}]}}},
  ])("recognizes stale versions through Firebase wrappers", error => expect(classifyAuthorizationFailure(error)).toBe("stale-version"));
  it("prioritizes a terminal denial over a recoverable stale version", () => {
    expect(classifyAuthorizationFailure({errors: [{message: "SESSION_VERSION_STALE"}, {message: "ACCESS_REVOKED"}]})).toBe("revoked");
  });
  it.each([null, {message: "permission denied"}, {details: {unrelated: "ACCESS_REVOKED"}}])("ignores unclassified data", value => expect(classifyAuthorizationFailure(value)).toBeNull());
  it("handles circular exception causes", () => {
    const error: {cause?: unknown} = {}; error.cause = error;
    expect(classifyAuthorizationFailure(error)).toBeNull();
  });
  it("reads non-enumerable Error messages and causes", () => {
    expect(classifyAuthorizationFailure(new Error("ACCESS_REVOKED"))).toBe("revoked");
    expect(classifyAuthorizationFailure(new Error("outer", {cause: new Error("SESSION_VERSION_STALE")}))).toBe("stale-version");
  });
  it("reads the installed DataConnectOperationError response shape", async () => {
    const {DataConnectOperationError} = await vi.importActual<typeof import("firebase/data-connect")>("firebase/data-connect");
    // The SDK constructor is internal in its .d.ts but is exported at runtime.
    const ErrorType = DataConnectOperationError as unknown as new (message: string, response: unknown) => Error;
    const error = new ErrorType("operation failed", {errors: [{message: "ACCESS_REVOKED"}], data: null});
    expect(classifyAuthorizationFailure(error)).toBe("revoked");
  });
  it("tolerates inherited and throwing accessors", () => {
    const error = Object.create({get message() {return "SESSION_VERSION_STALE";}, get details() {throw new Error("unreadable");}});
    expect(classifyAuthorizationFailure(error)).toBe("stale-version");
  });

});
