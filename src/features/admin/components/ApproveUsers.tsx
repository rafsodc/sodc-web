import { useState, useEffect, useCallback } from "react";
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
  Chip,
  Snackbar,
} from "@mui/material";
import { Visibility, CheckCircle, Refresh } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import EditUserDialog from "../../profile/components/EditUserDialog";
import { MEMBERSHIP_STATUS_OPTIONS } from "../../../constants";
import { MembershipStatus } from "@dataconnect/generated";
import type { SearchUser, PendingUser } from "../../../types";
import {
  listUsersWithoutDataConnectProfile,
  listUsersPendingApproval,
  updateMembershipStatus,
  type UserWithoutDataConnectProfileRow,
} from "../../../shared/utils/firebaseFunctions";
import "../../../shared/components/PageContainer.css";

interface ApproveUsersProps {
  onBack: () => void;
}

function claimChipColor(value: string): "default" | "success" | "error" | "warning" {
  if (value === "true") return "success";
  if (value === "false") return "error";
  if (value === "(unset)") return "warning";
  return "default";
}

export default function ApproveUsers({ onBack }: ApproveUsersProps) {
  const [usersWithoutProfile, setUsersWithoutProfile] = useState<UserWithoutDataConnectProfileRow[]>(
    []
  );
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<SearchUser | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [withoutProfileResult, pendingResult] = await Promise.all([
        listUsersWithoutDataConnectProfile(),
        listUsersPendingApproval(),
      ]);

      if (!withoutProfileResult.success || !withoutProfileResult.users) {
        throw new Error(withoutProfileResult.error || "Failed to load users without profile");
      }
      setUsersWithoutProfile(withoutProfileResult.users);

      if (pendingResult.success && pendingResult.users) {
        setPendingUsers(pendingResult.users as PendingUser[]);
      } else {
        setPendingUsers([]);
      }
    } catch (err: unknown) {
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Failed to load users";
      setError(message);
      setUsersWithoutProfile([]);
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewProfile = (user: PendingUser) => {
    const searchUser: SearchUser = {
      uid: user.id,
      email: user.email,
      displayName: `${user.lastName}, ${user.firstName}`,
      emailVerified: true,
      disabled: false,
      metadata: {
        creationTime: user.createdAt || new Date().toISOString(),
        lastSignInTime: null,
      },
      customClaims: {
        admin: false,
        enabled: false,
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
    fetchData();
  };

  const handleEditSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  const handleAccept = async (user: PendingUser) => {
    if (!user.requestedMembershipStatus) {
      setErrorMessage("User has not specified a requested membership status");
      return;
    }

    setApprovingUserId(user.id);
    setErrorMessage(null);

    try {
      const result = await updateMembershipStatus(
        user.id,
        user.requestedMembershipStatus as MembershipStatus
      );
      if (result.success) {
        setSuccessMessage(
          `User ${user.firstName} ${user.lastName} has been approved with status: ${getRequestedStatusLabel(user.requestedMembershipStatus)}`
        );
        await fetchData();
      } else {
        setErrorMessage(result.error || "Failed to approve user");
      }
    } catch (err: unknown) {
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Failed to approve user";
      setErrorMessage(message);
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
    <Box className="page-container">
      <PageHeader title="Approve Users" onBack={onBack} />

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          onClick={() => fetchData()}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Typography variant="h6" sx={{ mb: 1, color: "primary.main" }}>
            Not enabled, no Data Connect profile ({usersWithoutProfile.length})
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            Firebase Auth accounts where the enabled claim is not true and there is no user row
            in Data Connect. They have not completed profile registration in the database yet.
            Completing profile in the app only requires sign-in (not enabled); if they are stuck,
            check email verification and that functions are deployed.
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 4, overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Display name</TableCell>
                  <TableCell>Email verified</TableCell>
                  <TableCell>claim: enabled</TableCell>
                  <TableCell>claim: admin</TableCell>
                  <TableCell>Auth disabled</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersWithoutProfile.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No users in this group
                    </TableCell>
                  </TableRow>
                ) : (
                  usersWithoutProfile.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.email || "—"}</TableCell>
                      <TableCell>{row.displayName || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.emailVerified ? "yes" : "no"}
                          color={row.emailVerified ? "success" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.claimEnabled}
                          color={claimChipColor(row.claimEnabled)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.claimAdmin}
                          color={claimChipColor(row.claimAdmin)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.authDisabled ? "yes" : "no"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{row.createdAt || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 1, color: "primary.main" }}>
            Pending membership approval ({pendingUsers.length})
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            Has a Data Connect profile, enabled claim is not true, email verified, membership
            PENDING or blank. Use Accept to activate.
          </Typography>
          {pendingUsers.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No users in the membership approval queue.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Service Number</TableCell>
                    <TableCell>Membership</TableCell>
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
                        {user.membershipStatus?.trim() ? user.membershipStatus : "(blank)"}
                      </TableCell>
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
                            startIcon={
                              approvingUserId === user.id ? (
                                <CircularProgress size={16} color="inherit" />
                              ) : (
                                <CheckCircle />
                              )
                            }
                            onClick={() => handleAccept(user)}
                            disabled={
                              approvingUserId === user.id || !user.requestedMembershipStatus
                            }
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
          )}
        </>
      )}

      <EditUserDialog
        open={viewDialogOpen}
        user={viewingUser}
        onClose={handleCloseView}
        onSave={handleSave}
        onSuccess={handleEditSuccess}
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
