import { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import { CheckCircle, Refresh } from "@mui/icons-material";
import { type User } from "firebase/auth";
import { listAdminUsers, type AdminUser } from "../utils/listAdminUsers";
import { grantAdminClaim } from "../utils/grantAdmin";
import { colors } from "../config/colors";
import "./Permissions.css";

interface PermissionsProps {
  currentUser: User;
  onBack: () => void;
}

const ITEMS_PER_PAGE = 20;

export default function Permissions({ currentUser, onBack }: PermissionsProps) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState("");
  const [page, setPage] = useState(1);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAdminUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers(currentUser);
      if (result.success && result.users) {
        setAdminUsers(result.users);
      } else {
        setError(result.error || "Failed to fetch admin users");
        setAdminUsers([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch admin users");
      setAdminUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  // Filter users based on email
  useEffect(() => {
    let filtered = [...adminUsers];

    // Filter by email
    if (emailFilter.trim()) {
      const emailLower = emailFilter.toLowerCase();
      filtered = filtered.filter((user) =>
        user.email?.toLowerCase().includes(emailLower)
      );
    }

    setFilteredUsers(filtered);
    setPage(1); // Reset to first page when filters change
  }, [adminUsers, emailFilter]);

  const handleGrantAdmin = async (userId: string) => {
    setUpdatingUserId(userId);
    setUpdateMessage(null);
    try {
      const result = await grantAdminClaim(currentUser, userId);
      if (result.success) {
        setUpdateMessage({ type: "success", text: "Admin claim granted successfully" });
        // Refresh the admin users list
        await fetchAdminUsers();
      } else {
        setUpdateMessage({ type: "error", text: result.error || "Failed to grant admin claim" });
      }
    } catch (err: any) {
      setUpdateMessage({ type: "error", text: err?.message || "Failed to grant admin claim" });
    } finally {
      setUpdatingUserId(null);
      // Clear message after 5 seconds
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

      <Box className="filters-container">
        <TextField
          label="Filter by Email"
          variant="outlined"
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="email-filter"
          size="small"
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
            Showing {paginatedUsers.length} of {filteredUsers.length} admin users
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Email Verified</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No admin users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {totalPages > 1 && (
            <Stack spacing={2} sx={{ mt: 3, alignItems: "center" }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}

