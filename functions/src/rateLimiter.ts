import { HttpsError } from "firebase-functions/v2/https";
import { consumeCallableRateLimit, ensureCallableRateLimitBucket } from "@dataconnect/admin-generated";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const RATE_LIMIT_EXCEEDED_MARKER = "RATE_LIMIT_EXCEEDED";

export interface RateLimitPolicy {
  /** Max calls allowed per fixed window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

/**
 * Canonical per-user limits for callable functions with material abuse, enumeration,
 * external-API, or fan-out cost. Call sites reference these by name so limits cannot
 * drift into inline magic numbers.
 */
export const CALLABLE_RATE_LIMITS = {
  grantAdmin: { limit: 20, windowMs: HOUR_MS },
  revokeAdmin: { limit: 20, windowMs: HOUR_MS },
  listAdminUsers: { limit: 30, windowMs: 5 * MINUTE_MS },
  updateDisplayName: { limit: 5, windowMs: HOUR_MS },
  updateUserDisplayName: { limit: 30, windowMs: HOUR_MS },
  searchUsers: { limit: 60, windowMs: 5 * MINUTE_MS },
  listUsersWithoutDataConnectProfile: { limit: 30, windowMs: 5 * MINUTE_MS },
  listUsersPendingApproval: { limit: 30, windowMs: 5 * MINUTE_MS },
  syncPendingUserClaims: { limit: 10, windowMs: HOUR_MS },
  submitEventBooking: { limit: 20, windowMs: HOUR_MS },
  submitGuestTicketRequest: { limit: 20, windowMs: HOUR_MS },
  reviewGuestTicketRequest: { limit: 30, windowMs: HOUR_MS },
  updateMembershipStatus: { limit: 20, windowMs: HOUR_MS },
  resignMembership: { limit: 3, windowMs: HOUR_MS },
  getSectionMembersMerged: { limit: 60, windowMs: 5 * MINUTE_MS },
  createTicketCheckoutSession: { limit: 10, windowMs: 15 * MINUTE_MS },
  createEventBookingCheckoutSession: { limit: 10, windowMs: 15 * MINUTE_MS },
  reconcileMyCheckoutSessionOrders: { limit: 20, windowMs: 15 * MINUTE_MS },
  getMyTicketOrderStripeArtifactsBatch: { limit: 10, windowMs: 15 * MINUTE_MS },
  getTemplateSyncStatus: { limit: 10, windowMs: 5 * MINUTE_MS },
  getAnnouncementTemplates: { limit: 30, windowMs: 5 * MINUTE_MS },
  previewAnnouncementTemplate: { limit: 30, windowMs: 5 * MINUTE_MS },
  sendSectionAnnouncement: { limit: 5, windowMs: HOUR_MS },
  getAnnouncementSendRecipients: { limit: 60, windowMs: 5 * MINUTE_MS },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitedCallableName = keyof typeof CALLABLE_RATE_LIMITS;

function isRateLimitExceeded(error: unknown): boolean {
  if (error instanceof Error && error.message.includes(RATE_LIMIT_EXCEEDED_MARKER)) {
    return true;
  }
  if (String(error).includes(RATE_LIMIT_EXCEEDED_MARKER)) {
    return true;
  }
  try {
    return JSON.stringify(error).includes(RATE_LIMIT_EXCEEDED_MARKER);
  } catch {
    return false;
  }
}

/**
 * Consume one request from a callable's per-user fixed-window allowance.
 *
 * Two sequential Data Connect calls, not one: EnsureCallableRateLimitBucket first
 * guarantees the current window's row exists (idempotent upsert, always committed
 * before the next call starts), then ConsumeCallableRateLimit conditionally
 * increments it in its own transaction. `count_update: { inc: 1 }` serializes
 * concurrent increments and a failed in-transaction check rolls the increment back.
 * These cannot be combined into one @transaction — a row created by the upsert is
 * not visible to a same-transaction updateMany's `where` filter, which previously
 * made every call reject unconditionally (see #401).
 */
export async function enforceRateLimit(
  functionName: RateLimitedCallableName,
  callerUid: string
): Promise<void> {
  const { limit, windowMs } = CALLABLE_RATE_LIMITS[functionName];
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();

  await ensureCallableRateLimitBucket({ userId: callerUid, functionName, windowStart });

  try {
    await consumeCallableRateLimit({
      userId: callerUid,
      functionName,
      windowStart,
      limit,
    });
  } catch (error: unknown) {
    if (isRateLimitExceeded(error)) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests — please slow down and try again later."
      );
    }
    throw error;
  }
}
