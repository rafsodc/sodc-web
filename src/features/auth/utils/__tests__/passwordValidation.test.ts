import { beforeEach, describe, expect, it, vi } from "vitest";
import { validatePassword } from "firebase/auth";
import {
  canAttemptSignIn,
  passwordPolicyError,
  validateNewPassword,
} from "../passwordValidation";
import { FIREBASE_MIN_PASSWORD_LENGTH } from "../../../../constants/auth";

vi.mock("firebase/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("firebase/auth")>();
  return { ...original, validatePassword: vi.fn() };
});

const policy = {
  customStrengthOptions: { minPasswordLength: 12 },
  enforcementState: "ENFORCE",
  forceUpgradeOnSignin: true,
  allowedNonAlphanumericCharacters: "",
};

describe("passwordValidation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("describes requirements reported by Firebase", () => {
    expect(
      passwordPolicyError({
        isValid: false,
        meetsMinPasswordLength: false,
        containsUppercaseLetter: false,
        containsNumericCharacter: false,
        passwordPolicy: policy,
      }),
    ).toBe("Password must be at least 12 characters, include an uppercase letter, include a number.");
  });

  it("uses the deployed Firebase policy as the validation source", async () => {
    vi.mocked(validatePassword).mockResolvedValue({
      isValid: false,
      meetsMinPasswordLength: false,
      passwordPolicy: policy,
    });
    await expect(validateNewPassword({} as never, "short")).resolves.toMatchObject({
      isValid: false,
      error: "Password must be at least 12 characters.",
    });
    expect(validatePassword).toHaveBeenCalledWith({}, "short");
  });

  it("allows sign-in attempts at the Firebase credential floor", () => {
    expect(FIREBASE_MIN_PASSWORD_LENGTH).toBe(6);
    expect(canAttemptSignIn("12345")).toBe(false);
    expect(canAttemptSignIn("123456")).toBe(true);
  });
});
