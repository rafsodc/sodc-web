import {
  FIREBASE_MIN_PASSWORD_LENGTH,
  REGISTRATION_MIN_PASSWORD_LENGTH,
} from "../../../constants/auth";

export function validateRegistrationPassword(password: string): { isValid: boolean; error?: string } {
  if (password.length < REGISTRATION_MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be at least ${REGISTRATION_MIN_PASSWORD_LENGTH} characters`,
    };
  }
  return { isValid: true };
}

export function getRegistrationPasswordHelperText(): string {
  return `Must be at least ${REGISTRATION_MIN_PASSWORD_LENGTH} characters`;
}

export function canAttemptSignIn(password: string): boolean {
  return password.length >= FIREBASE_MIN_PASSWORD_LENGTH;
}
