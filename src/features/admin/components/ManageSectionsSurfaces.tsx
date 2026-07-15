import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { SectionUserGroupPurpose, type ListUserGroupsData, type SectionType } from "@dataconnect/generated";
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from "../../../constants";
import PageHeader from "../../../shared/components/PageHeader";
import type { SectionUserGroupRow, SectionWithDetails } from "./manageSectionsTypes";

type UserGroupOption = { id: string; name: string; description?: string | null };

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

interface ManageSectionsListSurfaceProps {
  onBack: () => void;
  error: string | null;
  onDismissError: () => void;
  loading: boolean;
  sections: SectionWithDetails[];
  onCreate: () => void;
  onManageEvents: (section: SectionWithDetails) => void;
  onEdit: (section: SectionWithDetails) => void;
  onDelete: (section: SectionWithDetails) => void;
}

export function ManageSectionsListSurface({
  onBack,
  error,
  onDismissError,
  loading,
  sections,
  onCreate,
  onManageEvents,
  onEdit,
  onDelete,
}: ManageSectionsListSurfaceProps) {
  return (
    <>
      <PageHeader title="Manage Sections" onBack={onBack} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Manage sections that organize content and control access. Sections can be MEMBERS (user lists) or EVENTS
          (event listings).
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} sx={{ ml: 2 }}>
          Create Section
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onDismissError}>
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
                    <Typography variant="body2">{section.name}</Typography>
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
                      <Button size="small" variant="outlined" onClick={() => onManageEvents(section)} sx={{ mr: 1 }}>
                        Manage events
                      </Button>
                    )}
                    <IconButton size="small" onClick={() => onEdit(section)} color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDelete(section)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

interface SectionEditorDialogSurfaceProps {
  open: boolean;
  editingSection: SectionWithDetails | null;
  sectionName: string;
  sectionType: SectionType;
  sectionDescription: string;
  submitting: boolean;
  loadingUserGroups: boolean;
  sectionUserGroups: SectionUserGroupRow[];
  removingUserGroupId: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onSectionNameChange: (value: string) => void;
  onSectionTypeChange: (value: SectionType) => void;
  onSectionDescriptionChange: (value: string) => void;
  onOpenAddUserGroup: () => void;
  onRemoveUserGroup: (userGroupId: string, purpose: SectionUserGroupPurpose) => void;
}

export function SectionEditorDialogSurface({
  open,
  editingSection,
  sectionName,
  sectionType,
  sectionDescription,
  submitting,
  loadingUserGroups,
  sectionUserGroups,
  removingUserGroupId,
  onClose,
  onSubmit,
  onSectionNameChange,
  onSectionTypeChange,
  onSectionDescriptionChange,
  onOpenAddUserGroup,
  onRemoveUserGroup,
}: SectionEditorDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editingSection ? "Edit Section" : "Create Section"}</DialogTitle>
      <DialogContent sx={{ maxHeight: "70vh", overflowY: "auto" }}>
        <TextField
          autoFocus
          margin="dense"
          label="Section Name"
          fullWidth
          variant="outlined"
          value={sectionName}
          onChange={(event) => onSectionNameChange(event.target.value)}
          inputProps={{ maxLength: MAX_NAME_LENGTH }}
          helperText={`${sectionName.length}/${MAX_NAME_LENGTH} characters`}
          sx={{ mb: 2 }}
        />
        <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
          <InputLabel>Section Type</InputLabel>
          <Select
            value={sectionType}
            onChange={(event) => onSectionTypeChange(event.target.value as SectionType)}
            label="Section Type"
            disabled={!!editingSection}
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
          onChange={(event) => onSectionDescriptionChange(event.target.value)}
          inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
          helperText={`${sectionDescription.length}/${MAX_DESCRIPTION_LENGTH} characters`}
          sx={{ mb: 2 }}
        />

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
                            onClick={() => onRemoveUserGroup(group.id, group.purpose)}
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
              onClick={onOpenAddUserGroup}
              disabled={loadingUserGroups}
              sx={{ mb: 2 }}
            >
              Add User Group
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={submitting || !sectionName.trim()}>
          {submitting ? <CircularProgress size={20} /> : editingSection ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface AddSectionUserGroupDialogSurfaceProps {
  open: boolean;
  selectedPurpose: SectionUserGroupPurpose;
  selectedUserGroup: UserGroupOption | null;
  availableUserGroups: ListUserGroupsData["userGroups"];
  addingUserGroup: boolean;
  onClose: () => void;
  onAdd: () => void;
  onPurposeChange: (value: SectionUserGroupPurpose) => void;
  onUserGroupChange: (value: UserGroupOption | null) => void;
}

export function AddSectionUserGroupDialogSurface({
  open,
  selectedPurpose,
  selectedUserGroup,
  availableUserGroups,
  addingUserGroup,
  onClose,
  onAdd,
  onPurposeChange,
  onUserGroupChange,
}: AddSectionUserGroupDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add User Group to Section</DialogTitle>
      <DialogContent>
        <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
          <FormLabel component="legend">Purpose</FormLabel>
          <RadioGroup
            value={selectedPurpose}
            onChange={(event) => onPurposeChange(event.target.value as SectionUserGroupPurpose)}
          >
            {SECTION_PURPOSE_ORDER.map((purpose) => (
              <FormControlLabel
                key={purpose}
                value={purpose}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" component="span" fontWeight={600}>
                      {SECTION_PURPOSE_HELP[purpose].title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {SECTION_PURPOSE_HELP[purpose].body}
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
            onChange={(_, newValue) => onUserGroupChange(newValue ? { id: newValue.id, name: newValue.name } : null)}
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
            disabled={addingUserGroup}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={addingUserGroup}>
          Cancel
        </Button>
        <Button onClick={onAdd} variant="contained" disabled={addingUserGroup || !selectedUserGroup}>
          {addingUserGroup ? <CircularProgress size={20} /> : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
