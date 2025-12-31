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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Edit, Refresh, CheckCircle } from "@mui/icons-material";
import { dataConnect } from "../config/firebase";
import { searchUsers, type SearchUser } from "../utils/searchUsers";
import { getUserById, updateUser, type UpdateUserVariables } from "../dataconnect-generated";
import { colors } from "../config/colors";
import "./ManageUsers.css";

interface ManageUsersProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 25;

const MEMBERSHIP_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "SERVING", label: "Serving" },
  { value: "RETIRED", label: "Retired" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "LOST", label: "Lost" },
  { value: "DECEASED", label: "Deceased" },
] as const;

type MembershipStatus = "PENDING" | "SERVING" | "RETIRED" | "RESIGNED" | "LOST" | "DECEASED";

export default function ManageUsers({ onBack }: ManageUsersProps) {
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SearchUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>("PENDING");

  // Search users - requires a search term, so we'll use a wildcard approach for "all users"
  const fetchUsers = useCallback(async (term: string, pageNum: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      // If no search term, use a very common character to get all users
      const searchQuery = term.trim() || "a";
      const result = await searchUsers(searchQuery, pageNum, ITEMS_PER_PAGE);
      if (result.success && result.data) {
        setUsers(result.data.users);
        setTotalPages(result.data.totalPages);
        setTotal(result.data.total);
      } else {
        setError(result.error || "Failed to fetch users");
        setUsers([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial users on mount and handle debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchTerm, 1);
      setPage(1);
    }, searchTerm ? 500 : 0); // No delay for initial load, 500ms delay for search

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]); // fetchUsers is stable (memoized), so we don't need it in deps

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
    fetchUsers(searchTerm, newPage);
  };

  const handleEdit = async (user: SearchUser) => {
    setSubmitting(true);
    // Fetch full user data from Data Connect to get all profile fields
    try {
      const userResult = await getUserById(dataConnect, { id: user.uid });
      if (userResult.data?.user) {
        const fullUser = userResult.data.user;
        setEditingUser(user);
        setFirstName(fullUser.firstName || "");
        setLastName(fullUser.lastName || "");
        setEmail(fullUser.email || user.email || "");
        setServiceNumber(fullUser.serviceNumber || "");
        setMembershipStatus(fullUser.membershipStatus || "PENDING");
        setEditDialogOpen(true);
      } else {
        // Fallback if user doesn't exist in Data Connect yet
        setEditingUser(user);
        const nameParts = user.displayName?.split(", ") || user.displayName?.split(" ") || [];
        setFirstName(nameParts[1] || nameParts[0] || "");
        setLastName(nameParts[0] || nameParts.slice(1).join(" ") || "");
        setEmail(user.email || "");
        setServiceNumber("");
        setMembershipStatus("PENDING");
        setEditDialogOpen(true);
      }
    } catch (err) {
      // Fallback if getUserById fails
      setEditingUser(user);
      const nameParts = user.displayName?.split(", ") || user.displayName?.split(" ") || [];
      setFirstName(nameParts[1] || nameParts[0] || "");
      setLastName(nameParts[0] || nameParts.slice(1).join(" ") || "");
      setEmail(user.email || "");
      setServiceNumber("");
      setMembershipStatus("PENDING");
      setEditDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setEditingUser(null);
    setUpdateMessage(null);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setSubmitting(true);
    setUpdateMessage(null);
    try {
      const vars: UpdateUserVariables = {
        userId: editingUser.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        serviceNumber: serviceNumber.trim(),
        membershipStatus: membershipStatus,
      };
      await updateUser(dataConnect, vars);
      setUpdateMessage({ type: "success", text: "User profile updated successfully" });
      // Refresh the current page
      await fetchUsers(searchTerm, page);
      setTimeout(() => {
        handleCloseEdit();
      }, 1500);
    } catch (err: any) {
      setUpdateMessage({ type: "error", text: err?.message || "Failed to update user profile" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="manage-users-container">
      <Box className="manage-users-header">
        <Typography variant="h4" className="manage-users-title">
          Manage Users
        </Typography>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
      </Box>

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
        <Tooltip title="Refresh users list">
          <IconButton onClick={() => fetchUsers(searchTerm, page)} disabled={loading}>
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
            Showing {users.length} of {total} users (page {page} of {totalPages})
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Email Verified</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>{user.displayName || "-"}</TableCell>
                      <TableCell>{user.email}</TableCell>
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
                        {user.customClaims?.admin === true ? (
                          <CheckCircle color="success" />
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            No
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
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(user)}
                          title="Edit user"
                          disabled={submitting}
                        >
                          <Edit />
                        </IconButton>
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
                onChange={handlePageChange}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}

      <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User Profile</DialogTitle>
        <DialogContent>
          {updateMessage && (
            <Alert severity={updateMessage.type} sx={{ mb: 2 }}>
              {updateMessage.text}
            </Alert>
          )}
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              fullWidth
              disabled={submitting}
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              fullWidth
              disabled={submitting}
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              disabled={submitting}
            />
            <TextField
              label="Service Number"
              value={serviceNumber}
              onChange={(e) => setServiceNumber(e.target.value)}
              required
              fullWidth
              disabled={submitting}
            />
            <FormControl fullWidth required>
              <InputLabel>Membership Status</InputLabel>
              <Select
                value={membershipStatus}
                label="Membership Status"
                onChange={(e) => setMembershipStatus(e.target.value as MembershipStatus)}
                disabled={submitting}
              >
                {MEMBERSHIP_STATUSES.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              submitting ||
              !firstName.trim() ||
              !lastName.trim() ||
              !email.trim() ||
              !serviceNumber.trim()
            }
            sx={{
              backgroundColor: colors.callToAction,
              "&:hover": {
                backgroundColor: colors.callToAction,
                opacity: 0.9,
              },
            }}
          >
            {submitting ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

