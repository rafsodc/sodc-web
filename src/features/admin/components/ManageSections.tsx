import { captureSession, isSessionCurrent, isPrivateSessionSuspended } from "../../../shared/appShell/sessionLifecycle";
import { useSessionMutation } from "../../../shared/hooks/useSessionMutation";
import ConfirmationDialog from "../../../shared/components/ConfirmationDialog";
import { idsEqual } from "../../../shared/utils/uuid";
import {
  useSessionDraft,
  useDraftUnloadWarning,
} from "../../../shared/hooks/useSessionDraft";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";
import { useState, useEffect, useCallback, useRef } from "react";
import { Box, Alert, Button } from "@mui/material";
import { dataConnect } from "../../../config/firebase";
import {
  executeDataConnectMutation,
  executeDataConnectQuery,
} from "../../../shared/query/dataConnectExecution";
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
import {
  sectionConfigurationPath,
  sectionManagementPath,
  eventManagementPath,
  normalizedResourceId,
} from "../../../shared/navigation/sectionRoutes";
import PageHeader from "../../../shared/components/PageHeader";
import SnackbarAlert from "../../../shared/components/SnackbarAlert";
import { useSnackbar } from "../../../shared/hooks/useSnackbar";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import "../../../shared/components/PageContainer.css";
import {
  AddSectionUserGroupDialogSurface,
  ManageSectionsListSurface,
  SectionEditorDialogSurface,
} from "./ManageSectionsSurfaces";
import type {
  SectionUserGroupRow,
  SectionWithDetails,
} from "./manageSectionsTypes";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateSectionsForUser } from "../../../shared/query/invalidation";

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
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = location.state as ManageSectionsLocationState | null;
  const isAdmin = useAdminClaim(auth.currentUser);
  const [sections, setSections] = useState<SectionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { snackbar, showSuccess, close: closeSnackbar } = useSnackbar();

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] =
    useState<SectionWithDetails | null>(null);
  const configurationId =
    new URLSearchParams(location.search).get("section") ??
    initialState?.editSectionId ??
    "new";
  const [configurationDraft, setConfigurationDraft, discardConfigurationDraft] =
    useSessionDraft(
      `section-configuration:${normalizedResourceId(configurationId)}`,
      {
        initialized: false,
        dirty: false,
        name: "",
        type: "MEMBERS" as SectionType,
        description: "",
      },
    );
  const configurationWrite = useSessionMutation<unknown>(
    `section-config-write:${normalizedResourceId(configurationId)}`,
  );
  const [configurationReview, setConfigurationReview] = useState<{
    receipt: object;
    locationKey: string;
    isCurrent: () => boolean;
    titles: string[];
  } | null>(null);
  const activeConfigurationReview = configurationReview?.locationKey === location.key &&
    configurationReview.receipt === configurationWrite.receipt && configurationReview.isCurrent()
    ? configurationReview : null;
  const {
    name: sectionName,
    type: sectionType,
    description: sectionDescription,
  } = configurationDraft;
  const setSectionName = useCallback(
    (name: string) =>
      setConfigurationDraft((previous) => ({ ...previous, name, dirty: true })),
    [setConfigurationDraft],
  );
  const setSectionType = useCallback(
    (type: SectionType) =>
      setConfigurationDraft((previous) => ({ ...previous, type, dirty: true })),
    [setConfigurationDraft],
  );
  const setSectionDescription = useCallback(
    (description: string) =>
      setConfigurationDraft((previous) => ({
        ...previous,
        description,
        dirty: true,
      })),
    [setConfigurationDraft],
  );
  useDraftUnloadWarning(dialogOpen && configurationDraft.dirty);
  const editorSaveGuard = useLatestRequestGuard();
  useEffect(() => {
    editorSaveGuard.invalidate();
    setSubmitting(false);
    setConfigurationReview(null);
    return () => editorSaveGuard.invalidate();
  }, [location.search, editorSaveGuard]);
  const [submitting, setSubmitting] = useState(false);

  // User groups state
  const [sectionUserGroups, setSectionUserGroups] = useState<
    SectionUserGroupRow[]
  >([]);
  const [allUserGroups, setAllUserGroups] = useState<
    ListUserGroupsData["userGroups"]
  >([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [addUserGroupDialogOpen, setAddUserGroupDialogOpen] = useState(false);
  const [selectedUserGroup, setSelectedUserGroup] = useState<{
    id: string;
    name: string;
    description?: string | null;
  } | null>(null);
  const [selectedPurpose, setSelectedPurpose] =
    useState<SectionUserGroupPurpose>(SectionUserGroupPurpose.ACCESS);
  const [addingUserGroup, setAddingUserGroup] = useState(false);
  const [removingUserGroupId, setRemovingUserGroupId] = useState<string | null>(
    null,
  );
  const [managedSectionId, setManagedSectionId] = useState<string | null>(
    initialState?.managedSection?.id ?? null,
  );
  const [managedSectionName, setManagedSectionName] = useState(
    initialState?.managedSection?.name ?? "",
  );
  const initialEventIdRef = useRef(initialState?.eventId ?? null);
  const initialEditSectionIdRef = useRef(
    new URLSearchParams(location.search).get("section") ??
      initialState?.editSectionId ??
      null,
  );

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
    initialEditSectionIdRef.current = new URLSearchParams(location.search).get(
      "section",
    );
  }, [location.state, location.search]);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = listSectionsRef(dataConnect);
      const result = await executeDataConnectQuery(ref);
      if (!Array.isArray(result.data?.sections))
        throw new Error("The latest section list could not be verified.");

      // Get existing sections from database
      const existingSections: SectionWithDetails[] =
        result.data?.sections?.map((section) => ({
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
      return existingSections;
    } catch (caught) {
      reportError("admin.sections.load", caught);
      setError(toAdminUserFacingError(caught, "sections").message);
      return null;
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
      const result = await executeDataConnectQuery(ref);
      setAllUserGroups(result.data?.userGroups || []);
    } catch (caught) {
      reportError("admin.sections.available-groups", caught);
    }
  }, []);

  const groupRequestGuard = useLatestRequestGuard();
  const fetchSectionUserGroups = useCallback(
    async (sectionId: string) => {
      const token = groupRequestGuard.start();
      setSectionUserGroups([]);
      setLoadingUserGroups(true);
      try {
        const ref = getSectionByIdRef(dataConnect, { id: sectionId });
        const result = await executeDataConnectQuery(ref);
        if (!groupRequestGuard.isCurrent(token)) return;
        const section = result.data?.section;

        if (section?.purposeLinks?.length) {
          const rows: SectionUserGroupRow[] = [];
          section.purposeLinks.forEach((link) => {
            if (link.userGroup) {
              const purposes = link.purposes ?? [];
              purposes.forEach((purpose) => {
                rows.push({
                  id: link.userGroup.id,
                  name: link.userGroup.name,
                  description: link.userGroup.description,
                  purpose,
                });
              });
            }
          });
          setSectionUserGroups(rows);
        } else {
          setSectionUserGroups([]);
        }
      } catch (caught) {
        if (!groupRequestGuard.isCurrent(token)) return;
        reportError("admin.sections.assigned-groups", caught, { sectionId });
        setError(toAdminUserFacingError(caught, "sections").message);
        setSectionUserGroups([]);
      } finally {
        if (groupRequestGuard.isCurrent(token)) setLoadingUserGroups(false);
      }
    },
    [groupRequestGuard],
  );

  useEffect(() => {
    fetchAllUserGroups();
  }, [fetchAllUserGroups]);

  const handleCreate = () => {
    navigate("/admin/sections?create=section");
    setEditingSection(null);
    setSectionUserGroups([]);
    setDialogOpen(true);
  };

  const handleEdit = useCallback(
    async (section: SectionWithDetails) => {
      if (
        !idsEqual(
          new URLSearchParams(location.search).get("section"),
          section.id,
        )
      )
        navigate(sectionConfigurationPath(section.id));
      setEditingSection(section);
      if (!configurationDraft.initialized)
        setConfigurationDraft({
          initialized: true,
          dirty: false,
          name: section.name,
          type: section.type,
          description: section.description ?? "",
        });
      setDialogOpen(true);
      // Fetch user groups when editing
      await fetchSectionUserGroups(section.id);
    },
    [
      fetchSectionUserGroups,
      location.search,
      navigate,
      configurationDraft.initialized,
      setConfigurationDraft,
    ],
  );

  useEffect(() => {
    const editSectionId = initialEditSectionIdRef.current;
    if (!editSectionId || loading || managedSectionId) {
      return;
    }

    const section = sections.find((item) => idsEqual(item.id, editSectionId));
    if (!section) {
      groupRequestGuard.invalidate();
      setDialogOpen(false);
      setEditingSection(null);
      setSectionUserGroups([]);
      setAddUserGroupDialogOpen(false);
      setError("Section unavailable. It may have been deleted.");
      return;
    }

    initialEditSectionIdRef.current = null;
    void handleEdit(section);
  }, [handleEdit, loading, managedSectionId, sections, groupRequestGuard]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("section") || initialState?.editSectionId) return;
    groupRequestGuard.invalidate();
    setEditingSection(null);
    setSectionUserGroups([]);
    setAddUserGroupDialogOpen(false);
    setDialogOpen(params.get("create") === "section");
  }, [location.search, initialState?.editSectionId, groupRequestGuard]);

  const handleDelete = async (section: SectionWithDetails) => {
    if (
      !confirm(
        `Are you sure you want to delete the section "${section.name}"? This will remove all user group associations.`,
      )
    ) {
      return;
    }

    try {
      const ref = deleteSectionRef(dataConnect, { id: section.id });
      await executeDataConnectMutation(ref);
      await Promise.all([
        fetchSections(),
        invalidateSectionsForUser(queryClient),
      ]);
      showSuccess(`Section "${section.name}" deleted`);
    } catch (caught) {
      reportError("admin.sections.delete", caught, { sectionId: section.id });
      setError(toAdminUserFacingError(caught, "sections").message);
    }
  };

  const handleSubmit = async () => {
    const parameters = new URLSearchParams(location.search);
    const ownedEditor =
      configurationId === "new"
        ? parameters.get("create") === "section" && editingSection === null
        : idsEqual(editingSection?.id, configurationId) &&
          sections.some((section) => idsEqual(section.id, configurationId));
    if (!ownedEditor) {
      setError(
        "The section selection changed. Reopen the intended section before saving.",
      );
      return;
    }
    if (!sectionName.trim()) {
      setError("Section name is required");
      return;
    }

    const token = editorSaveGuard.start();
    setSubmitting(true);
    setError(null);
    try {
      await configurationWrite.runOnce(async () => {
        if (editingSection) {
          // Update existing section
          const ref = updateSectionRef(dataConnect, {
            id: editingSection.id,
            name: sectionName.trim(),
            description: sectionDescription.trim() || null,
          });
          await executeDataConnectMutation(ref);
        } else {
          // Create new section
          const ref = createSectionRef(dataConnect, {
            name: sectionName.trim(),
            type: sectionType,
            description: sectionDescription.trim() || null,
          });
          await executeDataConnectMutation(ref);
        }
      });
      if (!editorSaveGuard.isCurrent(token)) return;
      const [latestSections] = await Promise.all([
        fetchSections(),
        invalidateSectionsForUser(queryClient),
      ]);
      if (!editorSaveGuard.isCurrent(token) || latestSections === null) return;
      configurationWrite.acknowledge();
      discardConfigurationDraft();
      setDialogOpen(false);
      navigate("/admin/sections");
      showSuccess(`Section ${editingSection ? "updated" : "created"}`);
    } catch (caught) {
      if (!editorSaveGuard.isCurrent(token)) return;
      reportError("admin.sections.save", caught, {
        editing: Boolean(editingSection),
      });
      setError(toAdminUserFacingError(caught, "sections").message);
    } finally {
      if (editorSaveGuard.isCurrent(token)) setSubmitting(false);
    }
  };

  const reconcileConfigurationWrite = async () => {
    if (configurationWrite.pending || !configurationWrite.receipt) return;
    const token = editorSaveGuard.start();
    const session = captureSession();
    const current = () => editorSaveGuard.isCurrent(token) && isSessionCurrent(session) && !isPrivateSessionSuspended(session);
    setConfigurationReview(null);
    try {
      const [latestSections] = await Promise.all([
        fetchSections(),
        invalidateSectionsForUser(queryClient),
      ]);
      if (!current() || latestSections === null) return;
      if (configurationWrite.status === "success") {
        if (!configurationWrite.acknowledgeIfCurrent(configurationWrite.receipt)) return;
        discardConfigurationDraft();
        setDialogOpen(false);
        navigate("/admin/sections");
      } else setConfigurationReview({ receipt: configurationWrite.receipt, locationKey: location.key,
        isCurrent: current, titles: latestSections.map(section => section.name) });
    } catch (caught) {
      if (current()) {
        setConfigurationReview(null);
        setError(toAdminUserFacingError(caught, "sections").message);
      }
    }
  };
  const acknowledgeReviewedConfiguration = (found: boolean) => {
    if (!activeConfigurationReview?.isCurrent() ||
      !configurationWrite.acknowledgeIfCurrent(activeConfigurationReview.receipt)) return;
    setConfigurationReview(null);
    setError(null);
    if (!found) return;
    discardConfigurationDraft();
    setDialogOpen(false);
    navigate("/admin/sections");
  };
  const configurationWriteNotice =
    configurationWrite.status === "idle" ? null : (
      <Alert
        severity={
          configurationWrite.status === "error"
            ? "warning"
            : configurationWrite.pending
              ? "info"
              : "success"
        }
        action={
          !configurationWrite.pending && (
            <Button onClick={() => void reconcileConfigurationWrite()}>
              {configurationWrite.status === "success"
                ? "Load saved change"
                : "Check latest list"}
            </Button>
          )
        }
      >
        {configurationWrite.pending
          ? "This save is still being confirmed. Another request will not be sent if you leave and return."
          : configurationWrite.status === "success"
            ? "The previous save completed. Load the saved change before continuing."
            : "The previous save could not be confirmed and may already exist. Check the latest sections before starting another request."}
      </Alert>
    );

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
        purposes: Array.from(
          new Set(
            sectionUserGroups
              .filter((row) => row.id === selectedUserGroup.id)
              .map((row) => row.purpose)
              .concat(selectedPurpose),
          ),
        ),
      });
      await executeDataConnectMutation(ref);

      await fetchSectionUserGroups(editingSection.id);
      await invalidateSectionsForUser(queryClient);

      setSelectedUserGroup(null);
      setSelectedPurpose(SectionUserGroupPurpose.ACCESS);
      setAddUserGroupDialogOpen(false);
      showSuccess("User group added to section");
    } catch (caught) {
      reportError("admin.sections.add-group", caught, {
        sectionId: editingSection.id,
      });
      setError(toAdminUserFacingError(caught, "sections").message);
    } finally {
      setAddingUserGroup(false);
    }
  };

  const handleRemoveUserGroup = async (
    userGroupId: string,
    purpose: SectionUserGroupPurpose,
  ) => {
    if (!editingSection) {
      return;
    }

    if (
      !confirm(
        "Are you sure you want to remove this user group from the section?",
      )
    ) {
      return;
    }

    const removingKey = `${userGroupId}-${purpose}`;
    setRemovingUserGroupId(removingKey);
    setError(null);
    try {
      const refetch = getSectionByIdRef(dataConnect, { id: editingSection.id });
      const currentSection = await executeDataConnectQuery(refetch);
      const currentLink = currentSection.data?.section?.purposeLinks?.find(
        (link) => link.userGroup?.id === userGroupId,
      );
      const currentPurposes = (currentLink?.purposes ?? []).filter(
        (item) => item !== purpose,
      );

      if (currentPurposes.length === 0) {
        const deleteRef = revokeUserGroupFromSectionForPurposeRef(dataConnect, {
          sectionId: editingSection.id,
          userGroupId,
        });
        await executeDataConnectMutation(deleteRef);
      } else {
        const updateRef = grantUserGroupToSectionForPurposeRef(dataConnect, {
          sectionId: editingSection.id,
          userGroupId,
          purposes: currentPurposes,
        });
        await executeDataConnectMutation(updateRef);
      }

      // Refresh section user groups
      await fetchSectionUserGroups(editingSection.id);
      await invalidateSectionsForUser(queryClient);
      showSuccess("User group removed from section");
    } catch (caught) {
      reportError("admin.sections.remove-group", caught, {
        sectionId: editingSection.id,
        userGroupId,
      });
      setError(toAdminUserFacingError(caught, "sections").message);
    } finally {
      setRemovingUserGroupId(null);
    }
  };

  // Get available user groups for the selected purpose (allow same group for both ACCESS and MEMBER)
  const availableUserGroups = allUserGroups.filter(
    (group) =>
      !sectionUserGroups.some(
        (existing) =>
          existing.id === group.id && existing.purpose === selectedPurpose,
      ),
  );

  const handleDialogClose = () => {
    groupRequestGuard.invalidate();
    if (configurationWrite.status === "idle") discardConfigurationDraft();
    navigate("/admin/sections");
    setDialogOpen(false);
    setAddUserGroupDialogOpen(false);
    setSectionUserGroups([]);
  };

  const handleManageEvents = (section: SectionWithDetails) => {
    navigate(sectionManagementPath(section.id, "events"));
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
      <Navigate
        replace
        to={
          initialEventIdRef.current
            ? eventManagementPath(managedSectionId, initialEventIdRef.current)
            : sectionManagementPath(managedSectionId, "events")
        }
      />
    );
  }

  // Check admin status - show access denied if not admin
  if (!isAdmin) {
    return (
      <Box
        className="page-container"
        sx={{ backgroundColor: "background.default" }}
      >
        <PageHeader title="Manage Sections" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Access denied. Admin privileges required to manage sections.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      className="page-container"
      sx={{ backgroundColor: "background.default" }}
    >
      <ManageSectionsListSurface
        eventsHref={(id) => sectionManagementPath(id, "events")}
        configurationHref={sectionConfigurationPath}
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
        open={
          dialogOpen &&
          (configurationId === "new"
            ? editingSection === null &&
              new URLSearchParams(location.search).get("create") === "section"
            : idsEqual(editingSection?.id, configurationId) &&
              sections.some((section) => idsEqual(section.id, configurationId)))
        }
        editingSection={
          idsEqual(editingSection?.id, configurationId) ? editingSection : null
        }
        sectionName={sectionName}
        sectionType={sectionType}
        sectionDescription={sectionDescription}
        submitting={submitting || configurationWrite.pending}
        saveDisabled={configurationWrite.status !== "idle"}
        notice={configurationWriteNotice}
        error={error}
        loadingUserGroups={loadingUserGroups}
        sectionUserGroups={
          idsEqual(editingSection?.id, configurationId) ? sectionUserGroups : []
        }
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

      <ConfirmationDialog
        open={!!activeConfigurationReview}
        title="Start a new section save request?"
        confirmLabel="I checked — start a new request"
        onCancel={() => setConfigurationReview(null)}
        onConfirm={() => acknowledgeReviewedConfiguration(false)}
      >
        If you found the intended section change in this latest list, close this
        draft without submitting it again. Start a new request only if the
        change is absent.
        <Box component="ul">
          {(activeConfigurationReview?.titles ?? []).map((name, index) => (
            <li key={`${index}:${name}`}>{name}</li>
          ))}
        </Box>
        <Button onClick={() => acknowledgeReviewedConfiguration(true)} sx={{ mt: 2 }}>
          I found the saved change — close this draft
        </Button>
      </ConfirmationDialog>
      <SnackbarAlert snackbar={snackbar} onClose={closeSnackbar} />
    </Box>
  );
}
