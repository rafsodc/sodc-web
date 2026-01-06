import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../../../config/firebase";
import type { SearchUsersRequest, SearchUsersResponse } from "../../../types";
import { ITEMS_PER_PAGE } from "../../../constants";

/**
 * Searches for users by email or display name
 * @param searchTerm - The search term to match against email or display name
 * @param page - Page number (1-based)
 * @param pageSize - Number of results per page (default: 25)
 * @returns Promise with the search results
 */
export async function searchUsers(
  searchTerm: string,
  page: number = 1,
  pageSize: number = ITEMS_PER_PAGE
): Promise<{ success: boolean; data?: SearchUsersResponse; error?: string }> {
  try {
    const functions = getFunctions(firebaseApp, "europe-west2");
    const searchUsersCallable = httpsCallable<SearchUsersRequest, SearchUsersResponse>(
      functions,
      "searchUsers"
    );
    
    const result = await searchUsersCallable({ searchTerm, page, pageSize });
    return { success: true, data: result.data };
  } catch (error: any) {
    return { 
      success: false, 
      error: error?.message || "Failed to search users" 
    };
  }
}

