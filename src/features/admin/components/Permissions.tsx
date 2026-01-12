import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import { listAdminUsers } from "./listAdminUsers";
import type { AdminUser } from "../../../types";
import { grantAdminClaim, revokeAdminClaim } from "../../../shared/utils/firebaseFunctions";
import { colors } from "../../../config/colors";
import { useUserSearch } from "../../users/hooks/useUserSearch";
import { ITEMS_PER_PAGE, SEARCH_DEBOUNCE_MS, ERROR_MESSAGE_TIMEOUT } from "../../../constants";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import UsersTable from "../../users/components/UsersTable";
import AdminUsersTable from "../../users/components/AdminUsersTable";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import UserAccessGroups from "./UserAccessGroups";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import "../../../shared/components/PageContainer.css";

interface PermissionsProps {
  onBack: () => void;
}

export default function Permissions({ onBack }: PermissionsProps) {
  const isAdmin = useAdminClaim(auth.currentUser);
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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

  // Check admin status - show access denied if not admin
  if (!isAdmin) {
    return (
      <Box className="page-container">
        <PageHeader title="Permissions" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Access denied. Admin privileges required to manage permissions.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page-container">
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
        onChange={(_, newValue) => {
          setTabValue(newValue);
          setSelectedUserId(null); // Clear selection when switching tabs
        }} 
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
        <Tab label="Access Groups" />
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

      {tabValue === 2 && (
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
            <Alert severity="info">Enter a search term to find users and manage their access groups</Alert>
          ) : searchResults.length === 0 ? (
            <Alert severity="info">No users found. Try a different search term.</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: colors.titleSecondary }}>
                Select a user to manage their access groups
              </Typography>
              <UsersTable
                users={searchResults}
                mode="admin"
                onGrantAdmin={handleGrantAdmin}
                onRevokeAdmin={handleRevokeAdmin}
                onSelectUser={setSelectedUserId}
                selectedUserId={selectedUserId}
                updatingUserId={updatingUserId}
                adminCount={adminCount}
              />
              {selectedUserId && (
                <Box sx={{ mt: 4, p: 2, border: "1px solid rgba(0, 0, 0, 0.12)", borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Manage Access Groups for {searchResults.find(u => u.uid === selectedUserId)?.displayName || "User"}
                  </Typography>
                  <UserAccessGroups
                    userId={selectedUserId}
                    userEmail={searchResults.find(u => u.uid === selectedUserId)?.email}
                    onUpdate={() => {
                      // Optionally refresh user data
                    }}
                  />
                </Box>
              )}
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

