import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../config/firebase";

interface UpdateUserDisplayNameRequest {
  userId: string;
  displayName: string;
}

interface UpdateUserDisplayNameResponse {
  success: boolean;
}

/**
 * Updates the displayName in Firebase Auth for a specific user (admin only)
 * @param userId - The user ID to update
 * @param displayName - The display name to set (e.g., "Doe, John")
 * @returns Promise with the result
 */
export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, "europe-west2");
    const updateUserDisplayNameCallable = httpsCallable<UpdateUserDisplayNameRequest, UpdateUserDisplayNameResponse>(
      functions,
      "updateUserDisplayName"
    );
    
    const result = await updateUserDisplayNameCallable({ userId, displayName });
    return { success: result.data.success };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to update user display name" 
    };
  }
}

