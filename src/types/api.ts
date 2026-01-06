import { type SearchUser } from "./user";

/**
 * Search users request
 */
export interface SearchUsersRequest {
  searchTerm: string;
  page?: number;
  pageSize?: number;
}

/**
 * Search users response
 */
export interface SearchUsersResponse {
  users: SearchUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Generic API response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

