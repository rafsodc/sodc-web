import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { dataConnect } from "../../../config/firebase";
import { executeDataConnectQuery } from "../../../shared/query/dataConnectExecution";
import {
  listUsersRef,
  listUserGroupsRef,
  listSectionsRef,
  type ListUsersData,
  type ListUserGroupsData,
  type ListSectionsData,
} from "@dataconnect/generated";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";

interface AuditLogsProps {
  onBack: () => void;
}

export default function AuditLogs({ onBack }: AuditLogsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<ListUsersData["users"]>([]);
  const [userGroups, setUserGroups] = useState<ListUserGroupsData["userGroups"]>([]);
  const [sections, setSections] = useState<ListSectionsData["sections"]>([]);
  const [allUsers, setAllUsers] = useState<ListUsersData["users"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataRequestGuard = useLatestRequestGuard();

  const fetchAllUsers = useCallback(async () => {
    try {
      const ref = listUsersRef(dataConnect);
      const result = await executeDataConnectQuery(ref);
      setAllUsers(result.data?.users || []);
    } catch (error) {
      reportError("admin.audit-logs.user-lookup", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    const requestToken = dataRequestGuard.start();
    setLoading(true);
    setError(null);
    try {
      if (tabValue === 0) {
        const ref = listUsersRef(dataConnect);
        const result = await executeDataConnectQuery(ref);
        if (!dataRequestGuard.isCurrent(requestToken)) return;
        setUsers(result.data?.users || []);
      } else if (tabValue === 1) {
        const ref = listUserGroupsRef(dataConnect);
        const result = await executeDataConnectQuery(ref);
        if (!dataRequestGuard.isCurrent(requestToken)) return;
        setUserGroups(result.data?.userGroups || []);
      } else if (tabValue === 2) {
        const ref = listSectionsRef(dataConnect);
        const result = await executeDataConnectQuery(ref);
        if (!dataRequestGuard.isCurrent(requestToken)) return;
        setSections(result.data?.sections || []);
      }
    } catch (caught) {
      if (!dataRequestGuard.isCurrent(requestToken)) return;
      reportError("admin.audit-logs.load", caught, { tab: tabValue });
      setError(toAdminUserFacingError(caught, "audit-logs").message);
    } finally {
      if (dataRequestGuard.isCurrent(requestToken)) {
        setLoading(false);
      }
    }
  }, [tabValue, dataRequestGuard]);

  useEffect(() => {
    void fetchAllUsers();
  }, [fetchAllUsers]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Create lookup map for user IDs to display names
  const getUserDisplayName = (userId: string | null | undefined): string => {
    if (!userId || userId === "system") {
      return userId === "system" ? "System" : "-";
    }
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      return `${user.firstName} ${user.lastName}`;
    }
    return userId; // Fallback to ID if user not found
  };

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return "-";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <PageHeader title="Audit Logs" onBack={onBack} />
        </Box>
        <IconButton
          onClick={() => {
            fetchAllUsers();
            fetchData();
          }}
          disabled={loading}
          title="Refresh audit logs"
          sx={{ ml: 2 }}
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label="Users" />
        <Tab label="User Groups" />
        <Tab label="Sections" />
      </Tabs>

      {loading ? (
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      ) : tabValue === 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Updated By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip label={user.membershipStatus} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{formatTimestamp(user.createdAt)}</TableCell>
                    <TableCell>{getUserDisplayName(user.createdBy)}</TableCell>
                    <TableCell>{formatTimestamp(user.updatedAt)}</TableCell>
                    <TableCell>{getUserDisplayName(user.updatedBy)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : tabValue === 1 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Updated By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {userGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No user groups found
                  </TableCell>
                </TableRow>
              ) : (
                userGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>{group.description || "-"}</TableCell>
                    <TableCell>{formatTimestamp(group.createdAt)}</TableCell>
                    <TableCell>{getUserDisplayName(group.createdBy)}</TableCell>
                    <TableCell>{formatTimestamp(group.updatedAt)}</TableCell>
                    <TableCell>{getUserDisplayName(group.updatedBy)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Updated By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No sections found
                  </TableCell>
                </TableRow>
              ) : (
                sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell>{section.name}</TableCell>
                    <TableCell>
                      <Chip label={section.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{section.description || "-"}</TableCell>
                    <TableCell>{formatTimestamp(section.createdAt)}</TableCell>
                    <TableCell>{getUserDisplayName(section.createdBy)}</TableCell>
                    <TableCell>{formatTimestamp(section.updatedAt)}</TableCell>
                    <TableCell>{getUserDisplayName(section.updatedBy)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
