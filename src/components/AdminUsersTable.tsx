import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import { CheckCircle } from "@mui/icons-material";
import { type AdminUser } from "../utils/listAdminUsers";

interface AdminUsersTableProps {
  users: AdminUser[];
  onRevokeAdmin: (userId: string) => void;
  updatingUserId?: string | null;
  canRevoke: boolean;
}

export default function AdminUsersTable({
  users,
  onRevokeAdmin,
  updatingUserId,
  canRevoke,
}: AdminUsersTableProps) {
  return (
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
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">
                No admin users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
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
                    onClick={() => onRevokeAdmin(user.uid)}
                    disabled={updatingUserId === user.uid || !canRevoke}
                    title={!canRevoke ? "Cannot remove the last admin" : "Revoke admin"}
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
  );
}

