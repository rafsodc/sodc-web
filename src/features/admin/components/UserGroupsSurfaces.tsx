import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
} from "@mui/icons-material";
import { type MembershipStatus } from "@dataconnect/generated";
import { MEMBERSHIP_STATUS_OPTIONS, MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from "../../../constants";
import PageHeader from "../../../shared/components/PageHeader";
import type {
  MergedUser,
  SectionWithPurpose,
  UserGroupWithDetails,
  UserSearchResult,
  UserSummary,
} from "./userGroupsTypes";

interface UserGroupsListSurfaceProps {
  onBack: () => void;
  error: string | null;
  onDismissError: () => void;
  loading: boolean;
  userGroups: UserGroupWithDetails[];
  expandedGroupId: string | null;
  isLoadingDetails: boolean | undefined;
  detailsLoaded: boolean;
  mergedUsersForGroup: MergedUser[];
  sectionsForGroup: SectionWithPurpose[];
  onCreate: () => void;
  onExpand: (group: UserGroupWithDetails) => void;
  onEdit: (group: UserGroupWithDetails) => void;
  onDelete: (group: UserGroupWithDetails) => void;
  onAddUser: (groupId: string) => void;
  onRemoveUser: (userId: string, groupId: string) => void;
}

export function UserGroupsListSurface({
  onBack,
  error,
  onDismissError,
  loading,
  userGroups,
  expandedGroupId,
  isLoadingDetails,
  detailsLoaded,
  mergedUsersForGroup,
  sectionsForGroup,
  onCreate,
  onExpand,
  onEdit,
  onDelete,
  onAddUser,
  onRemoveUser,
}: UserGroupsListSurfaceProps) {
  return (
    <>
      <PageHeader title="User Groups" onBack={onBack} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Manage user groups that control section visibility. Groups can include individual users and/or membership
          statuses (automatically includes all users with those statuses).
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} sx={{ ml: 2 }}>
          Create User Group
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
      ) : userGroups.length === 0 ? (
        <Alert severity="info">No user groups found.</Alert>
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
              {userGroups.map((group) => {
                const isExpanded = expandedGroupId === group.id;
                return (
                  <React.Fragment key={group.id}>
                    <UserGroupRow
                      group={group}
                      isExpanded={isExpanded}
                      isLoadingDetails={Boolean(isLoadingDetails)}
                      detailsLoaded={detailsLoaded}
                      mergedUsersForGroup={mergedUsersForGroup}
                      sectionsForGroup={sectionsForGroup}
                      onExpand={onExpand}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                    {isExpanded && (
                      <UserGroupDetailsRow
                        group={group}
                        isLoadingDetails={Boolean(isLoadingDetails)}
                        detailsLoaded={detailsLoaded}
                        mergedUsersForGroup={mergedUsersForGroup}
                        sectionsForGroup={sectionsForGroup}
                        onAddUser={onAddUser}
                        onRemoveUser={onRemoveUser}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

interface UserGroupRowProps {
  group: UserGroupWithDetails;
  isExpanded: boolean;
  isLoadingDetails: boolean;
  detailsLoaded: boolean;
  mergedUsersForGroup: MergedUser[];
  sectionsForGroup: SectionWithPurpose[];
  onExpand: (group: UserGroupWithDetails) => void;
  onEdit: (group: UserGroupWithDetails) => void;
  onDelete: (group: UserGroupWithDetails) => void;
}

function UserGroupRow({
  group,
  isExpanded,
  isLoadingDetails,
  detailsLoaded,
  mergedUsersForGroup,
  sectionsForGroup,
  onExpand,
  onEdit,
  onDelete,
}: UserGroupRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2">{group.name}</Typography>
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
              const statusOption = MEMBERSHIP_STATUS_OPTIONS.find((option) => option.value === status);
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
        {isExpanded && detailsLoaded ? (
          <Typography variant="body2">{mergedUsersForGroup.length}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Click to view
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {isExpanded && detailsLoaded ? (
          <Typography variant="body2">{sectionsForGroup.length}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Click to view
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <IconButton size="small" onClick={() => onExpand(group)} disabled={isLoadingDetails}>
          <ExpandMoreIcon
            sx={{
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </IconButton>
        <IconButton size="small" onClick={() => onEdit(group)} color="primary">
          <EditIcon />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(group)} color="error">
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

interface UserGroupDetailsRowProps {
  group: UserGroupWithDetails;
  isLoadingDetails: boolean;
  detailsLoaded: boolean;
  mergedUsersForGroup: MergedUser[];
  sectionsForGroup: SectionWithPurpose[];
  onAddUser: (groupId: string) => void;
  onRemoveUser: (userId: string, groupId: string) => void;
}

function UserGroupDetailsRow({
  group,
  isLoadingDetails,
  detailsLoaded,
  mergedUsersForGroup,
  sectionsForGroup,
  onAddUser,
  onRemoveUser,
}: UserGroupDetailsRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={6} sx={{ py: 0 }}>
        {isLoadingDetails ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : detailsLoaded ? (
          <Box sx={{ p: 2 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", mr: 2 }}>
                  <Typography variant="subtitle2">Users ({mergedUsersForGroup.length})</Typography>
                  <Button
                    size="small"
                    startIcon={<PersonAddIcon />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddUser(group.id);
                    }}
                    variant="outlined"
                  >
                    Add User
                  </Button>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <UserGroupUsersTable
                  groupId={group.id}
                  users={mergedUsersForGroup}
                  onAddUser={onAddUser}
                  onRemoveUser={onRemoveUser}
                />
              </AccordionDetails>
            </Accordion>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Sections ({sectionsForGroup.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <UserGroupSectionsTable sections={sectionsForGroup} />
              </AccordionDetails>
            </Accordion>
          </Box>
        ) : (
          <Alert severity="error">Failed to load group details</Alert>
        )}
      </TableCell>
    </TableRow>
  );
}

interface UserGroupUsersTableProps {
  groupId: string;
  users: MergedUser[];
  onAddUser: (groupId: string) => void;
  onRemoveUser: (userId: string, groupId: string) => void;
}

function UserGroupUsersTable({ groupId, users, onAddUser, onRemoveUser }: UserGroupUsersTableProps) {
  if (users.length === 0) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No users assigned to this group.
        </Typography>
        <Button size="small" startIcon={<PersonAddIcon />} onClick={() => onAddUser(groupId)} variant="outlined">
          Add User
        </Button>
      </Box>
    );
  }

  return (
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
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              {user.firstName} {user.lastName}
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <Chip label={user.membershipStatus} size="small" variant="outlined" />
            </TableCell>
            <TableCell align="right">
              {!user.isExplicit ? (
                <Tooltip title="User is automatically included via membership status">
                  <Chip label="Auto" size="small" color="primary" variant="outlined" />
                </Tooltip>
              ) : (
                <IconButton size="small" onClick={() => onRemoveUser(user.id, groupId)} color="error">
                  <PersonRemoveIcon />
                </IconButton>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface UserGroupSectionsTableProps {
  sections: SectionWithPurpose[];
}

function UserGroupSectionsTable({ sections }: UserGroupSectionsTableProps) {
  if (sections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No sections assigned to this group.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Purpose</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Description</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sections.map((item, index) => (
          <TableRow key={`${item.section.id}-${item.purpose}-${index}`}>
            <TableCell>{item.section.name}</TableCell>
            <TableCell>
              <Chip
                label={item.purpose}
                size="small"
                variant="outlined"
                color={
                  item.purpose === "ACCESS"
                    ? "primary"
                    : item.purpose === "MEMBER"
                      ? "secondary"
                      : "default"
                }
              />
            </TableCell>
            <TableCell>
              <Chip label={item.section.type} size="small" variant="outlined" />
            </TableCell>
            <TableCell>{item.section.description || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface UserGroupDialogSurfaceProps {
  open: boolean;
  editingGroup: UserGroupWithDetails | null;
  groupName: string;
  groupDescription: string;
  selectedStatuses: MembershipStatus[];
  submitting: boolean;
  loadingAllUsers: boolean;
  allUsers: UserSummary[];
  onClose: () => void;
  onSubmit: () => void;
  onGroupNameChange: (value: string) => void;
  onGroupDescriptionChange: (value: string) => void;
  onSelectedStatusesChange: (value: MembershipStatus[]) => void;
}

export function UserGroupDialogSurface({
  open,
  editingGroup,
  groupName,
  groupDescription,
  selectedStatuses,
  submitting,
  loadingAllUsers,
  allUsers,
  onClose,
  onSubmit,
  onGroupNameChange,
  onGroupDescriptionChange,
  onSelectedStatusesChange,
}: UserGroupDialogSurfaceProps) {
  const selectedStatusUsers = allUsers.filter((user) => selectedStatuses.includes(user.membershipStatus));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingGroup ? "Edit User Group" : "Create User Group"}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Group Name"
          fullWidth
          variant="outlined"
          value={groupName}
          onChange={(event) => onGroupNameChange(event.target.value)}
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
          onChange={(event) => onGroupDescriptionChange(event.target.value)}
          inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
          helperText={`${groupDescription.length}/${MAX_DESCRIPTION_LENGTH} characters`}
          sx={{ mb: 2 }}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>Membership Statuses (Optional)</InputLabel>
          <Select
            multiple
            value={selectedStatuses}
            onChange={(event) => onSelectedStatusesChange(event.target.value as MembershipStatus[])}
            input={<OutlinedInput label="Membership Statuses (Optional)" />}
            renderValue={(selected) => {
              if (selected.length === 0) return "None";
              return selected
                .map((status) => {
                  const option = MEMBERSHIP_STATUS_OPTIONS.find((item) => item.value === status);
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
          Select membership statuses to automatically include all users with those statuses in this group. You can also
          manually add individual users to groups.
        </Typography>
        {selectedStatuses.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {loadingAllUsers ? (
              <Typography variant="caption" color="text.secondary">
                Loading users...
              </Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Users with selected statuses: {selectedStatusUsers.length}
                </Typography>
                <Box sx={{ maxHeight: 120, overflow: "auto" }}>
                  {selectedStatusUsers.slice(0, 20).map((user) => (
                    <Typography key={user.id} variant="caption" component="div" color="text.secondary">
                      {user.firstName} {user.lastName} ({user.email})
                    </Typography>
                  ))}
                  {selectedStatusUsers.length > 20 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {selectedStatusUsers.length - 20} more
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={submitting || !groupName.trim()}>
          {submitting ? <CircularProgress size={20} /> : editingGroup ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface AddUserToGroupDialogSurfaceProps {
  open: boolean;
  searchResults: UserSearchResult[];
  searchingUsers: boolean;
  userSearchTerm: string;
  addingUserId: string | null;
  mergedUserIdsForAddDialog: Set<string>;
  onClose: () => void;
  onSearchTermChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
}

export function AddUserToGroupDialogSurface({
  open,
  searchResults,
  searchingUsers,
  userSearchTerm,
  addingUserId,
  mergedUserIdsForAddDialog,
  onClose,
  onSearchTermChange,
  onSelectUser,
}: AddUserToGroupDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add User to User Group</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={searchResults}
          getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
          loading={searchingUsers}
          inputValue={userSearchTerm}
          onInputChange={(_, value) => onSearchTermChange(value)}
          onChange={(_, selectedUser) => {
            if (selectedUser) {
              onSelectUser(selectedUser.id);
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
            const isAlreadyInGroup = mergedUserIdsForAddDialog.has(option.id);
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
                  {isAlreadyInGroup && <Chip label="Already in group" size="small" color="info" />}
                  <Chip label={option.membershipStatus} size="small" variant="outlined" />
                </Box>
              </Box>
            );
          }}
          filterOptions={(options) => options}
          sx={{ mt: 1 }}
          disabled={addingUserId !== null}
          getOptionDisabled={(option) => mergedUserIdsForAddDialog.has(option.id)}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
          Search for users by name or email. Note: Restricted users (PENDING, RESIGNED, LOST, DECEASED) cannot log in
          but can be added to user groups to preserve memberships.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={addingUserId !== null}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface UserDetailDialogSurfaceProps {
  user: UserSummary | null;
  onClose: () => void;
}

export function UserDetailDialogSurface({ user, onClose }: UserDetailDialogSurfaceProps) {
  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>User</DialogTitle>
      <DialogContent>
        {user && (
          <Box sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              <strong>
                {user.firstName} {user.lastName}
              </strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
            <Chip label={user.membershipStatus} size="small" variant="outlined" sx={{ mt: 1 }} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
