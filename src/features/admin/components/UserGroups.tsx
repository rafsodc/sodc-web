import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Alert,
} from "@mui/material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  listUserGroupsRef,
  listUsersRef,
  getUserGroupByIdRef,
  createUserGroupRef,
  updateUserGroupRef,
  deleteUserGroupRef,
  addUserToUserGroupRef,
  removeUserFromUserGroupRef,
  getUserWithAccessGroupsRef,
} from "@dataconnect/generated";
import { MembershipStatus } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import { searchUsers } from "../../users/utils/searchUsers";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import { useLocation } from "react-router-dom";
import "../../../shared/components/PageContainer.css";
import {
  AddUserToGroupDialogSurface,
  UserDetailDialogSurface,
  UserGroupDialogSurface,
  UserGroupsListSurface,
} from "./UserGroupsSurfaces";
import type {
  MergedUser,
  SectionWithPurpose,
  UserGroupDetails,
  UserGroupWithDetails,
  UserSearchResult,
  UserSummary,
} from "./userGroupsTypes";

interface UserGroupsProps {
  onBack: () => void;
}

interface UserGroupsLocationState {
  expandedGroupId?: string | null;
}

export default function UserGroups({ onBack }: UserGroupsProps) {
  const location = useLocation();
  const isAdmin = useAdminClaim(auth.currentUser);
  const [userGroups, setUserGroups] = useState<UserGroupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupDetails, setGroupDetails] = useState<Record<string, UserGroupDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  
  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroupWithDetails | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<MembershipStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Add user dialog state
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // All users: for merged group membership (explicit + by membership status)
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);

  const [selectedUserDetail, setSelectedUserDetail] = useState<UserSummary | null>(null);

  const fetchUserGroupsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = listUserGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      
      const existingGroups: UserGroupWithDetails[] = result.data?.userGroups?.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        membershipStatuses: group.membershipStatuses || null,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      })) || [];
      
      // Sort alphabetically
      existingGroups.sort((a, b) => a.name.localeCompare(b.name));
      
      setUserGroups(existingGroups);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch user groups");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupDetails = useCallback(async (groupId: string) => {
    if (groupDetails[groupId]) {
      return;
    }

    setLoadingDetails((prev) => ({ ...prev, [groupId]: true }));
    try {
      const ref = getUserGroupByIdRef(dataConnect, { id: groupId });
      const result = await executeQuery(ref);
      
      if (result.data?.userGroup) {
        setGroupDetails((prev) => ({
          ...prev,
          [groupId]: result.data.userGroup!,
        }));
      }
    } catch (err: any) {
      console.error(`Failed to fetch details for group ${groupId}:`, err);
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [groupId]: false }));
    }
  }, [groupDetails]);

  useEffect(() => {
    fetchUserGroupsList();
  }, [fetchUserGroupsList]);

  useEffect(() => {
    const expandedGroupId = (location.state as UserGroupsLocationState | null)?.expandedGroupId;
    if (!expandedGroupId) {
      setExpandedGroupId(null);
      return;
    }
    setExpandedGroupId(expandedGroupId);
    fetchGroupDetails(expandedGroupId);
  }, [fetchGroupDetails, location.state]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoadingAllUsers(true);
    (async () => {
      try {
        const ref = listUsersRef(dataConnect);
        const result = await executeQuery(ref);
        if (!cancelled && result.data?.users) {
          setAllUsers(
            result.data.users.map((u) => ({
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email,
              membershipStatus: u.membershipStatus as MembershipStatus,
            }))
          );
        }
      } catch {
        if (!cancelled) setAllUsers([]);
      } finally {
        if (!cancelled) setLoadingAllUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleExpand = (group: UserGroupWithDetails) => {
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
    if (!groupDetails[groupId]) {
      fetchGroupDetails(groupId);
    }
  };

  const handleCloseAddUserDialog = () => {
    setAddUserDialogOpen(false);
    setAddingToGroupId(null);
    setUserSearchTerm("");
    setSearchResults([]);
  };

  const handleAddUserSearchTermChange = (value: string) => {
    setUserSearchTerm(value);
    handleSearchUsers(value);
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
            } catch (_err) {
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

    // Check if user is already in the group (explicit or by membership status)
    const alreadyInGroup =
      groupDetails[addingToGroupId] &&
      (() => {
        const d = groupDetails[addingToGroupId]!;
        const explicitIds = new Set((d.users ?? []).map((u) => u.user.id));
        if (explicitIds.has(userId)) return true;
        const statuses = d.membershipStatuses ?? [];
        const u = allUsers.find((x) => x.id === userId);
        return u ? statuses.includes(u.membershipStatus) : false;
      })();
    if (alreadyInGroup) {
      setError("User is already in this user group (by membership status or explicitly added)");
      return;
    }

    setAddingUserId(userId);
    setError(null);
    try {
      const ref = addUserToUserGroupRef(dataConnect, {
        userId,
        userGroupId: addingToGroupId,
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
    if (!confirm("Are you sure you want to remove this user from the user group?")) {
      return;
    }

    try {
      const ref = removeUserFromUserGroupRef(dataConnect, {
        userId,
        userGroupId: groupId,
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

  const handleEdit = (group: UserGroupWithDetails) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setSelectedStatuses(group.membershipStatuses || []);
    setDialogOpen(true);
  };

  const handleDelete = async (group: UserGroupWithDetails) => {
    if (!confirm(`Are you sure you want to delete the user group "${group.name}"? This will remove all user and section associations.`)) {
      return;
    }

    try {
      const ref = deleteUserGroupRef(dataConnect, { id: group.id });
      await executeMutation(ref);
      await fetchUserGroupsList();
      if (expandedGroupId === group.id) {
        setExpandedGroupId(null);
      }
      delete groupDetails[group.id];
      setGroupDetails({ ...groupDetails });
    } catch (err: any) {
      setError(err?.message || "Failed to delete user group");
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
        const ref = updateUserGroupRef(dataConnect, {
          id: editingGroup.id,
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          membershipStatuses: selectedStatuses.length > 0 ? selectedStatuses : null,
        });
        await executeMutation(ref);
      } else {
        // Create new group
        const ref = createUserGroupRef(dataConnect, {
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          membershipStatuses: selectedStatuses.length > 0 ? selectedStatuses : null,
        });
        await executeMutation(ref);
      }
      setDialogOpen(false);
      await fetchUserGroupsList();
    } catch (err: any) {
      setError(err?.message || `Failed to ${editingGroup ? "update" : "create"} user group`);
    } finally {
      setSubmitting(false);
    }
  };

  const details = expandedGroupId ? groupDetails[expandedGroupId] : null;
  const isLoadingDetails = expandedGroupId ? loadingDetails[expandedGroupId] : false;

  const sectionsForGroup: SectionWithPurpose[] = details
    ? (details.purposeLinks ?? []).map((item) => ({
        section: item.section,
        purpose: item.purpose,
      }))
    : [];

  // Merged users: explicit (UserUserGroup) + users whose membershipStatus is in group's membershipStatuses
  const mergedUsersForGroup: MergedUser[] = details
    ? (() => {
        const explicitIds = new Set((details.users ?? []).map((u) => u.user.id));
        const statuses = details.membershipStatuses ?? [];
        const explicit: MergedUser[] = (details.users ?? []).map((uug) => ({
          id: uug.user.id,
          firstName: uug.user.firstName,
          lastName: uug.user.lastName,
          email: uug.user.email,
          membershipStatus: uug.user.membershipStatus as MembershipStatus,
          isExplicit: true,
        }));
        const byStatus: MergedUser[] = allUsers
          .filter((u) => statuses.includes(u.membershipStatus) && !explicitIds.has(u.id))
          .map((u) => ({ ...u, isExplicit: false }));
        return [...explicit, ...byStatus];
      })()
    : [];

  // For Add User dialog: "already in group" = explicit + status-based for the group we're adding to
  const mergedUserIdsForAddDialog =
    addingToGroupId && groupDetails[addingToGroupId]
      ? (() => {
          const d = groupDetails[addingToGroupId];
          const explicitIds = new Set((d.users ?? []).map((u) => u.user.id));
          const statuses = d.membershipStatuses ?? [];
          const byStatusIds = new Set(
            allUsers.filter((u) => statuses.includes(u.membershipStatus)).map((u) => u.id)
          );
          return new Set([...explicitIds, ...byStatusIds]);
        })()
      : new Set<string>();

  // Check admin status - show access denied if not admin
  if (!isAdmin) {
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="User Groups" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Access denied. Admin privileges required to manage user groups.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
      <UserGroupsListSurface
        onBack={onBack}
        error={error}
        onDismissError={() => setError(null)}
        loading={loading}
        userGroups={userGroups}
        expandedGroupId={expandedGroupId}
        isLoadingDetails={isLoadingDetails}
        detailsLoaded={Boolean(details)}
        mergedUsersForGroup={mergedUsersForGroup}
        sectionsForGroup={sectionsForGroup}
        onCreate={handleCreate}
        onExpand={handleExpand}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddUser={handleAddUser}
        onRemoveUser={handleRemoveUserFromGroup}
      />

      <UserGroupDialogSurface
        open={dialogOpen}
        editingGroup={editingGroup}
        groupName={groupName}
        groupDescription={groupDescription}
        selectedStatuses={selectedStatuses}
        submitting={submitting}
        loadingAllUsers={loadingAllUsers}
        allUsers={allUsers}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onGroupNameChange={setGroupName}
        onGroupDescriptionChange={setGroupDescription}
        onSelectedStatusesChange={setSelectedStatuses}
      />

      <AddUserToGroupDialogSurface
        open={addUserDialogOpen}
        searchResults={searchResults}
        searchingUsers={searchingUsers}
        userSearchTerm={userSearchTerm}
        addingUserId={addingUserId}
        mergedUserIdsForAddDialog={mergedUserIdsForAddDialog}
        onClose={handleCloseAddUserDialog}
        onSearchTermChange={handleAddUserSearchTermChange}
        onSelectUser={handleAddUserToGroup}
      />

      <UserDetailDialogSurface user={selectedUserDetail} onClose={() => setSelectedUserDetail(null)} />
    </Box>
  );
}
