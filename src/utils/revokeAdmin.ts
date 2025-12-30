import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../config/firebase";

interface RevokeAdminRequest {
  uid: string;
}

interface RevokeAdminResponse {
  success: boolean;
  message?: string;
}

/**
 * Revokes admin claim from a user
 * @param uid - The UID of the user to revoke admin from
 * @returns Promise with the result
 */
export async function revokeAdminClaim(
  uid: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, "europe-west2");
    const revokeAdminCallable = httpsCallable<RevokeAdminRequest, RevokeAdminResponse>(
      functions,
      "revokeAdmin"
    );
    
    const result = await revokeAdminCallable({ uid });
    return { success: true, message: result.data.message };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to revoke admin claim" 
    };
  }
}

