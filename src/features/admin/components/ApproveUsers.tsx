import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from "@mui/material";
import { Visibility, CheckCircle } from "@mui/icons-material";
import { executeQuery } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import { listUsersRef } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import EditUserDialog from "../../profile/components/EditUserDialog";
import { MEMBERSHIP_STATUS_OPTIONS } from "../../../constants";
import { MembershipStatus } from "@dataconnect/generated";
import type { SearchUser, PendingUser } from "../../../types";
import { updateMembershipStatus } from "../../../shared/utils/firebaseFunctions";
import { Snackbar } from "@mui/material";
import "./ApproveUsers.css";

interface ApproveUsersProps {
  onBack: () => void;
}

export default function ApproveUsers({ onBack }: ApproveUsersProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<SearchUser | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = listUsersRef(dataConnect);
      const result = await executeQuery(ref);
      if (!result.data) {
        throw new Error("Failed to fetch users");
      }
      // Filter for users with PENDING status
      const pending = (result.data?.users || []).filter(
        (user) => user.membershipStatus === MembershipStatus.PENDING
      ) as PendingUser[];
      setPendingUsers(pending);
    } catch (err: any) {
      setError(err?.message || "Failed to load pending users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleViewProfile = (user: PendingUser) => {
    // Convert PendingUser to SearchUser format for EditUserDialog
    const searchUser: SearchUser = {
      uid: user.id,
      email: user.email,
      displayName: `${user.lastName}, ${user.firstName}`,
      emailVerified: true, // Assume verified since they completed profile
      disabled: false,
      metadata: {
        creationTime: user.createdAt || new Date().toISOString(),
        lastSignInTime: null,
      },
      customClaims: {
        admin: false,
        enabled: false, // Pending users are not enabled
      },
    };
    setViewingUser(searchUser);
    setViewDialogOpen(true);
  };

  const handleCloseView = () => {
    setViewDialogOpen(false);
    setViewingUser(null);
  };

  const handleSave = () => {
    // Refetch pending users after approval
    fetchPendingUsers();
  };

  const handleAccept = async (user: PendingUser) => {
    if (!user.requestedMembershipStatus) {
      setErrorMessage("User has not specified a requested membership status");
      return;
    }

    setApprovingUserId(user.id);
    setErrorMessage(null);
    
    try {
      const result = await updateMembershipStatus(user.id, user.requestedMembershipStatus as MembershipStatus);
      if (result.success) {
        setSuccessMessage(`User ${user.firstName} ${user.lastName} has been approved with status: ${getRequestedStatusLabel(user.requestedMembershipStatus)}`);
        // Refetch pending users to remove the approved user from the list
        await fetchPendingUsers();
      } else {
        setErrorMessage(result.error || "Failed to approve user");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to approve user");
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const getRequestedStatusLabel = (status: string | null | undefined) => {
    if (!status) return "Not specified";
    const option = MEMBERSHIP_STATUS_OPTIONS.find((opt) => opt.value === status);
    return option?.label || status;
  };

  return (
    <Box className="approve-users-container">
      <PageHeader title="Approve Users" onBack={onBack} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : pendingUsers.length === 0 ? (
        <Alert severity="info">No pending users to approve</Alert>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 2, color: colors.titleSecondary }}>
            {pendingUsers.length} user{pendingUsers.length !== 1 ? "s" : ""} pending approval
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Service Number</TableCell>
                  <TableCell>Requested Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.lastName}, {user.firstName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.serviceNumber}</TableCell>
                    <TableCell>
                      {getRequestedStatusLabel(user.requestedMembershipStatus)}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Visibility />}
                          onClick={() => handleViewProfile(user)}
                          disabled={approvingUserId === user.id}
                        >
                          View Profile
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={approvingUserId === user.id ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                          onClick={() => handleAccept(user)}
                          disabled={approvingUserId === user.id || !user.requestedMembershipStatus}
                        >
                          {approvingUserId === user.id ? "Approving..." : "Accept"}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <EditUserDialog
        open={viewDialogOpen}
        user={viewingUser}
        onClose={handleCloseView}
        onSave={handleSave}
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

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: "100%" }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

