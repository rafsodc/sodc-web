import { MAX_EMAIL_LENGTH } from "../../../constants";

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmailAddress(value: string): boolean {
  const normalized = normalizeEmailAddress(value);
  return normalized.length <= MAX_EMAIL_LENGTH && EMAIL_ADDRESS_PATTERN.test(normalized);
}
