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
  listAccessGroupsRef,
  grantViewAccessGroupToSectionRef,
  grantMemberAccessGroupToSectionRef,
  revokeViewAccessGroupFromSectionRef,
  revokeMemberAccessGroupFromSectionRef,
  type ListSectionsData,
  type SectionType,
  type GetSectionByIdData,
  type ListAccessGroupsData,
} from "@dataconnect/generated";
import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from "../../../constants";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import "../../../shared/components/PageContainer.css";

const SectionAccessGroupPurpose = { VIEW: "VIEW", MEMBER: "MEMBER" } as const;
type SectionAccessGroupPurpose = (typeof SectionAccessGroupPurpose)[keyof typeof SectionAccessGroupPurpose];

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

export default function ManageSections({ onBack }: ManageSectionsProps) {
  const isAdmin = useAdminClaim(auth.currentUser);
  const [sections, setSections] = useState<SectionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionWithDetails | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [sectionType, setSectionType] = useState<SectionType>("MEMBERS");
  const [sectionDescription, setSectionDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Access groups state
  const [sectionAccessGroups, setSectionAccessGroups] = useState<Array<{
    id: string;
    name: string;
    description?: string | null;
    purpose: SectionAccessGroupPurpose;
  }>>([]);
  const [allAccessGroups, setAllAccessGroups] = useState<ListAccessGroupsData["accessGroups"]>([]);
  const [loadingAccessGroups, setLoadingAccessGroups] = useState(false);
  const [addAccessGroupDialogOpen, setAddAccessGroupDialogOpen] = useState(false);
  const [selectedAccessGroup, setSelectedAccessGroup] = useState<{ id: string; name: string } | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<SectionAccessGroupPurpose>(SectionAccessGroupPurpose.VIEW);
  const [addingAccessGroup, setAddingAccessGroup] = useState(false);
  const [removingAccessGroupId, setRemovingAccessGroupId] = useState<string | null>(null);

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

  const fetchAllAccessGroups = useCallback(async () => {
    try {
      const ref = listAccessGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      setAllAccessGroups(result.data?.accessGroups || []);
    } catch (err: any) {
      console.error("Failed to fetch access groups:", err);
    }
  }, []);

  const fetchSectionAccessGroups = useCallback(async (sectionId: string) => {
    setLoadingAccessGroups(true);
    try {
      const ref = getSectionByIdRef(dataConnect, { id: sectionId });
      const result = await executeQuery(ref);
      const section = result.data?.section;
      
      if (section) {
        const accessGroups: Array<{
          id: string;
          name: string;
          description?: string | null;
          purpose: SectionAccessGroupPurpose;
        }> = [];
        
        // Add viewing access groups
        if (section.viewingAccessGroups) {
          section.viewingAccessGroups.forEach((group) => {
            if (group.accessGroup) {
              accessGroups.push({
                id: group.accessGroup.id,
                name: group.accessGroup.name,
                description: group.accessGroup.description,
                purpose: SectionAccessGroupPurpose.VIEW,
              });
            }
          });
        }
        
        // Add member access groups
        if (section.memberAccessGroups) {
          section.memberAccessGroups.forEach((group) => {
            if (group.accessGroup) {
              accessGroups.push({
                id: group.accessGroup.id,
                name: group.accessGroup.name,
                description: group.accessGroup.description,
                purpose: SectionAccessGroupPurpose.MEMBER,
              });
            }
          });
        }
        
        setSectionAccessGroups(accessGroups);
      }
    } catch (err: any) {
      console.error("Failed to fetch section access groups:", err);
      setSectionAccessGroups([]);
    } finally {
      setLoadingAccessGroups(false);
    }
  }, []);

  useEffect(() => {
    fetchAllAccessGroups();
  }, [fetchAllAccessGroups]);

  const handleCreate = () => {
    setEditingSection(null);
    setSectionName("");
    setSectionType("MEMBERS");
    setSectionDescription("");
    setSectionAccessGroups([]);
    setDialogOpen(true);
  };

  const handleEdit = async (section: SectionWithDetails) => {
    setEditingSection(section);
    setSectionName(section.name);
    setSectionType(section.type);
    setSectionDescription(section.description || "");
    setDialogOpen(true);
    // Fetch access groups when editing
    await fetchSectionAccessGroups(section.id);
  };

  const handleDelete = async (section: SectionWithDetails) => {
    if (!confirm(`Are you sure you want to delete the section "${section.name}"? This will remove all access group associations.`)) {
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

  const handleAddAccessGroup = async () => {
    if (!selectedAccessGroup || !editingSection) {
      return;
    }

    setAddingAccessGroup(true);
    setError(null);
    try {
      const ref =
        selectedPurpose === SectionAccessGroupPurpose.VIEW
          ? grantViewAccessGroupToSectionRef(dataConnect, {
              sectionId: editingSection.id,
              accessGroupId: selectedAccessGroup.id,
            })
          : grantMemberAccessGroupToSectionRef(dataConnect, {
              sectionId: editingSection.id,
              accessGroupId: selectedAccessGroup.id,
            });
      await executeMutation(ref);
      
      // Refresh section access groups
      await fetchSectionAccessGroups(editingSection.id);
      
      // Reset add dialog
      setSelectedAccessGroup(null);
      setSelectedPurpose(SectionAccessGroupPurpose.VIEW);
      setAddAccessGroupDialogOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to add access group");
    } finally {
      setAddingAccessGroup(false);
    }
  };

  const handleRemoveAccessGroup = async (accessGroupId: string, purpose: SectionAccessGroupPurpose) => {
    if (!editingSection) {
      return;
    }

    if (!confirm("Are you sure you want to remove this access group from the section?")) {
      return;
    }

    setRemovingAccessGroupId(accessGroupId);
    setError(null);
    try {
      const ref =
        purpose === SectionAccessGroupPurpose.VIEW
          ? revokeViewAccessGroupFromSectionRef(dataConnect, {
              sectionId: editingSection.id,
              accessGroupId: accessGroupId,
            })
          : revokeMemberAccessGroupFromSectionRef(dataConnect, {
              sectionId: editingSection.id,
              accessGroupId: accessGroupId,
            });
      await executeMutation(ref);
      
      // Refresh section access groups
      await fetchSectionAccessGroups(editingSection.id);
    } catch (err: any) {
      setError(err?.message || "Failed to remove access group");
    } finally {
      setRemovingAccessGroupId(null);
    }
  };

  // Get available access groups (not already associated with section)
  const availableAccessGroups = allAccessGroups.filter(
    (group) => !sectionAccessGroups.some((ag) => ag.id === group.id)
  );

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
          setAddAccessGroupDialogOpen(false);
          setSectionAccessGroups([]);
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
          
          {/* Access Groups Section - Only show when editing */}
          {editingSection && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>
                Access Groups
              </Typography>
              
              {loadingAccessGroups ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : sectionAccessGroups.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No access groups assigned to this section.
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
                      {sectionAccessGroups.map((group) => (
                        <TableRow key={group.id}>
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
                              color={group.purpose === SectionAccessGroupPurpose.VIEW ? "primary" : "secondary"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveAccessGroup(group.id, group.purpose)}
                              color="error"
                              disabled={removingAccessGroupId === group.id}
                            >
                              {removingAccessGroupId === group.id ? (
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
                  setSelectedAccessGroup(null);
                  setSelectedPurpose(SectionAccessGroupPurpose.VIEW);
                  setAddAccessGroupDialogOpen(true);
                }}
                disabled={loadingAccessGroups}
                sx={{ mb: 2 }}
              >
                Add Access Group
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

      {/* Add Access Group Dialog */}
      <Dialog open={addAccessGroupDialogOpen} onClose={() => setAddAccessGroupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Access Group to Section</DialogTitle>
        <DialogContent>
          {availableAccessGroups.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              All available access groups have been assigned to this section.
            </Alert>
          ) : (
            <>
              <Autocomplete
                options={availableAccessGroups}
                getOptionLabel={(option) => option.name}
                value={selectedAccessGroup}
                onChange={(_, newValue) => setSelectedAccessGroup(newValue ? { id: newValue.id, name: newValue.name } : null)}
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
                        <Typography variant="caption" color="text.secondary" display="block">
                          {option.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                disabled={addingAccessGroup}
                sx={{ mt: 1, mb: 2 }}
              />
              
              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend">Purpose</FormLabel>
                <RadioGroup
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as SectionAccessGroupPurpose)}
                >
                  <FormControlLabel value={SectionAccessGroupPurpose.VIEW} control={<Radio />} label="VIEW - Users can see the section" />
                  <FormControlLabel value={SectionAccessGroupPurpose.MEMBER} control={<Radio />} label="MEMBER - Users appear in member list" />
                </RadioGroup>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddAccessGroupDialogOpen(false)} disabled={addingAccessGroup}>
            Cancel
          </Button>
          <Button
            onClick={handleAddAccessGroup}
            variant="contained"
            disabled={addingAccessGroup || !selectedAccessGroup}
          >
            {addingAccessGroup ? <CircularProgress size={20} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
