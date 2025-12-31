import { useState } from "react";
import {
  Box,
  Button,
  TextField,
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
import { Refresh } from "@mui/icons-material";
import { dataConnect } from "../config/firebase";
import { type SearchUser } from "../utils/searchUsers";
import { getUserById, updateUser, type UpdateUserVariables, type MembershipStatus as GeneratedMembershipStatus } from "../dataconnect-generated";
import { colors } from "../config/colors";
import { useUserSearch } from "../hooks/useUserSearch";
import UsersTable from "./UsersTable";
import "./ManageUsers.css";

interface ManageUsersProps {
  onBack: () => void;
}

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
  const {
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
  } = useUserSearch("", 500);

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

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
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
        membershipStatus: membershipStatus as GeneratedMembershipStatus | null | undefined,
      };
      await updateUser(dataConnect, vars);
      setUpdateMessage({ type: "success", text: "User profile updated successfully" });
      // Refresh the current page
      refetch();
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
          <IconButton onClick={refetch} disabled={loading}>
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
          <UsersTable
            users={users}
            mode="edit"
            onEdit={handleEdit}
            disabled={submitting}
          />
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

