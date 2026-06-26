import { describe, expect, it } from "vitest";
import {
  canAttemptSignIn,
  getRegistrationPasswordHelperText,
  validateRegistrationPassword,
} from "../passwordValidation";
import {
  FIREBASE_MIN_PASSWORD_LENGTH,
  REGISTRATION_MIN_PASSWORD_LENGTH,
} from "../../../../constants/auth";

describe("passwordValidation", () => {
  it("uses shared registration minimum length", () => {
    expect(REGISTRATION_MIN_PASSWORD_LENGTH).toBe(6);
    expect(getRegistrationPasswordHelperText()).toBe("Must be at least 6 characters");
  });

  it("rejects registration passwords below the minimum", () => {
    expect(validateRegistrationPassword("12345")).toEqual({
      isValid: false,
      error: "Password must be at least 6 characters",
    });
    expect(validateRegistrationPassword("123456").isValid).toBe(true);
  });

  it("allows sign-in at the Firebase minimum length", () => {
    expect(FIREBASE_MIN_PASSWORD_LENGTH).toBe(6);
    expect(canAttemptSignIn("12345")).toBe(false);
    expect(canAttemptSignIn("123456")).toBe(true);
  });
});
