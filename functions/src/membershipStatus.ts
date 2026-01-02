import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth } from "./helpers";
import { canUserChangeStatus, type MembershipStatus } from "./validation";
import { 
  updateUserMembershipStatus, 
  getUserMembershipStatus,
  type MembershipStatus as AdminMembershipStatus
} from "@dataconnect/admin-generated";

/**
 * Updates membership status with server-side validation and enforcement.
 * This is the only way users can update membershipStatus - it cannot be done via UpsertUser mutation.
 * Users can only update their own status unless they are an admin.
 */
export const updateMembershipStatus = onCall(async (request) => {
  requireAuth(request);

  const { userId, newStatus } = request.data;

  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required and must be a string");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new HttpsError("invalid-argument", "newStatus is required and must be a string");
  }

  const isAdmin = request.auth!.token.admin === true;
  if (!isAdmin && request.auth!.uid !== userId) {
    throw new HttpsError("permission-denied", "Users can only update their own profile");
  }

  try {
    const currentStatus = await fetchCurrentStatusFromDataConnect(userId);
    
    const validation = canUserChangeStatus(
      currentStatus,
      newStatus as MembershipStatus,
      isAdmin
    );
    
    if (!validation.allowed) {
      logger.warn(`Invalid membership status transition attempted: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}`);
      throw new HttpsError("permission-denied", validation.error || "Invalid membership status transition");
    }
    
    await updateMembershipStatusInDataConnect(userId, newStatus as MembershipStatus);
    
    logger.info(`Membership status updated: userId=${userId}, current=${currentStatus || "unknown"}, new=${newStatus}, admin=${isAdmin}`);
    return { success: true, message: "Membership status updated successfully" };
  } catch (e: any) {
    if (e instanceof HttpsError) {
      throw e;
    }
    logger.error("Error updating membership status:", e);
    throw new HttpsError("internal", e?.message ?? "Error updating membership status");
  }
});

/**
 * Updates the membership status in Data Connect using the Admin SDK
 */
async function updateMembershipStatusInDataConnect(
  userId: string,
  membershipStatus: MembershipStatus
): Promise<void> {
  try {
    await updateUserMembershipStatus({
      userId,
      membershipStatus: membershipStatus as AdminMembershipStatus
    });
    logger.info(`Successfully updated membership status for userId=${userId} to ${membershipStatus}`);
  } catch (error: any) {
    logger.error(`Could not update membership status in Data Connect for userId=${userId}:`, error);
    throw error;
  }
}

/**
 * Fetches the current membership status from Data Connect using the Admin SDK
 */
async function fetchCurrentStatusFromDataConnect(
  userId: string
): Promise<MembershipStatus | null> {
  try {
    const result = await getUserMembershipStatus({ id: userId });
    return result.data?.user?.membershipStatus as MembershipStatus | null || null;
  } catch (error: any) {
    logger.warn(`Could not fetch current status from Data Connect for userId=${userId}:`, error);
    return null;
  }
}

