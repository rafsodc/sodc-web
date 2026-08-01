import {
  validatePassword as validateFirebasePassword,
  type Auth,
  type PasswordValidationStatus,
} from "firebase/auth";
import { FIREBASE_MIN_PASSWORD_LENGTH } from "../../../constants/auth";

export const PASSWORD_POLICY_HELPER_TEXT =
  "Requirements are checked against the current account security policy.";

export function passwordPolicyError(status: PasswordValidationStatus): string {
  const requirements: string[] = [];
  const options = status.passwordPolicy.customStrengthOptions;
  if (status.meetsMinPasswordLength === false && options.minPasswordLength) {
    requirements.push(`be at least ${options.minPasswordLength} characters`);
  }
  if (status.meetsMaxPasswordLength === false && options.maxPasswordLength) {
    requirements.push(`be no more than ${options.maxPasswordLength} characters`);
  }
  if (status.containsLowercaseLetter === false) requirements.push("include a lowercase letter");
  if (status.containsUppercaseLetter === false) requirements.push("include an uppercase letter");
  if (status.containsNumericCharacter === false) requirements.push("include a number");
  if (status.containsNonAlphanumericCharacter === false) {
    requirements.push("include a non-alphanumeric character");
  }
  return requirements.length
    ? `Password must ${requirements.join(", ")}.`
    : "Password does not meet the current account security policy.";
}

export async function validateNewPassword(auth: Auth, password: string) {
  const status = await validateFirebasePassword(auth, password);
  return {
    isValid: status.isValid,
    error: status.isValid ? undefined : passwordPolicyError(status),
    status,
  };
}

export function canAttemptSignIn(password: string): boolean {
  return password.length >= FIREBASE_MIN_PASSWORD_LENGTH;
}

export function isPasswordPolicyAuthError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return code.includes("password-does-not-meet-requirements") || code.includes("weak-password");
}
