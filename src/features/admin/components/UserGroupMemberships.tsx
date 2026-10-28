import { useQueryClient } from "@tanstack/react-query";
import { invalidateUserSectionAccess } from "../../../shared/query/invalidation";
import { useState, useEffect, useCallback, useRef } from "react";
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
import { dataConnect } from "../../../config/firebase";
import {
  executeDataConnectMutation,
  executeDataConnectQuery,
} from "../../../shared/query/dataConnectExecution";
import {
  getUserWithAccessGroupsRef,
  listUserGroupsRef,
  addUserToUserGroupRef,
  removeUserFromUserGroupRef,
  type GetUserWithAccessGroupsData,
  type ListUserGroupsData,
} from "@dataconnect/generated";
import { MembershipStatus } from "@dataconnect/generated";
import SnackbarAlert from "../../../shared/components/SnackbarAlert";
import { useSnackbar } from "../../../shared/hooks/useSnackbar";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";

interface UserGroupMembershipsProps {
  userId: string;
  userEmail?: string;
  userMembershipStatus?: MembershipStatus;
  onUpdate?: () => void;
}

// A selected user's forms and pending callbacks must never migrate to another user.
export default function UserGroupMemberships(props: UserGroupMembershipsProps) {
  return <SelectedUserGroupMemberships key={props.userId} {...props} />;
}

function SelectedUserGroupMemberships({
  userId,
  userMembershipStatus,
  onUpdate,
}: UserGroupMembershipsProps) {
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const userRead = useLatestRequestGuard();
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [userData, setUserData] = useState<GetUserWithAccessGroupsData["user"] | null>(null);
  const [allGroups, setAllGroups] = useState<ListUserGroupsData["userGroups"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { snackbar, showSuccess, close: closeSnackbar } = useSnackbar();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);

  const fetchUserData = useCallback(async (showError = true) => {
    if (!mounted.current) return false;
    const request = userRead.start();
    const current = () => mounted.current && userRead.isCurrent(request);
    setLoading(true);
    setError(null);
    try {
      const ref = getUserWithAccessGroupsRef(dataConnect, { id: userId });
      const result = await executeDataConnectQuery(ref);
      if (!current()) return false;
      setUserData(result.data?.user || null);
      return true;
    } catch (caught) {
      if (current()) {
        reportError("admin.user-memberships.load", caught, { userId });
        if (showError) setError(toAdminUserFacingError(caught, "user-groups").message);
      }
      return false;
    } finally {
      if (current()) setLoading(false);
    }
  }, [userId, userRead]);

  const fetchAllGroups = useCallback(async () => {
    if (!mounted.current) return;
    try {
      const ref = listUserGroupsRef(dataConnect);
      const result = await executeDataConnectQuery(ref);
      if (mounted.current) setAllGroups(result.data?.userGroups || []);
    } catch (caught) {
      if (mounted.current) reportError("admin.user-memberships.available-groups", caught, { userId });
    }
  }, [userId]);

  useEffect(() => {
    void fetchUserData();
    void fetchAllGroups();
  }, [fetchUserData, fetchAllGroups]);

  const refreshMembershipViews = async () => {
    // A confirmed mutation still invalidates shared views if the operator has
    // moved to another user. Its old local callbacks may no longer commit state.
    const [loaded] = await Promise.all([
      fetchUserData(false), invalidateUserSectionAccess(queryClient),
    ]);
    if (!mounted.current) return false;
    if (!loaded) throw new Error("Membership refresh incomplete");
    await onUpdate?.();
    return mounted.current;
  };

  const retrySavedRefresh = async () => {
    setRefreshing(true);
    try {
      if (await refreshMembershipViews()) setRefreshFailed(false);
    } catch (caught) {
      if (mounted.current) {
        reportError("admin.user-memberships.refresh", caught, { userId });
        setRefreshFailed(true);
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

  const handleAddGroup = () => { setError(null); setAddDialogOpen(true); };

  const handleAddUserToGroup = async (groupId: string) => {
    setAddingGroupId(groupId);
    setError(null);
    let saved = false;
    try {
      const ref = addUserToUserGroupRef(dataConnect, { userId, userGroupId: groupId });
      await executeDataConnectMutation(ref);
      saved = true;
      if (mounted.current) setAddDialogOpen(false);
      if (await refreshMembershipViews()) {
        setRefreshFailed(false);
        showSuccess(`Added to "${allGroups.find((g) => g.id === groupId)?.name ?? "group"}"`);
      }
    } catch (caught) {
      if (!mounted.current) return;
      reportError("admin.user-memberships.add", caught, { userId, groupId });
      if (saved) setRefreshFailed(true);
      else setError(toAdminUserFacingError(caught, "user-groups").message);
    } finally {
      if (mounted.current) setAddingGroupId(null);
    }
  };

  const handleRemoveUserFromGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to remove this user from the user group?")) return;
    const groupName = userData?.userGroups?.find((ug) => ug.userGroup.id === groupId)?.userGroup.name ?? "group";
    setRemovingGroupId(groupId);
    setError(null);
    let saved = false;
    try {
      const ref = removeUserFromUserGroupRef(dataConnect, { userId, userGroupId: groupId });
      await executeDataConnectMutation(ref);
      saved = true;
      if (await refreshMembershipViews()) {
        setRefreshFailed(false);
        showSuccess(`Removed from "${groupName}"`);
      }
    } catch (caught) {
      if (!mounted.current) return;
      reportError("admin.user-memberships.remove", caught, { userId, groupId });
      if (saved) setRefreshFailed(true);
      else setError(toAdminUserFacingError(caught, "user-groups").message);
    } finally {
      if (mounted.current) setRemovingGroupId(null);
    }
  };

  const retryLoading = () => { void fetchUserData(); void fetchAllGroups(); };
  const refreshWarning = refreshFailed && (
    <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" disabled={refreshing} onClick={() => void retrySavedRefresh()}>Retry refresh</Button>}>
      Membership saved, but the latest membership views could not be loaded. Retry the refresh; do not repeat the change.
    </Alert>
  );

  const currentGroupIds = new Set(userData?.userGroups?.map(ug => ug.userGroup.id) || []);
  const availableGroups = allGroups.filter(group => !currentGroupIds.has(group.id));
  
  const membershipStatus = userMembershipStatus || userData?.membershipStatus;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !userData) {
    return <Alert severity="error" action={<Button color="inherit" onClick={retryLoading}>Retry loading</Button>}>{error}</Alert>;
  }

  return (
    <Box>
      {refreshWarning}
      {error && !addDialogOpen && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} action={<Button color="inherit" onClick={retryLoading}>Retry loading</Button>}>
          {error}
        </Alert>
      )}

      {membershipStatus && ["PENDING", "RESIGNED", "LOST", "DECEASED"].includes(membershipStatus) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          User has restricted membership status ({membershipStatus}) and cannot log in, but user group memberships are preserved.
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">User Groups</Typography>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={handleAddGroup}
          disabled={refreshFailed || refreshing || addingGroupId !== null || removingGroupId !== null}
        >
          Add to Group
        </Button>
      </Box>

      {userData?.userGroups && userData.userGroups.length > 0 ? (
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
              {userData.userGroups.map((userUserGroup) => {
                const group = userUserGroup.userGroup;
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
                          aria-label={`Remove from ${group.name}`}
                          onClick={() => handleRemoveUserFromGroup(group.id)}
                          color="error"
                          disabled={refreshFailed || refreshing || removingGroupId !== null || addingGroupId !== null}
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
          This user is not assigned to any user groups.
        </Alert>
      )}

      {/* Add to Group Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User to User Group</DialogTitle>
        <DialogContent>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {availableGroups.length === 0 ? (
            <Alert severity="info">
              All available user groups have been assigned to this user.
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
                  label="Select User Group"
                  placeholder="Choose a user group..."
                  margin="dense"
                  fullWidth
                  variant="outlined"
                />
              )}
              renderOption={({key, ...props}, option) => (
                <Box component="li" key={key} {...props}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.description && (
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    )}
                  </Box>
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

      <SnackbarAlert snackbar={snackbar} onClose={closeSnackbar} />
    </Box>
  );
}
