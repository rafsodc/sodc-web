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
} from "@mui/material";
import { Edit, CheckCircle } from "@mui/icons-material";
import type { SearchUser } from "../../../types";
import { colors } from "../../../config/colors";

interface UsersTableProps {
  users: SearchUser[];
  mode: "edit" | "admin";
  onEdit?: (user: SearchUser) => void;
  onGrantAdmin?: (userId: string) => void;
  onRevokeAdmin?: (userId: string) => void;
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
        <IconButton
          size="small"
          onClick={() => onEdit?.(user)}
          title="Edit user"
          disabled={disabled}
        >
          <Edit />
        </IconButton>
      );
    } else {
      // mode === "admin"
      const isAdmin = user.customClaims?.admin === true;
      const isEnabled = user.customClaims?.enabled === true;
      const canRevoke = adminCount === undefined || adminCount > 1;
      
      if (isAdmin) {
        return (
          <Tooltip title={!canRevoke ? "Cannot remove the last admin" : "Revoke admin"}>
            <span>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => onRevokeAdmin?.(user.uid)}
                disabled={updatingUserId === user.uid || !canRevoke}
              >
                {updatingUserId === user.uid ? (
                  <CircularProgress size={16} />
                ) : (
                  "Revoke Admin"
                )}
              </Button>
            </span>
          </Tooltip>
        );
      } else {
        const isDisabled = updatingUserId === user.uid || !isEnabled;
        const tooltipText = !isEnabled 
          ? "User must be enabled (have non-restricted membership status) to grant admin" 
          : "Grant admin privileges";
        
        return (
          <Tooltip title={tooltipText}>
            <span>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onGrantAdmin?.(user.uid)}
                disabled={isDisabled}
                sx={{
                  backgroundColor: colors.callToAction,
                  color: "white",
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
                  <CircularProgress size={16} />
                ) : (
                  "Grant Admin"
                )}
              </Button>
            </span>
          </Tooltip>
        );
      }
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
            users.map((user) => (
              <TableRow 
                key={user.uid}
                onClick={() => onSelectUser?.(user.uid)}
                sx={{
                  cursor: onSelectUser ? "pointer" : "default",
                  backgroundColor: selectedUserId === user.uid ? "action.selected" : "inherit",
                  "&:hover": onSelectUser ? {
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
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

