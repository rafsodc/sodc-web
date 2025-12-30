import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../config/firebase";

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

interface ListAdminUsersResponse {
  users: AdminUser[];
}

/**
 * Lists all users from Firebase Auth that have the admin claim
 * @returns Promise with the list of admin users
 */
export async function listAdminUsers(): Promise<{ success: boolean; users?: AdminUser[]; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, "europe-west2");
    const listAdminUsersCallable = httpsCallable<ListAdminUsersResponse>(functions, "listAdminUsers");
    
    const result = await listAdminUsersCallable();
    return { success: true, users: result.data.users };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to list admin users" 
    };
  }
}

