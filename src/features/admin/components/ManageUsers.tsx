import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import type { AdminUser, SearchUser } from "../../../types";
import { useUserSearch } from "../../users/hooks/useUserSearch";
import {
  ITEMS_PER_PAGE,
  SEARCH_DEBOUNCE_MS,
  ERROR_MESSAGE_TIMEOUT,
} from "../../../constants";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import UsersTable from "../../users/components/UsersTable";
import AdminUsersTable from "../../users/components/AdminUsersTable";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import EditUserDialog from "../../profile/components/EditUserDialog";
import UserGroupMemberships from "./UserGroupMemberships";
import { listAdminUsers } from "./listAdminUsers";
import { grantAdminClaim, revokeAdminClaim } from "../../../shared/utils/firebaseFunctions";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import "../../../shared/components/PageContainer.css";

interface ManageUsersProps {
  onBack: () => void;
}

export default function ManageUsers({ onBack }: ManageUsersProps) {
  const isAdmin = useAdminClaim(auth.currentUser);
  const [tabValue, setTabValue] = useState(0);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [filteredAdminUsers, setFilteredAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [adminListError, setAdminListError] = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [adminCount, setAdminCount] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const fetchingRef = useRef(false);

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

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SearchUser | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAdminUsers = useCallback(async () => {
    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    setLoadingAdmins(true);
    setAdminListError(null);
    try {
      const result = await listAdminUsers();
      if (result.success && result.users) {
        setAdminUsers(result.users);
        setAdminCount(result.users.length);
      } else {
        setAdminListError(result.error || "Failed to fetch admin users");
        setAdminUsers([]);
        setAdminCount(0);
      }
    } catch (err: unknown) {
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Failed to fetch admin users";
      setAdminListError(message);
      setAdminUsers([]);
      setAdminCount(0);
    } finally {
      setLoadingAdmins(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  useEffect(() => {
    if (tabValue === 0 && searchTerm.trim()) {
      refetchSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue]);

  useEffect(() => {
    let filtered = [...adminUsers];
    if (adminFilter.trim()) {
      const filterLower = adminFilter.toLowerCase();
      filtered = filtered.filter((user) => {
        const emailMatch = user.email?.toLowerCase().includes(filterLower);
        const displayNameMatch = user.displayName?.toLowerCase().includes(filterLower);
        return emailMatch || displayNameMatch;
      });
    }
    setFilteredAdminUsers(filtered);
    setAdminPage(1);
  }, [adminUsers, adminFilter]);

  const adminTotalPages = Math.ceil(filteredAdminUsers.length / ITEMS_PER_PAGE);
  const adminStartIndex = (adminPage - 1) * ITEMS_PER_PAGE;
  const paginatedAdminUsers = filteredAdminUsers.slice(
    adminStartIndex,
    adminStartIndex + ITEMS_PER_PAGE
  );

  const handleSearchPageChange = (newPage: number) => {
    setSearchPage(newPage);
  };

  const handleGrantAdmin = async (uid: string) => {
    setUpdatingUserId(uid);
    setUpdateMessage(null);
    try {
      const result = await grantAdminClaim(uid);
      if (result.success) {
        setUpdateMessage({
          type: "success",
          text: result.message || "Admin claim granted successfully",
        });
        await fetchAdminUsers();
        if (tabValue === 0 && searchTerm.trim()) {
          refetchSearch();
        }
      } else {
        setUpdateMessage({
          type: "error",
          text: result.error || "Failed to grant admin claim",
        });
      }
    } catch (err: unknown) {
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Failed to grant admin claim";
      setUpdateMessage({ type: "error", text: message });
    } finally {
      setUpdatingUserId(null);
      setTimeout(() => setUpdateMessage(null), ERROR_MESSAGE_TIMEOUT);
    }
  };

  const handleRevokeAdmin = async (uid: string) => {
    if (adminCount <= 1) {
      setUpdateMessage({
        type: "error",
        text: "Cannot remove the last admin. At least one admin must remain.",
      });
      setTimeout(() => setUpdateMessage(null), ERROR_MESSAGE_TIMEOUT);
      return;
    }

    setUpdatingUserId(uid);
    setUpdateMessage(null);
    try {
      const result = await revokeAdminClaim(uid);
      if (result.success) {
        setUpdateMessage({
          type: "success",
          text: result.message || "Admin claim revoked successfully",
        });
        await fetchAdminUsers();
        if (tabValue === 0 && searchTerm.trim()) {
          refetchSearch();
        }
      } else {
        setUpdateMessage({
          type: "error",
          text: result.error || "Failed to revoke admin claim",
        });
      }
    } catch (err: unknown) {
      const errorMessage =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Failed to revoke admin claim";
      setUpdateMessage({ type: "error", text: errorMessage });
    } finally {
      setUpdatingUserId(null);
      setTimeout(() => setUpdateMessage(null), ERROR_MESSAGE_TIMEOUT);
    }
  };

  const handleEdit = (user: SearchUser) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setEditingUser(null);
  };

  const handleSaveEdit = () => {
    refetchSearch();
    void fetchAdminUsers();
  };

  const handleSuccessSnackbar = (message: string) => {
    setSuccessMessage(message);
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage(null);
  };

  if (!isAdmin) {
    return (
      <Box className="page-container">
        <PageHeader title="Manage Users" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Access denied. Admin privileges required.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <PageHeader title="Manage Users" onBack={onBack} />

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
          setSelectedUserId(null);
        }}
        sx={{
          mb: 3,
          "& .MuiTab-root": {
            "&:focus": { outline: "none" },
            "&:focus-visible": { outline: "none" },
          },
        }}
      >
        <Tab label="Search users" />
        <Tab label="Administrators" />
      </Tabs>

      {tabValue === 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search for a user, then use <strong>Edit User</strong> for profile details,{" "}
            <strong>Edit Groups</strong> to manage their user groups, or <strong>Grant Admin</strong> /{" "}
            <strong>Revoke Admin</strong> as needed.
          </Typography>
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
            <Alert severity="info">Enter a search term to find users.</Alert>
          ) : searchResults.length === 0 ? (
            <Alert severity="info">No users found. Try a different search term.</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                Showing {searchResults.length} of {searchTotal} users (page {searchPage} of{" "}
                {searchTotalPages})
              </Typography>
              <UsersTable
                users={searchResults}
                mode="admin"
                onEdit={handleEdit}
                onEditGroups={(u) => setSelectedUserId(u.uid)}
                onGrantAdmin={handleGrantAdmin}
                onRevokeAdmin={handleRevokeAdmin}
                selectedUserId={selectedUserId}
                updatingUserId={updatingUserId}
                adminCount={adminCount}
              />
              <PaginationDisplay
                page={searchPage}
                totalPages={searchTotalPages}
                onChange={handleSearchPageChange}
              />
              {selectedUserId && (
                <Box
                  sx={{
                    mt: 4,
                    p: 2,
                    border: "1px solid rgba(0, 0, 0, 0.12)",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    User groups —{" "}
                    {searchResults.find((u) => u.uid === selectedUserId)?.displayName || "User"}
                  </Typography>
                  <UserGroupMemberships
                    userId={selectedUserId}
                    userEmail={searchResults.find((u) => u.uid === selectedUserId)?.email}
                    onUpdate={() => {
                      refetchSearch();
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}

      {tabValue === 1 && (
        <>
          <SearchBar
            value={adminFilter}
            onChange={setAdminFilter}
            onRefresh={fetchAdminUsers}
            loading={loadingAdmins}
            label="Filter by email or display name"
            placeholder="Enter email or name..."
          />

          {loadingAdmins ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : adminListError ? (
            <Alert severity="error">{adminListError}</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                Showing {paginatedAdminUsers.length} of {filteredAdminUsers.length} administrators
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

      <EditUserDialog
        open={editDialogOpen}
        user={editingUser}
        onClose={handleCloseEdit}
        onSave={handleSaveEdit}
        onSuccess={handleSuccessSnackbar}
      />

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: "100%" }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
