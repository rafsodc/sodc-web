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
} from "@mui/icons-material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  listAccessGroupsRef,
  getAccessGroupByIdRef,
  createAccessGroupRef,
  updateAccessGroupRef,
  deleteAccessGroupRef,
  type ListAccessGroupsData,
  type GetAccessGroupByIdData,
} from "@dataconnect/generated";
import { MembershipStatus } from "@dataconnect/generated";
import { MEMBERSHIP_STATUS_OPTIONS } from "../../../constants";
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
} from "@mui/material";

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

  const handleExpand = (group: AccessGroupWithDetails) => {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(group.id);
      fetchGroupDetails(group.id);
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

  return (
    <Box sx={{ p: 3 }}>
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
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
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
                                <Typography variant="subtitle2">
                                  Users ({details.users?.length || 0})
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                {details.users && details.users.length > 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Status</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {details.users.map((userAccessGroup) => (
                                        <TableRow key={userAccessGroup.user.id}>
                                          <TableCell>
                                            {userAccessGroup.user.firstName} {userAccessGroup.user.lastName}
                                          </TableCell>
                                          <TableCell>{userAccessGroup.user.email}</TableCell>
                                          <TableCell>
                                            <Chip
                                              label={userAccessGroup.user.membershipStatus}
                                              size="small"
                                              variant="outlined"
                                            />
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No users assigned to this group.
                                  </Typography>
                                )}
                              </AccordionDetails>
                            </Accordion>
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
    </Box>
  );
}
