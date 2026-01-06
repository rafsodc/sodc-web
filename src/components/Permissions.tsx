import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import { listAdminUsers } from "../utils/listAdminUsers";
import type { AdminUser } from "../types";
import { grantAdminClaim, revokeAdminClaim } from "../shared/utils/firebaseFunctions";
import { colors } from "../config/colors";
import { useUserSearch } from "../hooks/useUserSearch";
import { ITEMS_PER_PAGE, SEARCH_DEBOUNCE_MS, ERROR_MESSAGE_TIMEOUT } from "../constants";
import PageHeader from "./PageHeader";
import SearchBar from "./SearchBar";
import UsersTable from "./UsersTable";
import AdminUsersTable from "./AdminUsersTable";
import PaginationDisplay from "./PaginationDisplay";
import "./Permissions.css";

interface PermissionsProps {
  onBack: () => void;
}

export default function Permissions({ onBack }: PermissionsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [filteredAdminUsers, setFilteredAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [adminCount, setAdminCount] = useState(0);
  const fetchingRef = useRef(false);

  // Use the shared user search hook for the search tab
  const {
    users: searchResults,
    loading: searchLoading,
    error: searchError,
    page: searchPage,
    totalPages: searchTotalPages,
    total: searchTotal,
    setPage: setSearchPage,
    setSearchTerm,
    searchTerm,
    refetch: refetchSearch,
  } = useUserSearch("", SEARCH_DEBOUNCE_MS);

  const fetchAdminUsers = useCallback(async () => {
    // Prevent duplicate concurrent calls
    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers();
      if (result.success && result.users) {
        setAdminUsers(result.users);
        setAdminCount(result.users.length);
      } else {
        setError(result.error || "Failed to fetch admin users");
        setAdminUsers([]);
        setAdminCount(0);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch admin users");
      setAdminUsers([]);
      setAdminCount(0);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAdminUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchAdminUsers is stable (memoized), so we don't need it in deps

  // Refresh search results when switching to the search tab
  useEffect(() => {
    if (tabValue === 1 && searchTerm.trim()) {
      refetchSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue]); // Only refresh when tab changes, not on every searchTerm change

  // Filter admin users based on email or display name
  useEffect(() => {
    let filtered = [...adminUsers];

    // Filter by email or display name
    if (adminFilter.trim()) {
      const filterLower = adminFilter.toLowerCase();
      filtered = filtered.filter((user) => {
        const emailMatch = user.email?.toLowerCase().includes(filterLower);
        const displayNameMatch = user.displayName?.toLowerCase().includes(filterLower);
        return emailMatch || displayNameMatch;
      });
    }

    setFilteredAdminUsers(filtered);
    setAdminPage(1); // Reset to first page when filters change
  }, [adminUsers, adminFilter]);

  // Admin pagination
  const adminTotalPages = Math.ceil(filteredAdminUsers.length / ITEMS_PER_PAGE);
  const adminStartIndex = (adminPage - 1) * ITEMS_PER_PAGE;
  const paginatedAdminUsers = filteredAdminUsers.slice(adminStartIndex, adminStartIndex + ITEMS_PER_PAGE);

  const handleSearchPageChange = (newPage: number) => {
    setSearchPage(newPage);
  };

  const handleGrantAdmin = async (uid: string) => {
    setUpdatingUserId(uid);
    setUpdateMessage(null);
    try {
      const result = await grantAdminClaim(uid);
      if (result.success) {
        setUpdateMessage({ type: "success", text: result.message || "Admin claim granted successfully" });
        // Refresh both lists
        await fetchAdminUsers();
        if (tabValue === 1 && searchTerm.trim()) {
          refetchSearch();
        }
      } else {
        setUpdateMessage({ type: "error", text: result.error || "Failed to grant admin claim" });
      }
    } catch (err: any) {
      setUpdateMessage({ type: "error", text: err?.message || "Failed to grant admin claim" });
    } finally {
      setUpdatingUserId(null);
      setTimeout(() => setUpdateMessage(null), ERROR_MESSAGE_TIMEOUT);
    }
  };

  const handleRevokeAdmin = async (uid: string) => {
    // Check if this would be the last admin
    if (adminCount <= 1) {
      setUpdateMessage({ 
        type: "error", 
        text: "Cannot remove the last admin. At least one admin must remain." 
      });
      setTimeout(() => setUpdateMessage(null), ERROR_MESSAGE_TIMEOUT);
      return;
    }

    setUpdatingUserId(uid);
    setUpdateMessage(null);
    try {
      const result = await revokeAdminClaim(uid);
      if (result.success) {
        setUpdateMessage({ type: "success", text: result.message || "Admin claim revoked successfully" });
        // Refresh both lists
        await fetchAdminUsers();
        if (tabValue === 1 && searchTerm.trim()) {
          refetchSearch();
        }
      } else {
        setUpdateMessage({ type: "error", text: result.error || "Failed to revoke admin claim" });
      }
    } catch (err: any) {
      // Handle the error from the server (e.g., "Cannot remove the last admin")
      const errorMessage = err?.message || "Failed to revoke admin claim";
      setUpdateMessage({ type: "error", text: errorMessage });
    } finally {
      setUpdatingUserId(null);
      setTimeout(() => setUpdateMessage(null), ERROR_MESSAGE_TIMEOUT);
    }
  };

  return (
    <Box className="permissions-container">
      <PageHeader title="Permissions" onBack={onBack} />

      {updateMessage && (
        <Alert
          severity={updateMessage.type}
          onClose={() => setUpdateMessage(null)}
          sx={{ mb: 2 }}
        >
          {updateMessage.text}
        </Alert>
      )}

      <Tabs 
        value={tabValue} 
        onChange={(_, newValue) => setTabValue(newValue)} 
        sx={{ 
          mb: 3,
          "& .MuiTab-root": {
            "&:focus": {
              outline: "none",
            },
            "&:focus-visible": {
              outline: "none",
            },
          },
        }}
      >
        <Tab label="Admin Users" />
        <Tab label="Search Users" />
      </Tabs>

      {tabValue === 0 && (
        <>
          <SearchBar
            value={adminFilter}
            onChange={setAdminFilter}
            onRefresh={fetchAdminUsers}
            loading={loading}
            label="Filter by Email or Display Name"
            placeholder="Enter email or name..."
          />

          {loading ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: colors.titleSecondary }}>
                Showing {paginatedAdminUsers.length} of {filteredAdminUsers.length} admin users
              </Typography>
              <AdminUsersTable
                users={paginatedAdminUsers}
                onRevokeAdmin={handleRevokeAdmin}
                updatingUserId={updatingUserId}
                canRevoke={filteredAdminUsers.length > 1}
              />
              <PaginationDisplay
                page={adminPage}
                totalPages={adminTotalPages}
                onChange={(newPage) => setAdminPage(newPage)}
              />
            </>
          )}
        </>
      )}

      {tabValue === 1 && (
        <>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onRefresh={refetchSearch}
            loading={searchLoading}
          />

          {searchLoading ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : searchError ? (
            <Alert severity="error">{searchError}</Alert>
          ) : searchTerm.trim() === "" ? (
            <Alert severity="info">Enter a search term to find users</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: colors.titleSecondary }}>
                Showing {searchResults.length} of {searchTotal} users (page {searchPage} of {searchTotalPages})
              </Typography>
              <UsersTable
                users={searchResults}
                mode="admin"
                onGrantAdmin={handleGrantAdmin}
                onRevokeAdmin={handleRevokeAdmin}
                updatingUserId={updatingUserId}
                adminCount={adminCount}
              />
              <PaginationDisplay
                page={searchPage}
                totalPages={searchTotalPages}
                onChange={handleSearchPageChange}
              />
            </>
          )}
        </>
      )}
    </Box>
  );
}

