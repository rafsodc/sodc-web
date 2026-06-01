import { describe, expect, it } from "vitest";
import { redactEmailAddresses, sanitizeMailerError } from "../mailerErrors";

describe("mailerErrors", () => {
  it("redactEmailAddresses redacts a simple email", () => {
    expect(redactEmailAddresses("failed for user@example.com")).toBe("failed for [redacted-email]");
  });

  it("redactEmailAddresses leaves strings without email shape unchanged", () => {
    expect(redactEmailAddresses("no at sign here")).toBe("no at sign here");
    expect(redactEmailAddresses("bad@nodot")).toBe("bad@nodot");
  });

  it("sanitizeMailerError redacts emails in error messages", () => {
    const result = sanitizeMailerError(new Error("Notify rejected buyer@example.com"));
    expect(result.message).toBe("Notify rejected [redacted-email]");
  });
});
