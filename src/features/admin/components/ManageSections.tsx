import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Alert,
} from "@mui/material";
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
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import { useLocation } from "react-router-dom";
import "../../../shared/components/PageContainer.css";
import {
  AddSectionUserGroupDialogSurface,
  ManageSectionsListSurface,
  SectionEditorDialogSurface,
} from "./ManageSectionsSurfaces";
import type { SectionUserGroupRow, SectionWithDetails } from "./manageSectionsTypes";

interface ManageSectionsProps {
  onBack: () => void;
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
  const [sectionUserGroups, setSectionUserGroups] = useState<SectionUserGroupRow[]>([]);
  const [allUserGroups, setAllUserGroups] = useState<ListUserGroupsData["userGroups"]>([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [addUserGroupDialogOpen, setAddUserGroupDialogOpen] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<{
    id: string;
    name: string;
    description?: string | null;
  } | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState<SectionUserGroupPurpose>(SectionUserGroupPurpose.ACCESS);
  const [addingUserGroup, setAddingUserGroup] = useState(false);
  const [removingUserGroupId, setRemovingUserGroupId] = useState<string | null>(null);
  const [managedSectionId, setManagedSectionId] = useState<string | null>(initialState?.managedSection?.id ?? null);
  const [managedSectionName, setManagedSectionName] = useState(initialState?.managedSection?.name ?? "");
  const initialEventIdRef = useRef(initialState?.eventId ?? null);
  const initialEditSectionIdRef = useRef(initialState?.editSectionId ?? null);

  useEffect(() => {
    const state = location.state as ManageSectionsLocationState | null;
    if (state?.managedSection) {
      setManagedSectionId(state.managedSection.id);
      setManagedSectionName(state.managedSection.name);
      initialEventIdRef.current = state.eventId ?? null;
      return;
    }
    if (state?.editSectionId) {
      initialEditSectionIdRef.current = state.editSectionId;
      return;
    }
    setManagedSectionId(null);
    setManagedSectionName("");
    initialEventIdRef.current = null;
    initialEditSectionIdRef.current = null;
  }, [location.state]);

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
        const rows: SectionUserGroupRow[] = [];
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

  const handleEdit = useCallback(async (section: SectionWithDetails) => {
    setEditingSection(section);
    setSectionName(section.name);
    setSectionType(section.type);
    setSectionDescription(section.description || "");
    setDialogOpen(true);
    // Fetch user groups when editing
    await fetchSectionUserGroups(section.id);
  }, [fetchSectionUserGroups]);

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

  const handleDialogClose = () => {
    setDialogOpen(false);
    setAddUserGroupDialogOpen(false);
    setSectionUserGroups([]);
  };

  const handleManageEvents = (section: SectionWithDetails) => {
    setManagedSectionId(section.id);
    setManagedSectionName(section.name);
  };

  const handleOpenAddUserGroup = () => {
    setSelectedUserGroup(null);
    setSelectedPurpose(SectionUserGroupPurpose.ACCESS);
    setAddUserGroupDialogOpen(true);
  };

  const handlePurposeChange = (purpose: SectionUserGroupPurpose) => {
    setSelectedPurpose(purpose);
    setSelectedUserGroup(null);
  };

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
      <ManageSectionsListSurface
        onBack={onBack}
        error={error}
        onDismissError={() => setError(null)}
        loading={loading}
        sections={sections}
        onCreate={handleCreate}
        onManageEvents={handleManageEvents}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <SectionEditorDialogSurface
        open={dialogOpen}
        editingSection={editingSection}
        sectionName={sectionName}
        sectionType={sectionType}
        sectionDescription={sectionDescription}
        submitting={submitting}
        loadingUserGroups={loadingUserGroups}
        sectionUserGroups={sectionUserGroups}
        removingUserGroupId={removingUserGroupId}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        onSectionNameChange={setSectionName}
        onSectionTypeChange={setSectionType}
        onSectionDescriptionChange={setSectionDescription}
        onOpenAddUserGroup={handleOpenAddUserGroup}
        onRemoveUserGroup={handleRemoveUserGroup}
      />

      <AddSectionUserGroupDialogSurface
        open={addUserGroupDialogOpen}
        selectedPurpose={selectedPurpose}
        selectedUserGroup={selectedUserGroup}
        availableUserGroups={availableUserGroups}
        addingUserGroup={addingUserGroup}
        onClose={() => setAddUserGroupDialogOpen(false)}
        onAdd={handleAddUserGroup}
        onPurposeChange={handlePurposeChange}
        onUserGroupChange={setSelectedUserGroup}
      />
    </Box>
  );
}
