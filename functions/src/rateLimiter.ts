import { HttpsError } from "firebase-functions/v2/https";
import { getCallableInvocation, upsertCallableInvocation } from "@dataconnect/admin-generated";

export interface RateLimitOptions {
  /** Max calls allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

/**
 * Per-user fixed-window rate limit for high-risk callable functions (see #344).
 *
 * Throws HttpsError("resource-exhausted") once callerUid has made `limit` calls to
 * `functionName` within the current window. One row per (userId, functionName) is kept in
 * Data Connect, overwritten every window — there's no per-window accumulation to clean up.
 *
 * Not perfectly atomic under concurrent requests from the same user (read-then-write can
 * race), which is an accepted tradeoff for a coarse abuse-prevention control rather than a
 * hard billing-critical cap.
 */
export async function enforceRateLimit(
  functionName: string,
  callerUid: string,
  { limit, windowMs }: RateLimitOptions
): Promise<void> {
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();

  const existing = await getCallableInvocation({ userId: callerUid, functionName });
  const row = existing.data?.callableInvocation;
  // Compare parsed timestamps rather than exact strings — Postgres/Data Connect may not
  // round-trip the same ISO string formatting (precision, offset) that toISOString() produces.
  const inCurrentWindow = row ? new Date(row.windowStart).getTime() === windowStartMs : false;
  const currentCount = inCurrentWindow ? row!.count : 0;

  if (currentCount >= limit) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests — please slow down and try again later."
    );
  }

  await upsertCallableInvocation({
    userId: callerUid,
    functionName,
    windowStart,
    count: currentCount + 1,
  });
}
