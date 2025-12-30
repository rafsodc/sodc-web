import { type User } from "firebase/auth";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime: string | null;
  };
}

/**
 * Lists all users from Firebase Auth that have the admin claim
 * @param currentUser - The currently authenticated user (must have admin claim)
 * @returns Promise with the list of admin users
 */
export async function listAdminUsers(
  currentUser: User
): Promise<{ success: boolean; users?: AdminUser[]; error?: string }> {
  try {
    // Get the ID token for authentication
    const idToken = await currentUser.getIdToken();

    // Get the function URL - you'll need to set this in your environment or config
    const functionUrl = import.meta.env.VITE_FUNCTIONS_URL || 
      `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/listAdminUsers`;

    const response = await fetch(functionUrl, {
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
    return { success: true, users: data.users };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to list admin users" 
    };
  }
}

