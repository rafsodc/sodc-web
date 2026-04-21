import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Tooltip,
  Box,
} from "@mui/material";
import {
  AddModerator,
  CheckCircle,
  Edit,
  Groups,
  RemoveModerator,
} from "@mui/icons-material";
import type { SearchUser } from "../../../types";
import { colors } from "../../../config/colors";

interface UsersTableProps {
  users: SearchUser[];
  mode: "edit" | "admin";
  /** When mode is "admin", show an edit control alongside grant/revoke actions. */
  onEdit?: (user: SearchUser) => void;
  /** When set, shows an "Edit Groups" button (replaces row-click to open groups). */
  onEditGroups?: (user: SearchUser) => void;
  onGrantAdmin?: (userId: string) => void;
  onRevokeAdmin?: (userId: string) => void;
  /** Row click selects user (only used when onEditGroups is not provided). */
  onSelectUser?: (userId: string) => void;
  updatingUserId?: string | null;
  adminCount?: number; // Used to disable revoke if only one admin
  disabled?: boolean;
  selectedUserId?: string | null;
}

export default function UsersTable({
  users,
  mode,
  onEdit,
  onEditGroups,
  onGrantAdmin,
  onRevokeAdmin,
  onSelectUser,
  updatingUserId,
  adminCount,
  disabled = false,
  selectedUserId,
}: UsersTableProps) {
  const renderActions = (user: SearchUser) => {
    if (mode === "edit") {
      return (
        <Tooltip title="Edit this user's profile and account details.">
          <span>
            <IconButton
              size="small"
              onClick={() => onEdit?.(user)}
              aria-label="Edit user"
              disabled={disabled}
            >
              <Edit />
            </IconButton>
          </span>
        </Tooltip>
      );
    } else {
      // mode === "admin"
      const isAdmin = user.customClaims?.admin === true;
      const isEnabled = user.customClaims?.enabled === true;
      const canRevoke = adminCount === undefined || adminCount > 1;
      
      const adminButtons = isAdmin ? (
        <Tooltip
          title={
            !canRevoke
              ? "At least one administrator must remain. Add another admin before revoking this user."
              : "Remove administrator access for this user. They keep their account and section access unless you change it elsewhere."
          }
        >
          <span>
            <Button
              size="small"
              variant="outlined"
              color="error"
              aria-label="Revoke administrator access"
              startIcon={
                updatingUserId === user.uid ? undefined : <RemoveModerator fontSize="small" />
              }
              onClick={(e) => {
                e.stopPropagation();
                onRevokeAdmin?.(user.uid);
              }}
              disabled={updatingUserId === user.uid || !canRevoke}
            >
              {updatingUserId === user.uid ? <CircularProgress color="inherit" size={16} /> : "Revoke Admin"}
            </Button>
          </span>
        </Tooltip>
      ) : (
        (() => {
          const isDisabled = updatingUserId === user.uid || !isEnabled;
          const tooltipText = !isEnabled
            ? "Only enabled members (non-restricted membership) can be granted administrator access."
            : "Grant full administrator access: manage users, sections, and other admin tools.";

          return (
            <Tooltip title={tooltipText}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  aria-label="Grant administrator access"
                  startIcon={
                    updatingUserId === user.uid ? undefined : <AddModerator fontSize="small" />
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onGrantAdmin?.(user.uid);
                  }}
                  disabled={isDisabled}
                  sx={{
                    backgroundColor: colors.callToAction,
                    color: "white",
                    "& .MuiButton-startIcon": { color: "white" },
                    "&:hover": {
                      backgroundColor: colors.callToAction,
                      opacity: 0.9,
                    },
                    "&:disabled": {
                      backgroundColor: colors.callToAction,
                      opacity: 0.5,
                    },
                  }}
                >
                  {updatingUserId === user.uid ? (
                    <CircularProgress sx={{ color: "white" }} size={16} />
                  ) : (
                    "Grant Admin"
                  )}
                </Button>
              </span>
            </Tooltip>
          );
        })()
      );

      if (onEdit) {
        const editUserBtn = (
          <Tooltip title="Open the editor for this user's profile, membership status, and related details.">
            <span>
              <Button
                size="small"
                variant="outlined"
                aria-label="Edit user profile and details"
                startIcon={<Edit fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(user);
                }}
                disabled={disabled}
              >
                Edit User
              </Button>
            </span>
          </Tooltip>
        );
        const editGroupsBtn = onEditGroups ? (
          <Tooltip title="Manage which user groups this user belongs to (section access, moderators, and similar).">
            <span>
              <Button
                size="small"
                variant="outlined"
                aria-label="Edit user group memberships"
                startIcon={<Groups fontSize="small" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditGroups(user);
                }}
                disabled={disabled}
              >
                Edit Groups
              </Button>
            </span>
          </Tooltip>
        ) : null;

        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {editUserBtn}
            {editGroupsBtn}
            {adminButtons}
          </Box>
        );
      }

      return adminButtons;
    }
  };

  return (
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
            users.map((user) => {
              const rowClickSelect = Boolean(onSelectUser) && !onEditGroups;
              return (
              <TableRow 
                key={user.uid}
                onClick={() => rowClickSelect && onSelectUser?.(user.uid)}
                sx={{
                  cursor: rowClickSelect ? "pointer" : "default",
                  backgroundColor: selectedUserId === user.uid ? "action.selected" : "inherit",
                  "&:hover": rowClickSelect ? {
                    backgroundColor: "action.hover",
                  } : {},
                }}
              >
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
                  {renderActions(user)}
                </TableCell>
              </TableRow>
            );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

