import { useState, useEffect, useCallback, useRef } from "react";
import { useUserSearch } from "../hooks/useUserSearch";
import {
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Pagination,
  Stack,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from "@mui/material";
import { Refresh, CheckCircle } from "@mui/icons-material";
import { listAdminUsers, type AdminUser } from "../utils/listAdminUsers";
import { grantAdminClaim } from "../utils/grantAdmin";
import { revokeAdminClaim } from "../utils/revokeAdmin";
import { colors } from "../config/colors";
import UsersTable from "./UsersTable";
import "./Permissions.css";

interface PermissionsProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 25;

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
  } = useUserSearch("", 500);

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

  const handleSearchPageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
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
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const handleRevokeAdmin = async (uid: string) => {
    // Check if this would be the last admin
    if (adminCount <= 1) {
      setUpdateMessage({ 
        type: "error", 
        text: "Cannot remove the last admin. At least one admin must remain." 
      });
      setTimeout(() => setUpdateMessage(null), 5000);
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
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  return (
    <Box className="permissions-container">
      <Box className="permissions-header">
        <Typography variant="h4" className="permissions-title">
          Permissions
        </Typography>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
      </Box>

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
          <Box className="filters-container">
            <TextField
              label="Filter by Email or Display Name"
              variant="outlined"
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="email-filter"
              size="small"
              placeholder="Enter email or name..."
            />
            <Tooltip title="Refresh admin users list">
              <IconButton onClick={fetchAdminUsers} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>

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
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Display Name</TableCell>
                      <TableCell>Email Verified</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedAdminUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No admin users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedAdminUsers.map((user) => (
                        <TableRow key={user.uid}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.displayName || "-"}</TableCell>
                          <TableCell>
                            {user.emailVerified ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Typography variant="body2" color="textSecondary">
                                Not verified
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.disabled ? (
                              <Typography variant="body2" color="error">
                                Disabled
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="success.main">
                                Active
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleRevokeAdmin(user.uid)}
                              disabled={updatingUserId === user.uid || filteredAdminUsers.length <= 1}
                              title={filteredAdminUsers.length <= 1 ? "Cannot remove the last admin" : "Revoke admin"}
                            >
                              {updatingUserId === user.uid ? (
                                <CircularProgress size={16} />
                              ) : (
                                "Revoke Admin"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {adminTotalPages > 1 && (
                <Stack spacing={2} sx={{ mt: 3, alignItems: "center" }}>
                  <Pagination
                    count={adminTotalPages}
                    page={adminPage}
                    onChange={(_, newPage) => setAdminPage(newPage)}
                    color="primary"
                  />
                </Stack>
              )}
            </>
          )}
        </>
      )}

      {tabValue === 1 && (
        <>
          <Box className="filters-container">
            <TextField
              label="Search by Email or Display Name"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="email-filter"
              size="small"
              placeholder="Enter search term..."
            />
          </Box>

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
              {searchTotalPages > 1 && (
                <Stack spacing={2} sx={{ mt: 3, alignItems: "center" }}>
                  <Pagination
                    count={searchTotalPages}
                    page={searchPage}
                    onChange={handleSearchPageChange}
                    color="primary"
                  />
                </Stack>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}

