import { type User } from "firebase/auth";

/**
 * Grants admin claim to a user
 * @param currentUser - The currently authenticated user (must have admin claim)
 * @param targetUid - The UID of the user to grant admin to
 * @returns Promise with the result
 */
export async function grantAdminClaim(
  currentUser: User,
  targetUid: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Get the ID token for authentication
    const idToken = await currentUser.getIdToken();

    // Get the function URL - you'll need to set this in your environment or config
    const functionUrl = import.meta.env.VITE_FUNCTIONS_URL || 
      `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/grantAdmin`;

    const response = await fetch(`${functionUrl}?uid=${encodeURIComponent(targetUid)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, message: data.message };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to grant admin claim" 
    };
  }
}

