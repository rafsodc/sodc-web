import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../../../config/firebase";
import type { AdminUser } from "../../../types";
import { reportError } from "../../../shared/errors";

export type { AdminUser };

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
    const data = result.data as ListAdminUsersResponse;
    return { success: true, users: data.users };
  } catch (error: unknown) {
    reportError("admin.users.list-admins", error);
    return { 
      success: false, 
      error: "Administrator accounts could not be loaded. Please try again."
    };
  }
}
