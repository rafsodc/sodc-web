import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
} from "@mui/icons-material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  listAccessGroupsRef,
  listUsersRef,
  getAccessGroupByIdRef,
  createAccessGroupRef,
  updateAccessGroupRef,
  deleteAccessGroupRef,
  addUserToAccessGroupRef,
  removeUserFromAccessGroupRef,
  getUserWithAccessGroupsRef,
  type GetAccessGroupByIdData,
} from "@dataconnect/generated";
import { MembershipStatus } from "@dataconnect/generated";
import { MEMBERSHIP_STATUS_OPTIONS, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from "../../../constants";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Autocomplete,
} from "@mui/material";
import { searchUsers } from "../../users/utils/searchUsers";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import "../../../shared/components/PageContainer.css";

interface AccessGroupsProps {
  onBack: () => void;
}

interface AccessGroupWithDetails {
  id: string;
  name: string;
  description?: string | null;
  membershipStatuses?: MembershipStatus[] | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  sectionCount?: number;
}

export default function AccessGroups({ onBack }: AccessGroupsProps) {
  const isAdmin = useAdminClaim(auth.currentUser);
  const [accessGroups, setAccessGroups] = useState<AccessGroupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupDetails, setGroupDetails] = useState<Record<string, GetAccessGroupByIdData["accessGroup"]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  
  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccessGroupWithDetails | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<MembershipStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Add user dialog state
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; membershipStatus: MembershipStatus }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // All users (for "by membership status" list)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; membershipStatus: MembershipStatus }>>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<{ id: string; firstName: string; lastName: string; email: string; membershipStatus: MembershipStatus } | null>(null);

  const fetchAccessGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = listAccessGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      
      // Get existing groups from database
      const existingGroups: AccessGroupWithDetails[] = result.data?.accessGroups?.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        membershipStatuses: group.membershipStatuses || null,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      })) || [];
      
      // Sort alphabetically
      existingGroups.sort((a, b) => a.name.localeCompare(b.name));
      
      setAccessGroups(existingGroups);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch access groups");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupDetails = useCallback(async (groupId: string) => {
    if (groupDetails[groupId]) {
      return; // Already loaded
    }

    setLoadingDetails((prev) => ({ ...prev, [groupId]: true }));
    try {
      const ref = getAccessGroupByIdRef(dataConnect, { id: groupId });
      const result = await executeQuery(ref);
      
      if (result.data?.accessGroup) {
        setGroupDetails((prev) => ({
          ...prev,
          [groupId]: result.data.accessGroup,
        }));
      }
    } catch (err: any) {
      console.error(`Failed to fetch details for group ${groupId}:`, err);
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [groupId]: false }));
    }
  }, [groupDetails]);

  useEffect(() => {
    fetchAccessGroups();
  }, [fetchAccessGroups]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoadingAllUsers(true);
    (async () => {
      try {
        const ref = listUsersRef(dataConnect);
        const result = await executeQuery(ref);
        if (!cancelled && result.data?.users) {
          setAllUsers(result.data.users.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            membershipStatus: u.membershipStatus as MembershipStatus,
          })));
        }
      } catch {
        if (!cancelled) setAllUsers([]);
      } finally {
        if (!cancelled) setLoadingAllUsers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const handleExpand = (group: AccessGroupWithDetails) => {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(group.id);
      fetchGroupDetails(group.id);
    }
  };

  const handleAddUser = (groupId: string) => {
    setAddingToGroupId(groupId);
    setUserSearchTerm("");
    setSearchResults([]);
    setAddUserDialogOpen(true);
  };

  const handleSearchUsers = useCallback(async (term: string) => {
    if (!term.trim() || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const result = await searchUsers(term, 1, 10);
      if (result.success && result.data) {
        // Fetch full user data from DataConnect for each user to get membership status
        const usersWithData = await Promise.all(
          result.data.users.map(async (user) => {
            try {
              const userRef = getUserWithAccessGroupsRef(dataConnect, { id: user.uid });
              const userResult = await executeQuery(userRef);
              if (userResult.data?.user) {
                return {
                  id: userResult.data.user.id,
                  firstName: userResult.data.user.firstName,
                  lastName: userResult.data.user.lastName,
                  email: userResult.data.user.email,
                  membershipStatus: userResult.data.user.membershipStatus,
                };
              }
            } catch (err) {
              // If we can't fetch user data, use display name from search
              const nameParts = user.displayName?.split(", ") || [];
              return {
                id: user.uid,
                firstName: nameParts[1] || "",
                lastName: nameParts[0] || "",
                email: user.email,
                membershipStatus: "PENDING" as MembershipStatus, // Default if we can't fetch
              };
            }
            return null;
          })
        );
        setSearchResults(usersWithData.filter((u): u is NonNullable<typeof u> => u !== null));
      }
    } catch (err: any) {
      console.error("Failed to search users:", err);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  const handleAddUserToGroup = async (userId: string) => {
    if (!addingToGroupId) return;

    // Check if user is already in the group
    const currentDetails = groupDetails[addingToGroupId];
    if (currentDetails?.users?.some(u => u.user.id === userId)) {
      setError("User is already in this access group");
      return;
    }

    setAddingUserId(userId);
    setError(null);
    try {
      const ref = addUserToAccessGroupRef(dataConnect, {
        userId,
        accessGroupId: addingToGroupId,
      });
      await executeMutation(ref);
      
      // Refresh group details
      delete groupDetails[addingToGroupId];
      setGroupDetails({ ...groupDetails });
      await fetchGroupDetails(addingToGroupId);
      
      setAddUserDialogOpen(false);
      setAddingToGroupId(null);
      setUserSearchTerm("");
      setSearchResults([]);
    } catch (err: any) {
      setError(err?.message || "Failed to add user to group");
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveUserFromGroup = async (userId: string, groupId: string) => {
    if (!confirm("Are you sure you want to remove this user from the access group?")) {
      return;
    }

    try {
      const ref = removeUserFromAccessGroupRef(dataConnect, {
        userId,
        accessGroupId: groupId,
      });
      await executeMutation(ref);
      
      // Refresh group details
      delete groupDetails[groupId];
      setGroupDetails({ ...groupDetails });
      await fetchGroupDetails(groupId);
    } catch (err: any) {
      setError(err?.message || "Failed to remove user from group");
    }
  };

  const handleCreate = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupDescription("");
    setSelectedStatuses([]);
    setDialogOpen(true);
  };

  const handleEdit = (group: AccessGroupWithDetails) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setSelectedStatuses(group.membershipStatuses || []);
    setDialogOpen(true);
  };

  const handleDelete = async (group: AccessGroupWithDetails) => {
    if (!confirm(`Are you sure you want to delete the access group "${group.name}"? This will remove all user and section associations.`)) {
      return;
    }

    try {
      const ref = deleteAccessGroupRef(dataConnect, { id: group.id });
      await executeMutation(ref);
      await fetchAccessGroups();
      if (expandedGroupId === group.id) {
        setExpandedGroupId(null);
      }
      delete groupDetails[group.id];
      setGroupDetails({ ...groupDetails });
    } catch (err: any) {
      setError(err?.message || "Failed to delete access group");
    }
  };

  const handleSubmit = async () => {
    if (!groupName.trim()) {
      setError("Group name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (editingGroup) {
        // Update existing group
        const ref = updateAccessGroupRef(dataConnect, {
          id: editingGroup.id,
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          membershipStatuses: selectedStatuses.length > 0 ? selectedStatuses : null,
        });
        await executeMutation(ref);
      } else {
        // Create new group
        const ref = createAccessGroupRef(dataConnect, {
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          membershipStatuses: selectedStatuses.length > 0 ? selectedStatuses : null,
        });
        await executeMutation(ref);
      }
      setDialogOpen(false);
      await fetchAccessGroups();
    } catch (err: any) {
      setError(err?.message || `Failed to ${editingGroup ? "update" : "create"} access group`);
    } finally {
      setSubmitting(false);
    }
  };

  const details = expandedGroupId ? groupDetails[expandedGroupId] : null;
  const isLoadingDetails = expandedGroupId ? loadingDetails[expandedGroupId] : false;

  // Check admin status - show access denied if not admin
  if (!isAdmin) {
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Access Groups" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Access denied. Admin privileges required to manage access groups.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
      <PageHeader title="Access Groups" onBack={onBack} />
      
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="body2" sx={{ color: colors.titleSecondary }}>
          Manage access groups that control section visibility. Groups can include individual users and/or membership statuses (automatically includes all users with those statuses).
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          sx={{ ml: 2 }}
        >
          Create Access Group
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      ) : accessGroups.length === 0 ? (
        <Alert severity="info">No access groups found.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Membership Statuses</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Sections</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accessGroups.map((group) => (
                <React.Fragment key={group.id}>
                  <TableRow>
                    <TableCell>
                      <Typography variant="body2">
                        {group.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {group.description || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {group.membershipStatuses && group.membershipStatuses.length > 0 ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {group.membershipStatuses.map((status) => {
                            const statusOption = MEMBERSHIP_STATUS_OPTIONS.find(opt => opt.value === status);
                            return (
                              <Chip
                                key={status}
                                label={statusOption?.label || status}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            );
                          })}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {expandedGroupId === group.id && details ? (
                        <Typography variant="body2">
                          {details.users?.length || 0}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Click to view
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {expandedGroupId === group.id && details ? (
                        <Typography variant="body2">
                          {details.sections?.length || 0}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Click to view
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleExpand(group)}
                        disabled={isLoadingDetails}
                      >
                        <ExpandMoreIcon
                          sx={{
                            transform: expandedGroupId === group.id ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(group)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(group)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {expandedGroupId === group.id && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0 }}>
                        {isLoadingDetails ? (
                          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : details ? (
                          <Box sx={{ p: 2 }}>
                            <Accordion defaultExpanded>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", mr: 2 }}>
                                  <Typography variant="subtitle2">
                                    Users ({details.users?.length || 0})
                                  </Typography>
                                  <Button
                                    size="small"
                                    startIcon={<PersonAddIcon />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddUser(group.id);
                                    }}
                                    variant="outlined"
                                  >
                                    Add User
                                  </Button>
                                </Box>
                              </AccordionSummary>
                              <AccordionDetails>
                                {details.users && details.users.length > 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {details.users.map((userAccessGroup) => {
                                        const userStatus = userAccessGroup.user.membershipStatus;
                                        const isStatusBased = group.membershipStatuses?.includes(userStatus);
                                        return (
                                          <TableRow key={userAccessGroup.user.id}>
                                            <TableCell>
                                              {userAccessGroup.user.firstName} {userAccessGroup.user.lastName}
                                            </TableCell>
                                            <TableCell>{userAccessGroup.user.email}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={userStatus}
                                                size="small"
                                                variant="outlined"
                                              />
                                            </TableCell>
                                            <TableCell align="right">
                                              {isStatusBased ? (
                                                <Tooltip title="User is automatically included via membership status">
                                                  <Chip label="Auto" size="small" color="primary" variant="outlined" />
                                                </Tooltip>
                                              ) : (
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleRemoveUserFromGroup(userAccessGroup.user.id, group.id)}
                                                  color="error"
                                                >
                                                  <PersonRemoveIcon />
                                                </IconButton>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                      No users assigned to this group.
                                    </Typography>
                                    <Button
                                      size="small"
                                      startIcon={<PersonAddIcon />}
                                      onClick={() => handleAddUser(group.id)}
                                      variant="outlined"
                                    >
                                      Add User
                                    </Button>
                                  </Box>
                                )}
                              </AccordionDetails>
                            </Accordion>
                            {group.membershipStatuses && group.membershipStatuses.length > 0 && (
                              <Accordion defaultExpanded={false}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography variant="subtitle2">
                                    Users by membership status
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  {loadingAllUsers ? (
                                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                                      <CircularProgress size={24} />
                                    </Box>
                                  ) : (
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                      {MEMBERSHIP_STATUS_OPTIONS.map((option) => {
                                        const usersWithStatus = allUsers.filter((u) => u.membershipStatus === option.value);
                                        if (usersWithStatus.length === 0) return null;
                                        return (
                                          <Box key={option.value}>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                                              {option.label} ({usersWithStatus.length})
                                            </Typography>
                                            <Table size="small">
                                              <TableHead>
                                                <TableRow>
                                                  <TableCell>Name</TableCell>
                                                  <TableCell>Email</TableCell>
                                                </TableRow>
                                              </TableHead>
                                              <TableBody>
                                                {usersWithStatus.map((u) => (
                                                  <TableRow
                                                    key={u.id}
                                                    hover
                                                    sx={{ cursor: "pointer" }}
                                                    onClick={() => setSelectedUserDetail(u)}
                                                  >
                                                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                                                    <TableCell>{u.email}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  )}
                                </AccordionDetails>
                              </Accordion>
                            )}
                            <Accordion defaultExpanded>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2">
                                  Sections ({details.sections?.length || 0})
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                {details.sections && details.sections.length > 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Description</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {details.sections.map((sectionAccessGroup) => (
                                        <TableRow key={sectionAccessGroup.section.id}>
                                          <TableCell>{sectionAccessGroup.section.name}</TableCell>
                                          <TableCell>
                                            <Chip
                                              label={sectionAccessGroup.section.type}
                                              size="small"
                                              variant="outlined"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            {sectionAccessGroup.section.description || "-"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No sections assigned to this group.
                                  </Typography>
                                )}
                              </AccordionDetails>
                            </Accordion>
                          </Box>
                        ) : (
                          <Alert severity="error">Failed to load group details</Alert>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGroup ? "Edit Access Group" : "Create Access Group"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Name"
            fullWidth
            variant="outlined"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            inputProps={{ maxLength: MAX_NAME_LENGTH }}
            helperText={`${groupName.length}/${MAX_NAME_LENGTH} characters`}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
            helperText={`${groupDescription.length}/${MAX_DESCRIPTION_LENGTH} characters`}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Membership Statuses (Optional)</InputLabel>
            <Select
              multiple
              value={selectedStatuses}
              onChange={(e) => setSelectedStatuses(e.target.value as MembershipStatus[])}
              input={<OutlinedInput label="Membership Statuses (Optional)" />}
              renderValue={(selected) => {
                if (selected.length === 0) return "None";
                return selected
                  .map((status) => {
                    const option = MEMBERSHIP_STATUS_OPTIONS.find(opt => opt.value === status);
                    return option?.label || status;
                  })
                  .join(", ");
              }}
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={selectedStatuses.indexOf(option.value) > -1} />
                  <ListItemText primary={option.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Select membership statuses to automatically include all users with those statuses in this group.
            You can also manually add individual users to groups.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting || !groupName.trim()}>
            {submitting ? <CircularProgress size={20} /> : editingGroup ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onClose={() => setAddUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User to Access Group</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={searchResults}
            getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
            loading={searchingUsers}
            inputValue={userSearchTerm}
            onInputChange={(_, value) => {
              setUserSearchTerm(value);
              handleSearchUsers(value);
            }}
            onChange={(_, selectedUser) => {
              if (selectedUser) {
                handleAddUserToGroup(selectedUser.id);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Users"
                placeholder="Type to search by name or email (min 2 characters)..."
                margin="dense"
                fullWidth
                variant="outlined"
              />
            )}
            renderOption={(props, option) => {
              const groupDetailsForAdding = addingToGroupId ? groupDetails[addingToGroupId] : null;
              const isAlreadyInGroup = groupDetailsForAdding?.users?.some(u => u.user.id === option.id);
              return (
                <Box 
                  component="li" 
                  {...props} 
                  sx={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    opacity: isAlreadyInGroup ? 0.5 : 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2">
                      {option.firstName} {option.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    {isAlreadyInGroup && (
                      <Chip label="Already in group" size="small" color="info" />
                    )}
                    <Chip
                      label={option.membershipStatus}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              );
            }}
            filterOptions={(x) => x} // We're handling filtering server-side
            sx={{ mt: 1 }}
            disabled={addingUserId !== null}
            getOptionDisabled={(option) => {
              // Only disable if user is already in the group
              const groupDetailsForAdding = addingToGroupId ? groupDetails[addingToGroupId] : null;
              const isAlreadyInGroup = groupDetailsForAdding?.users?.some(u => u.user.id === option.id);
              return isAlreadyInGroup || false;
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            Search for users by name or email. Note: Restricted users (PENDING, RESIGNED, LOST, DECEASED) cannot log in but can be added to access groups to preserve memberships.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddUserDialogOpen(false);
            setAddingToGroupId(null);
            setUserSearchTerm("");
            setSearchResults([]);
          }} disabled={addingUserId !== null}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* User detail (from "Users by membership status" click) */}
      <Dialog open={!!selectedUserDetail} onClose={() => setSelectedUserDetail(null)} maxWidth="xs" fullWidth>
        <DialogTitle>User</DialogTitle>
        <DialogContent>
          {selectedUserDetail && (
            <Box sx={{ pt: 0.5 }}>
              <Typography variant="body2">
                <strong>{selectedUserDetail.firstName} {selectedUserDetail.lastName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUserDetail.email}
              </Typography>
              <Chip label={selectedUserDetail.membershipStatus} size="small" variant="outlined" sx={{ mt: 1 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedUserDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
