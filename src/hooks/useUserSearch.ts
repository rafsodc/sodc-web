import { useState, useEffect, useCallback } from "react";
import { searchUsers } from "../utils/searchUsers";
import type { SearchUser } from "../types";
import { ITEMS_PER_PAGE } from "../constants";

interface UseUserSearchResult {
  users: SearchUser[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
  setSearchTerm: (term: string) => void;
  searchTerm: string;
  refetch: () => void;
}

/**
 * Custom hook for searching users with pagination
 * @param initialSearchTerm - Optional initial search term (defaults to empty string)
 * @param debounceMs - Debounce delay in milliseconds (defaults to 500)
 * @returns User search state and controls
 */
export function useUserSearch(
  initialSearchTerm: string = "",
  debounceMs: number = 500
): UseUserSearchResult {
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTermState] = useState(initialSearchTerm);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const performSearch = useCallback(async (term: string, pageNum: number = 1) => {
    if (!term.trim()) {
      setUsers([]);
      setError(null);
      setTotalPages(1);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await searchUsers(term, pageNum, ITEMS_PER_PAGE);
      if (result.success && result.data) {
        setUsers(result.data.users);
        setTotalPages(result.data.totalPages);
        setTotal(result.data.total);
      } else {
        setError(result.error || "Failed to search users");
        setUsers([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to search users");
      setUsers([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search - only triggers when searchTerm changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm, 1);
        setPage(1);
      } else {
        // Clear results when search term is empty
        setUsers([]);
        setError(null);
        setTotalPages(1);
        setTotal(0);
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, performSearch, debounceMs]);

  // Handle page changes - only triggers when page changes (not searchTerm)
  // Note: searchTerm is intentionally not in dependencies to avoid bypassing debounce
  // The closure will capture the current searchTerm value when this effect runs
  useEffect(() => {
    if (searchTerm.trim()) {
      performSearch(searchTerm, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, performSearch]); // searchTerm intentionally omitted to prevent immediate searches on typing

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
  }, []);

  const refetch = useCallback(() => {
    performSearch(searchTerm, page);
  }, [searchTerm, page, performSearch]);

  return {
    users,
    loading,
    error,
    page,
    totalPages,
    total,
    setPage,
    setSearchTerm,
    searchTerm,
    refetch,
  };
}

