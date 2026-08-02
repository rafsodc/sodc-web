import { describe, expect, it, vi } from "vitest";
import {
  classifyError,
  extractDomainErrorCode,
  extractErrorCode,
  reportError,
  toAuthUserFacingError,
  toUserFacingError,
} from "../index";

describe("shared error handling", () => {
  it("extracts and normalises provider codes without reading messages", () => {
    expect(extractErrorCode({ code: " Functions/Unavailable " })).toBe(
      "functions/unavailable",
    );
    expect(extractErrorCode(new Error("functions/unavailable"))).toBeUndefined();
  });

  it("accepts stable callable detail codes and rejects arbitrary detail", () => {
    expect(extractDomainErrorCode({ details: { code: "booking_already_submitted" } })).toBe(
      "BOOKING_ALREADY_SUBMITTED",
    );
    expect(extractDomainErrorCode({ customData: { code: "RECENT_LOGIN_REQUIRED" } })).toBe(
      "RECENT_LOGIN_REQUIRED",
    );
    expect(extractDomainErrorCode({ details: { code: "Not safe to display." } })).toBeUndefined();
  });

  it.each([
    ["functions/permission-denied", "authorization"],
    ["auth/requires-recent-login", "authentication"],
    ["functions/invalid-argument", "validation"],
    ["functions/already-exists", "conflict"],
    ["functions/not-found", "not-found"],
    ["functions/resource-exhausted", "rate-limit"],
    ["auth/network-request-failed", "network"],
    ["functions/failed-precondition", "configuration"],
    ["functions/internal", "unknown"],
  ] as const)("classifies %s as %s", (code, category) => {
    expect(classifyError({ code })).toBe(category);
  });

  it("maps application-owned domain codes before generic provider categories", () => {
    expect(
      toUserFacingError(
        {
          code: "functions/failed-precondition",
          details: { code: "BOOKING_ALREADY_SUBMITTED" },
          message: "Internal booking revision 42 failed",
        },
        {
          domainErrors: {
            BOOKING_ALREADY_SUBMITTED: {
              category: "conflict",
              title: "Already booked",
              message: "You already have a booking for this event.",
              retryable: false,
            },
          },
        },
      ),
    ).toEqual({
      category: "conflict",
      title: "Already booked",
      message: "You already have a booking for this event.",
      retryable: false,
    });
  });

  it("never exposes an unknown error message", () => {
    const technicalMessage = "SQL SELECT users password_hash failed";
    const mapped = toUserFacingError(new Error(technicalMessage));
    expect(mapped.category).toBe("unknown");
    expect(mapped.message).not.toContain(technicalMessage);
    expect(mapped.message).toBe("The operation could not be completed. Please try again.");
  });

  it("uses a neutral sign-in message for account-enumerating Auth failures", () => {
    const missingUser = toAuthUserFacingError(
      { code: "auth/user-not-found", message: "No user record" },
      "sign-in",
    );
    const wrongPassword = toAuthUserFacingError(
      { code: "auth/wrong-password", message: "Wrong password" },
      "sign-in",
    );
    expect(missingUser.message).toBe("Email or password is incorrect.");
    expect(wrongPassword.message).toBe(missingUser.message);
  });

  it("maps registration errors without exposing Firebase messages", () => {
    const mapped = toAuthUserFacingError(
      {
        code: "auth/email-already-in-use",
        message: "Firebase: Error (auth/email-already-in-use).",
      },
      "register",
    );
    expect(mapped.message).toBe("This email is already registered. Please sign in instead.");
    expect(mapped.message).not.toContain("Firebase");
  });

  it("reports the original failure separately from display mapping", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = new Error("diagnostic detail");
    reportError("registration", original, { attempt: 1 });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[registration]",
      original,
      { attempt: 1 },
    );
    consoleSpy.mockRestore();
  });
});
