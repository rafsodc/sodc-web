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
  Tabs,
  Tab,
} from "@mui/material";
import { CheckCircle, Refresh } from "@mui/icons-material";
import { listAdminUsers, type AdminUser } from "../utils/listAdminUsers";
import { searchUsers, type SearchUser } from "../utils/searchUsers";
import { colors } from "../config/colors";
import "./Permissions.css";

interface PermissionsProps {
  onBack: () => void;
}

const ADMIN_ITEMS_PER_PAGE = 20;
const SEARCH_ITEMS_PER_PAGE = 25;

export default function Permissions({ onBack }: PermissionsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [filteredAdminUsers, setFilteredAdminUsers] = useState<AdminUser[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adminEmailFilter, setAdminEmailFilter] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);

  const fetchAdminUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers();
      if (result.success && result.users) {
        setAdminUsers(result.users);
      } else {
        setError(result.error || "Failed to fetch admin users");
        setAdminUsers([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch admin users");
      setAdminUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  // Filter admin users based on email
  useEffect(() => {
    let filtered = [...adminUsers];

    // Filter by email
    if (adminEmailFilter.trim()) {
      const emailLower = adminEmailFilter.toLowerCase();
      filtered = filtered.filter((user) =>
        user.email?.toLowerCase().includes(emailLower)
      );
    }

    setFilteredAdminUsers(filtered);
    setAdminPage(1); // Reset to first page when filters change
  }, [adminUsers, adminEmailFilter]);

  // Search users
  const handleSearch = useCallback(async (term: string, pageNum: number = 1) => {
    if (!term.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    try {
      const result = await searchUsers(term, pageNum, SEARCH_ITEMS_PER_PAGE);
      if (result.success && result.data) {
        setSearchResults(result.data.users);
        setSearchTotalPages(result.data.totalPages);
        setSearchTotal(result.data.total);
      } else {
        setSearchError(result.error || "Failed to search users");
        setSearchResults([]);
      }
    } catch (err: any) {
      setSearchError(err?.message || "Failed to search users");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tabValue === 1) {
        handleSearch(searchTerm, 1);
        setSearchPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, tabValue, handleSearch]);

  // Admin pagination
  const adminTotalPages = Math.ceil(filteredAdminUsers.length / ADMIN_ITEMS_PER_PAGE);
  const adminStartIndex = (adminPage - 1) * ADMIN_ITEMS_PER_PAGE;
  const paginatedAdminUsers = filteredAdminUsers.slice(adminStartIndex, adminStartIndex + ADMIN_ITEMS_PER_PAGE);

  const handleSearchPageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    setSearchPage(newPage);
    handleSearch(searchTerm, newPage);
  };

  return (
    <Box className="permissions-container">
      <Box className="permissions-header">
        <Typography variant="h4" className="permissions-title">
          Permissions
        </Typography>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
      </Box>

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
        <Tab label="Admin Users" />
        <Tab label="Search Users" />
      </Tabs>

      {tabValue === 0 && (
        <>
          <Box className="filters-container">
            <TextField
              label="Filter by Email"
              variant="outlined"
              value={adminEmailFilter}
              onChange={(e) => setAdminEmailFilter(e.target.value)}
              className="email-filter"
              size="small"
            />
            <Tooltip title="Refresh admin users list">
              <IconButton onClick={fetchAdminUsers} disabled={loading}>
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
                Showing {paginatedAdminUsers.length} of {filteredAdminUsers.length} admin users
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Display Name</TableCell>
                      <TableCell>Email Verified</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedAdminUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No admin users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedAdminUsers.map((user) => (
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
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {adminTotalPages > 1 && (
                <Stack spacing={2} sx={{ mt: 3, alignItems: "center" }}>
                  <Pagination
                    count={adminTotalPages}
                    page={adminPage}
                    onChange={(_, newPage) => setAdminPage(newPage)}
                    color="primary"
                  />
                </Stack>
              )}
            </>
          )}
        </>
      )}

      {tabValue === 1 && (
        <>
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
          </Box>

          {searchLoading ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : searchError ? (
            <Alert severity="error">{searchError}</Alert>
          ) : searchTerm.trim() === "" ? (
            <Alert severity="info">Enter a search term to find users</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: colors.titleSecondary }}>
                Showing {searchResults.length} of {searchTotal} users (page {searchPage} of {searchTotalPages})
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Display Name</TableCell>
                      <TableCell>Email Verified</TableCell>
                      <TableCell>Admin</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      searchResults.map((user) => (
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
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {searchTotalPages > 1 && (
                <Stack spacing={2} sx={{ mt: 3, alignItems: "center" }}>
                  <Pagination
                    count={searchTotalPages}
                    page={searchPage}
                    onChange={handleSearchPageChange}
                    color="primary"
                  />
                </Stack>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}

