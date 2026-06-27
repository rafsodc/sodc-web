import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

/**
 * Ensures the request is authenticated
 */
export function requireAuth(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
}

/**
 * Requires the Firebase Auth user to have the `enabled` custom claim (matches Data Connect USER_ACCESS).
 */
export function requireEnabled(request: CallableRequest): void {
  requireAuth(request);
  if (request.auth!.token.enabled !== true) {
    throw new HttpsError("permission-denied", "Account must be enabled");
  }
}

/**
 * Ensures the request is authenticated and the user is an admin
 */
export function requireAdmin(request: CallableRequest): void {
  requireAuth(request);
  if (request.auth!.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admins only");
  }
}

/**
 * Validates that a value is a non-empty string
 */
export function requireString(value: any, fieldName: string): string {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${fieldName} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validates that a string is within the specified length limits
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  maxLength: number,
  minLength: number = 1
): string {
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new HttpsError("invalid-argument", `${fieldName} must be at least ${minLength} character(s)`);
  }
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${fieldName} must be no more than ${maxLength} character(s)`);
  }
  return trimmed;
}

/**
 * Validates email format (basic validation)
 */
export function validateEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    throw new HttpsError("invalid-argument", `Email must be no more than ${MAX_EMAIL_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Validates UUID format (hyphenated RFC-4122 string or 32-char hex without hyphens).
 * Returns canonical lowercase hyphenated form so Data Connect and DB lookups stay consistent.
 */
export function validateUUID(uuid: string, fieldName: string = "UUID"): string {
  const compact = String(uuid).trim().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) {
    throw new HttpsError("invalid-argument", `Invalid ${fieldName} format`);
  }
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`.toLowerCase();
}

// Input length limits (must match frontend constants)
export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_SERVICE_NUMBER_LENGTH = 50;
export const MAX_EMAIL_LENGTH = 255;

/**
 * Maps a Firebase Auth user record to a simplified user object
 */
export function mapUserRecord(userRecord: admin.auth.UserRecord) {
  return {
    uid: userRecord.uid,
    email: userRecord.email || "",
    displayName: userRecord.displayName || "",
    emailVerified: userRecord.emailVerified,
    disabled: userRecord.disabled,
    metadata: {
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
    },
    customClaims: userRecord.customClaims || {},
  };
}

/**
 * Pages through all Firebase Auth users, returning every record.
 * listUsers() caps at 1000 per call; this handles arbitrarily large tenants.
 */
export async function listAllAuthUsers(): Promise<admin.auth.UserRecord[]> {
  const users: admin.auth.UserRecord[] = [];
  let nextPageToken: string | undefined;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return users;
}

/**
 * Gets all admin users from Firebase Auth
 */
export async function getAdminUsers(): Promise<admin.auth.UserRecord[]> {
  const users = await listAllAuthUsers();
  return users.filter((u) => (u.customClaims || {}).admin === true);
}

/**
 * Standardized error handling for Cloud Functions
 * Re-throws HttpsError instances, logs other errors, and wraps them in HttpsError
 * 
 * @param error - The error that was caught
 * @param context - Description of the operation that failed (e.g., "setting custom claim")
 * @throws HttpsError - Always throws an HttpsError
 */
export function handleFunctionError(error: any, context: string): never {
  if (error instanceof HttpsError) {
    throw error;
  }
  logger.error(`Error ${context}:`, error);
  throw new HttpsError("internal", "Internal server error");
}

