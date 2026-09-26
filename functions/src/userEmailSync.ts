import { randomUUID } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  acquireUserEmailLease,
  getUserById,
  releaseUserEmailLease,
  updateUserEmailFromAuth,
} from "@dataconnect/admin-generated";

// Callables using this helper have a 60-second timeout. Leave ample time for
// in-flight requests to settle before another invocation can acquire the lease.
const LEASE_MS = 5 * 60 * 1000;

export async function withUserEmailLease<T>(
  userId: string,
  work: (writeEmail: (email: string, changedBy: string) => Promise<void>) => Promise<T>,
): Promise<T> {
  const profile = await getUserById({ id: userId });
  if (!profile.data.user) {
    throw new HttpsError("not-found", "The user profile could not be found.");
  }
  const leaseId = randomUUID();
  try {
    await acquireUserEmailLease({
      userId,
      leaseId,
      expiresAt: new Date(Date.now() + LEASE_MS).toISOString(),
    });
  } catch (error) {
    if (String(error).includes("EMAIL_CHANGE_BUSY")) {
      throw new HttpsError("aborted", "An email update is in progress. Please retry in five minutes.", {
        code: "EMAIL_CHANGE_BUSY",
      });
    }
    throw error;
  }
  try {
    return await work(async (email, changedBy) => {
      await updateUserEmailFromAuth({ userId, email, leaseId, changedBy });
    });
  } finally {
    try {
      await releaseUserEmailLease({ userId, leaseId });
    } catch {
      // The expiring lease remains safe to retry after a process/network failure.
      logger.warn("user-email lease release failed", { userId, leaseId });
    }
  }
}
