import { useState, useEffect, useCallback, useRef } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  listSectionsRef,
  createSectionRef,
  updateSectionRef,
  deleteSectionRef,
  getSectionByIdRef,
  listUserGroupsRef,
  grantUserGroupToSectionForPurposeRef,
  revokeUserGroupFromSectionForPurposeRef,
  SectionUserGroupPurpose,
  type SectionType,
  type ListUserGroupsData,
} from "@dataconnect/generated";
import SectionEventsManager from "./SectionEventsManager";
import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from "../../../constants";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import { useLocation } from "react-router-dom";
import "../../../shared/components/PageContainer.css";

const SECTION_PURPOSE_ORDER: SectionUserGroupPurpose[] = [
  SectionUserGroupPurpose.ACCESS,
  SectionUserGroupPurpose.MEMBER,
  SectionUserGroupPurpose.BOOKER,
  SectionUserGroupPurpose.MESSAGE,
  SectionUserGroupPurpose.MODERATOR,
];

const SECTION_PURPOSE_HELP: Record<SectionUserGroupPurpose, { title: string; body: string }> = {
  [SectionUserGroupPurpose.ACCESS]: {
    title: "ACCESS",
    body: "Who can open this section in the app. Users must belong to at least one linked group (or match a status-based group) to see the section.",
  },
  [SectionUserGroupPurpose.MEMBER]: {
    title: "MEMBER",
    body: "Who counts as a member for this section: member list, and which groups users can self-subscribe into when the group is subscribable.",
  },
  [SectionUserGroupPurpose.BOOKER]: {
    title: "BOOKER",
    body: "EVENTS sections only. Which groups may book tickets when an event is open for booking. Users still need ACCESS (or MODERATOR), the right ticket type, and a booking window. If no group is given BOOKER for this section, no one can book.",
  },
  [SectionUserGroupPurpose.MESSAGE]: {
    title: "MESSAGE",
    body: "Reserved for future messaging or announcements tied to this section.",
  },
  [SectionUserGroupPurpose.MODERATOR]: {
    title: "MODERATOR",
    body: "Elevated access for this section. Counts like ACCESS for seeing the section, plus moderator-style capabilities as the app defines them.",
  },
};

interface ManageSectionsProps {
  onBack: () => void;
}

interface SectionWithDetails {
  id: string;
  name: string;
  type: SectionType;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ManageSectionsLocationState {
  managedSection?: {
    id: string;
    name: string;
  };
  eventId?: string;
  editSectionId?: string;
}

export default function ManageSections({ onBack }: ManageSectionsProps) {
  const location = useLocation();
  const initialState = location.state as ManageSectionsLocationState | null;
  const isAdmin = useAdminClaim(auth.currentUser);
  const [sections, setSections] = useState<SectionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionWithDetails | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [sectionType, setSectionType] = useState<SectionType>("MEMBERS" as SectionType);
  const [sectionDescription, setSectionDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // User groups state
  const [sectionUserGroups, setSectionUserGroups] = useState<Array<{
    id: string;
    name: string;
    description?: string | null;
    purpose: SectionUserGroupPurpose;
  }>>([]);
  const [allUserGroups, setAllUserGroups] = useState<ListUserGroupsData["userGroups"]>([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [addUserGroupDialogOpen, setAddUserGroupDialogOpen] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<{ id: string; name: string } | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<SectionUserGroupPurpose>(SectionUserGroupPurpose.ACCESS);
  const [addingUserGroup, setAddingUserGroup] = useState(false);
  const [removingUserGroupId, setRemovingUserGroupId] = useState<string | null>(null);
  const [managedSectionId, setManagedSectionId] = useState<string | null>(initialState?.managedSection?.id ?? null);
  const [managedSectionName, setManagedSectionName] = useState(initialState?.managedSection?.name ?? "");
  const initialEventIdRef = useRef(initialState?.eventId ?? null);
  const initialEditSectionIdRef = useRef(initialState?.editSectionId ?? null);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = listSectionsRef(dataConnect);
      const result = await executeQuery(ref);
      
      // Get existing sections from database
      const existingSections: SectionWithDetails[] = result.data?.sections?.map((section) => ({
        id: section.id,
        name: section.name,
        type: section.type,
        description: section.description,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
      })) || [];
      
      // Sort alphabetically
      existingSections.sort((a, b) => a.name.localeCompare(b.name));
      
      setSections(existingSections);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch sections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const fetchAllUserGroups = useCallback(async () => {
    try {
      const ref = listUserGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      setAllUserGroups(result.data?.userGroups || []);
    } catch (err: any) {
      console.error("Failed to fetch user groups:", err);
    }
  }, []);

  const fetchSectionUserGroups = useCallback(async (sectionId: string) => {
    setLoadingUserGroups(true);
    try {
      const ref = getSectionByIdRef(dataConnect, { id: sectionId });
      const result = await executeQuery(ref);
      const section = result.data?.section;
      
      if (section?.purposeLinks?.length) {
        const rows: Array<{
          id: string;
          name: string;
          description?: string | null;
          purpose: SectionUserGroupPurpose;
        }> = [];
        section.purposeLinks.forEach((link) => {
          if (link.userGroup) {
            rows.push({
              id: link.userGroup.id,
              name: link.userGroup.name,
              description: link.userGroup.description,
              purpose: link.purpose,
            });
          }
        });
        setSectionUserGroups(rows);
      } else {
        setSectionUserGroups([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch section user groups:", err);
      setSectionUserGroups([]);
    } finally {
      setLoadingUserGroups(false);
    }
  }, []);

  useEffect(() => {
    fetchAllUserGroups();
  }, [fetchAllUserGroups]);

  const handleCreate = () => {
    setEditingSection(null);
    setSectionName("");
    setSectionType("MEMBERS" as SectionType);
    setSectionDescription("");
    setSectionUserGroups([]);
    setDialogOpen(true);
  };

  const handleEdit = async (section: SectionWithDetails) => {
    setEditingSection(section);
    setSectionName(section.name);
    setSectionType(section.type);
    setSectionDescription(section.description || "");
    setDialogOpen(true);
    // Fetch user groups when editing
    await fetchSectionUserGroups(section.id);
  };

  useEffect(() => {
    const editSectionId = initialEditSectionIdRef.current;
    if (!editSectionId || loading || managedSectionId) {
      return;
    }

    const section = sections.find((item) => item.id === editSectionId);
    if (!section) {
      return;
    }

    initialEditSectionIdRef.current = null;
    void handleEdit(section);
  }, [handleEdit, loading, managedSectionId, sections]);

  const handleDelete = async (section: SectionWithDetails) => {
    if (!confirm(`Are you sure you want to delete the section "${section.name}"? This will remove all user group associations.`)) {
      return;
    }

    try {
      const ref = deleteSectionRef(dataConnect, { id: section.id });
      await executeMutation(ref);
      await fetchSections();
    } catch (err: any) {
      setError(err?.message || "Failed to delete section");
    }
  };

  const handleSubmit = async () => {
    if (!sectionName.trim()) {
      setError("Section name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (editingSection) {
        // Update existing section
        const ref = updateSectionRef(dataConnect, {
          id: editingSection.id,
          name: sectionName.trim(),
          description: sectionDescription.trim() || null,
        });
        await executeMutation(ref);
      } else {
        // Create new section
        const ref = createSectionRef(dataConnect, {
          name: sectionName.trim(),
          type: sectionType,
          description: sectionDescription.trim() || null,
        });
        await executeMutation(ref);
      }
      setDialogOpen(false);
      await fetchSections();
    } catch (err: any) {
      setError(err?.message || `Failed to ${editingSection ? "update" : "create"} section`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddUserGroup = async () => {
    if (!selectedUserGroup || !editingSection) {
      return;
    }

    setAddingUserGroup(true);
    setError(null);
    try {
      const ref = grantUserGroupToSectionForPurposeRef(dataConnect, {
        sectionId: editingSection.id,
        userGroupId: selectedUserGroup.id,
        purpose: selectedPurpose,
      });
      await executeMutation(ref);
      
      await fetchSectionUserGroups(editingSection.id);
      
      setSelectedUserGroup(null);
      setSelectedPurpose(SectionUserGroupPurpose.ACCESS);
      setAddUserGroupDialogOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to add user group");
    } finally {
      setAddingUserGroup(false);
    }
  };

  const handleRemoveUserGroup = async (userGroupId: string, purpose: SectionUserGroupPurpose) => {
    if (!editingSection) {
      return;
    }

    if (!confirm("Are you sure you want to remove this user group from the section?")) {
      return;
    }

    const removingKey = `${userGroupId}-${purpose}`;
    setRemovingUserGroupId(removingKey);
    setError(null);
    try {
      const ref = revokeUserGroupFromSectionForPurposeRef(dataConnect, {
        sectionId: editingSection.id,
        userGroupId,
        purpose,
      });
      await executeMutation(ref);
      
      // Refresh section user groups
      await fetchSectionUserGroups(editingSection.id);
    } catch (err: any) {
      setError(err?.message || "Failed to remove user group");
    } finally {
      setRemovingUserGroupId(null);
    }
  };

  // Get available user groups for the selected purpose (allow same group for both ACCESS and MEMBER)
  const availableUserGroups = allUserGroups.filter(
    (group) =>
      !sectionUserGroups.some(
        (existing) => existing.id === group.id && existing.purpose === selectedPurpose
      )
  );

  if (managedSectionId && managedSectionName) {
    return (
      <SectionEventsManager
        sectionId={managedSectionId}
        sectionName={managedSectionName}
        initialEventId={initialEventIdRef.current}
        onBack={() => {
          setManagedSectionId(null);
          setManagedSectionName("");
          initialEventIdRef.current = null;
        }}
      />
    );
  }

  // Check admin status - show access denied if not admin
  if (!isAdmin) {
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Manage Sections" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Access denied. Admin privileges required to manage sections.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
      <PageHeader title="Manage Sections" onBack={onBack} />
      
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="body2" sx={{ color: colors.titleSecondary }}>
          Manage sections that organize content and control access. Sections can be MEMBERS (user lists) or EVENTS (event listings).
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          sx={{ ml: 2 }}
        >
          Create Section
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
      ) : sections.length === 0 ? (
        <Alert severity="info">No sections found.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sections.map((section) => (
                <TableRow key={section.id}>
                  <TableCell>
                    <Typography variant="body2">
                      {section.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={section.type}
                      size="small"
                      color={section.type === "MEMBERS" ? "primary" : "secondary"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {section.description || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {section.type === "EVENTS" && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setManagedSectionId(section.id);
                          setManagedSectionName(section.name);
                        }}
                        sx={{ mr: 1 }}
                      >
                        Manage events
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(section)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(section)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => {
          setDialogOpen(false);
          setAddUserGroupDialogOpen(false);
          setSectionUserGroups([]);
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingSection ? "Edit Section" : "Create Section"}
        </DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <TextField
            autoFocus
            margin="dense"
            label="Section Name"
            fullWidth
            variant="outlined"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            inputProps={{ maxLength: MAX_NAME_LENGTH }}
            helperText={`${sectionName.length}/${MAX_NAME_LENGTH} characters`}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel>Section Type</InputLabel>
            <Select
              value={sectionType}
              onChange={(e) => setSectionType(e.target.value as SectionType)}
              label="Section Type"
              disabled={!!editingSection} // Read-only when editing
            >
              <MenuItem value="MEMBERS">MEMBERS</MenuItem>
              <MenuItem value="EVENTS">EVENTS</MenuItem>
            </Select>
            {editingSection && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Section type cannot be changed after creation.
              </Typography>
            )}
          </FormControl>
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={sectionDescription}
            onChange={(e) => setSectionDescription(e.target.value)}
            inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
            helperText={`${sectionDescription.length}/${MAX_DESCRIPTION_LENGTH} characters`}
            sx={{ mb: 2 }}
          />
          
          {/* User Groups Section - Only show when editing */}
          {editingSection && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>
                User Groups
              </Typography>
              
              {loadingUserGroups ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : sectionUserGroups.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No user groups assigned to this section.
                </Alert>
              ) : (
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Group Name</TableCell>
                        <TableCell>Purpose</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sectionUserGroups.map((group) => (
                        <TableRow key={`${group.id}-${group.purpose}`}>
                          <TableCell>
                            <Typography variant="body2">{group.name}</Typography>
                            {group.description && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {group.description}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={group.purpose}
                              size="small"
                              color={
                                group.purpose === SectionUserGroupPurpose.ACCESS
                                  ? "primary"
                                  : group.purpose === SectionUserGroupPurpose.MEMBER
                                    ? "secondary"
                                    : "default"
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveUserGroup(group.id, group.purpose)}
                              color="error"
                              disabled={removingUserGroupId === `${group.id}-${group.purpose}`}
                            >
                              {removingUserGroupId === `${group.id}-${group.purpose}` ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon />
                              )}
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  setSelectedUserGroup(null);
                  setSelectedPurpose(SectionUserGroupPurpose.ACCESS);
                  setAddUserGroupDialogOpen(true);
                }}
                disabled={loadingUserGroups}
                sx={{ mb: 2 }}
              >
                Add User Group
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting || !sectionName.trim()}>
            {submitting ? <CircularProgress size={20} /> : editingSection ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add User Group Dialog */}
      <Dialog open={addUserGroupDialogOpen} onClose={() => setAddUserGroupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User Group to Section</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
            <FormLabel component="legend">Purpose</FormLabel>
            <RadioGroup
              value={selectedPurpose}
              onChange={(e) => {
                setSelectedPurpose(e.target.value as SectionUserGroupPurpose);
                setSelectedUserGroup(null);
              }}
            >
              {SECTION_PURPOSE_ORDER.map((p) => (
                <FormControlLabel
                  key={p}
                  value={p}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" component="span" fontWeight={600}>
                        {SECTION_PURPOSE_HELP[p].title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {SECTION_PURPOSE_HELP[p].body}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>

          {availableUserGroups.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              All available user groups have been assigned for the selected purpose.
            </Alert>
          ) : (
            <Autocomplete
              options={availableUserGroups}
              getOptionLabel={(option) => option.name}
              value={selectedUserGroup}
              onChange={(_, newValue) => setSelectedUserGroup(newValue ? { id: newValue.id, name: newValue.name } : null)}
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
              renderOption={(props, option) => {
                const group = option as { id: string; name: string; description?: string | null };
                return (
                  <Box component="li" {...props}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">{group.name}</Typography>
                      {group.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {group.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }}
              disabled={addingUserGroup}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddUserGroupDialogOpen(false)} disabled={addingUserGroup}>
            Cancel
          </Button>
          <Button
            onClick={handleAddUserGroup}
            variant="contained"
            disabled={addingUserGroup || !selectedUserGroup}
          >
            {addingUserGroup ? <CircularProgress size={20} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
