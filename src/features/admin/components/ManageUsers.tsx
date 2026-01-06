import { useState } from "react";
import { Box, Typography, CircularProgress, Alert, Snackbar } from "@mui/material";
import type { SearchUser } from "../../../types";
import { colors } from "../../../config/colors";
import { useUserSearch } from "../../users/hooks/useUserSearch";
import { SEARCH_DEBOUNCE_MS } from "../../../constants";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import UsersTable from "../../users/components/UsersTable";
import EditUserDialog from "../../profile/components/EditUserDialog";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import "./ManageUsers.css";

interface ManageUsersProps {
  onBack: () => void;
}

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
  } = useUserSearch("", SEARCH_DEBOUNCE_MS);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SearchUser | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleEdit = (user: SearchUser) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setEditingUser(null);
  };

  const handleSave = () => {
    refetch();
  };

  const handleSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage(null);
  };

  return (
    <Box className="manage-users-container">
      <PageHeader title="Manage Users" onBack={onBack} />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        onRefresh={refetch}
        loading={loading}
      />

      {loading ? (
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : searchTerm.trim() === "" ? (
        <Alert severity="info">Enter a search term to find users</Alert>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 2, color: colors.titleSecondary }}>
            Showing {users.length} of {total} users (page {page} of {totalPages})
          </Typography>
          <UsersTable
            users={users}
            mode="edit"
            onEdit={handleEdit}
          />
          <PaginationDisplay page={page} totalPages={totalPages} onChange={handlePageChange} />
        </>
      )}

      <EditUserDialog
        open={editDialogOpen}
        user={editingUser}
        onClose={handleCloseEdit}
        onSave={handleSave}
        onSuccess={handleSuccess}
      />

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }} // Margin top to position below header
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: "100%" }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

