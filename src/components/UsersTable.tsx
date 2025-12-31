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
} from "@mui/material";
import { Edit, CheckCircle } from "@mui/icons-material";
import { type SearchUser } from "../utils/searchUsers";
import { colors } from "../config/colors";

interface UsersTableProps {
  users: SearchUser[];
  mode: "edit" | "admin";
  onEdit?: (user: SearchUser) => void;
  onGrantAdmin?: (userId: string) => void;
  onRevokeAdmin?: (userId: string) => void;
  updatingUserId?: string | null;
  adminCount?: number; // Used to disable revoke if only one admin
  disabled?: boolean;
}

export default function UsersTable({
  users,
  mode,
  onEdit,
  onGrantAdmin,
  onRevokeAdmin,
  updatingUserId,
  adminCount,
  disabled = false,
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
      const canRevoke = adminCount === undefined || adminCount > 1;
      
      if (isAdmin) {
        return (
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onRevokeAdmin?.(user.uid)}
            disabled={updatingUserId === user.uid || !canRevoke}
            title={!canRevoke ? "Cannot remove the last admin" : "Revoke admin"}
          >
            {updatingUserId === user.uid ? (
              <CircularProgress size={16} />
            ) : (
              "Revoke Admin"
            )}
          </Button>
        );
      } else {
        return (
          <Button
            size="small"
            variant="outlined"
            onClick={() => onGrantAdmin?.(user.uid)}
            disabled={updatingUserId === user.uid}
            sx={{
              backgroundColor: colors.callToAction,
              color: "white",
              "&:hover": {
                backgroundColor: colors.callToAction,
                opacity: 0.9,
              },
            }}
            title="Grant admin privileges"
          >
            {updatingUserId === user.uid ? (
              <CircularProgress size={16} />
            ) : (
              "Grant Admin"
            )}
          </Button>
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

