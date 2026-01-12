import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  PersonRemove as PersonRemoveIcon,
  PersonAdd as PersonAddIcon,
} from "@mui/icons-material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  getUserWithAccessGroupsRef,
  listAccessGroupsRef,
  addUserToAccessGroupRef,
  removeUserFromAccessGroupRef,
  type GetUserWithAccessGroupsData,
  type ListAccessGroupsData,
} from "@dataconnect/generated";
import { MembershipStatus } from "@dataconnect/generated";
import { canUserHaveAccessGroups } from "../../users/utils/accessGroupHelpers";

interface UserAccessGroupsProps {
  userId: string;
  userEmail?: string;
  userMembershipStatus?: MembershipStatus;
  onUpdate?: () => void;
}

export default function UserAccessGroups({
  userId,
  userEmail,
  userMembershipStatus,
  onUpdate,
}: UserAccessGroupsProps) {
  const [userData, setUserData] = useState<GetUserWithAccessGroupsData["user"] | null>(null);
  const [allGroups, setAllGroups] = useState<ListAccessGroupsData["accessGroups"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = getUserWithAccessGroupsRef(dataConnect, { id: userId });
      const result = await executeQuery(ref);
      setUserData(result.data?.user || null);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch user access groups");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchAllGroups = useCallback(async () => {
    try {
      const ref = listAccessGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      setAllGroups(result.data?.accessGroups || []);
    } catch (err: any) {
      console.error("Failed to fetch access groups:", err);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
    fetchAllGroups();
  }, [fetchUserData, fetchAllGroups]);

  const handleAddGroup = () => {
    setAddDialogOpen(true);
  };

  const handleAddUserToGroup = async (groupId: string) => {
    setAddingGroupId(groupId);
    setError(null);
    try {
      const ref = addUserToAccessGroupRef(dataConnect, {
        userId,
        accessGroupId: groupId,
      });
      await executeMutation(ref);
      await fetchUserData();
      if (onUpdate) {
        onUpdate();
      }
      setAddDialogOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to add user to access group");
    } finally {
      setAddingGroupId(null);
    }
  };

  const handleRemoveUserFromGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to remove this user from the access group?")) {
      return;
    }

    setRemovingGroupId(groupId);
    setError(null);
    try {
      const ref = removeUserFromAccessGroupRef(dataConnect, {
        userId,
        accessGroupId: groupId,
      });
      await executeMutation(ref);
      await fetchUserData();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to remove user from access group");
    } finally {
      setRemovingGroupId(null);
    }
  };

  const currentGroupIds = new Set(userData?.accessGroups?.map(ag => ag.accessGroup.id) || []);
  const availableGroups = allGroups.filter(group => !currentGroupIds.has(group.id));
  
  const membershipStatus = userMembershipStatus || userData?.membershipStatus;
  const canHaveGroups = membershipStatus ? canUserHaveAccessGroups(membershipStatus) : true;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !userData) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!canHaveGroups && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Users with restricted membership statuses ({membershipStatus}) cannot be assigned to access groups.
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Access Groups</Typography>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={handleAddGroup}
          disabled={!canHaveGroups}
        >
          Add to Group
        </Button>
      </Box>

      {userData?.accessGroups && userData.accessGroups.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Group Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Membership Statuses</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {userData.accessGroups.map((userAccessGroup) => {
                const group = userAccessGroup.accessGroup;
                const isStatusBased = group.membershipStatuses?.includes(membershipStatus || MembershipStatus.PENDING);
                return (
                  <TableRow key={group.id}>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {group.description || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {group.membershipStatuses && group.membershipStatuses.length > 0 ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {group.membershipStatuses.map((status) => (
                            <Chip
                              key={status}
                              label={status}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {isStatusBased ? (
                        <Tooltip title="User is automatically included via membership status">
                          <Chip label="Auto" size="small" color="primary" variant="outlined" />
                        </Tooltip>
                      ) : (
                        <Chip label="Manual" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isStatusBased ? (
                        <Tooltip title="Cannot remove - user is automatically included via membership status">
                          <span>
                            <IconButton size="small" disabled>
                              <PersonRemoveIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveUserFromGroup(group.id)}
                          color="error"
                          disabled={removingGroupId === group.id}
                        >
                          {removingGroupId === group.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PersonRemoveIcon />
                          )}
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          This user is not assigned to any access groups.
        </Alert>
      )}

      {/* Add to Group Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User to Access Group</DialogTitle>
        <DialogContent>
          {availableGroups.length === 0 ? (
            <Alert severity="info">
              All available access groups have been assigned to this user.
            </Alert>
          ) : (
            <Autocomplete
              options={availableGroups}
              getOptionLabel={(option) => option.name}
              onChange={(_, selectedGroup) => {
                if (selectedGroup) {
                  handleAddUserToGroup(selectedGroup.id);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Access Group"
                  placeholder="Choose an access group..."
                  margin="dense"
                  fullWidth
                  variant="outlined"
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.description && (
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    )}
                  </Box>
                  {option.membershipStatuses && option.membershipStatuses.length > 0 && (
                    <Box sx={{ display: "flex", gap: 0.5, ml: 2 }}>
                      {option.membershipStatuses.map((status) => (
                        <Chip
                          key={status}
                          label={status}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              )}
              disabled={addingGroupId !== null}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={addingGroupId !== null}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
