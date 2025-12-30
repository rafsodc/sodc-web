import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../config/firebase";

interface UpdateDisplayNameRequest {
  displayName: string;
}

interface UpdateDisplayNameResponse {
  success: boolean;
}

/**
 * Updates the displayName in Firebase Auth for the current user
 * @param displayName - The display name to set (e.g., "John Doe")
 * @returns Promise with the result
 */
export async function updateDisplayName(
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, "europe-west2");
    const updateDisplayNameCallable = httpsCallable<UpdateDisplayNameRequest, UpdateDisplayNameResponse>(
      functions,
      "updateDisplayName"
    );
    
    const result = await updateDisplayNameCallable({ displayName });
    return { success: result.data.success };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to update display name" 
    };
  }
}

