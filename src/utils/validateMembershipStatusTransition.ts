import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../config/firebase";
import type { MembershipStatus } from "../dataconnect-generated";

interface ValidateMembershipStatusTransitionRequest {
  userId: string;
  newStatus: MembershipStatus;
}

interface ValidateMembershipStatusTransitionResponse {
  allowed: boolean;
  error?: string;
}

/**
 * Validates a membership status transition server-side
 * The function will fetch the current status from the database to prevent client-side bypass
 * @param userId - The user ID whose status is being changed
 * @param newStatus - The desired new membership status
 * @returns Promise with validation result
 */
export async function validateMembershipStatusTransition(
  userId: string,
  newStatus: MembershipStatus
): Promise<{ allowed: boolean; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, "europe-west2");
    const validateCallable = httpsCallable<
      ValidateMembershipStatusTransitionRequest,
      ValidateMembershipStatusTransitionResponse
    >(functions, "validateMembershipStatusTransition");
    
    const result = await validateCallable({ userId, newStatus });
    return { allowed: result.data.allowed, error: result.data.error };
  } catch (error: any) {
    return { 
      allowed: false, 
      error: error?.message || "Failed to validate membership status transition" 
    };
  }
}

