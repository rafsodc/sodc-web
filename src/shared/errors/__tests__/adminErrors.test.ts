import { describe, expect, it } from "vitest";
import { toAdminUserFacingError } from "../adminErrors";

describe("toAdminUserFacingError", () => {
  it("uses contextual copy without exposing an unknown provider message", () => {
    const mapped = toAdminUserFacingError(
      new Error("relation users_secret does not exist"),
      "users",
    );

    expect(mapped.message).toBe("We could not complete the user operation. Please try again.");
    expect(mapped.message).not.toContain("users_secret");
    expect(mapped.retryable).toBe(true);
  });

  it("preserves distinct authorization handling", () => {
    const mapped = toAdminUserFacingError(
      { code: "permission-denied", message: "internal policy details" },
      "sections",
    );

    expect(mapped.title).toBe("Access denied");
    expect(mapped.message).not.toContain("internal policy details");
    expect(mapped.retryable).toBe(false);
  });

  it("preserves configuration guidance", () => {
    const mapped = toAdminUserFacingError(
      { code: "configuration", message: "secret name" },
      "email-configuration",
    );

    expect(mapped.message).not.toContain("secret name");
  });
});

it.each([
  ["ANNOUNCEMENT_AUDIENCE_CHANGED", "Click Preview recipients again"],
  ["ANNOUNCEMENT_AUDIENCE_EMPTY", "Check the filters"],
  ["ANNOUNCEMENT_TEMPLATE_UNSUBSCRIBE", "Choose a template without one"],
  ["ANNOUNCEMENT_REPLY_TO_UNAVAILABLE", "choose another address"],
])("explains announcement precondition %s without exposing server text", (code, guidance) => {
  const result = toAdminUserFacingError({ code: "functions/failed-precondition", details: { code }, message: "private server details" }, "announcements");
  expect(result.message).toContain(guidance);
  expect(result.message).not.toContain("private server details");
});
