import { useState, useEffect } from "react";
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
import { executeQuery } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  listUsersRef,
  listAccessGroupsRef,
  listSectionsRef,
  type ListUsersData,
  type ListAccessGroupsData,
  type ListSectionsData,
} from "@dataconnect/generated";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";

interface AuditLogsProps {
  onBack: () => void;
}

export default function AuditLogs({ onBack }: AuditLogsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<ListUsersData["users"]>([]);
  const [accessGroups, setAccessGroups] = useState<ListAccessGroupsData["accessGroups"]>([]);
  const [sections, setSections] = useState<ListSectionsData["sections"]>([]);
  const [allUsers, setAllUsers] = useState<ListUsersData["users"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchAllUsers = async () => {
    try {
      const ref = listUsersRef(dataConnect);
      const result = await executeQuery(ref);
      setAllUsers(result.data?.users || []);
    } catch (err: any) {
      console.error("Failed to fetch users for audit log lookup:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tabValue === 0) {
        const ref = listUsersRef(dataConnect);
        const result = await executeQuery(ref);
        setUsers(result.data?.users || []);
      } else if (tabValue === 1) {
        const ref = listAccessGroupsRef(dataConnect);
        const result = await executeQuery(ref);
        setAccessGroups(result.data?.accessGroups || []);
      } else if (tabValue === 2) {
        const ref = listSectionsRef(dataConnect);
        const result = await executeQuery(ref);
        setSections(result.data?.sections || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

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
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
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
        sx={{
          mb: 3,
          "& .MuiTab-root": {
            "&:focus": {
              outline: "none",
            },
            "&:focus-visible": {
              outline: "none",
            },
          },
        }}
      >
        <Tab label="Users" />
        <Tab label="Access Groups" />
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
              {accessGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No access groups found
                  </TableCell>
                </TableRow>
              ) : (
                accessGroups.map((group) => (
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
