import type { SectionType, MembershipStatus } from "@dataconnect/generated";

/**
 * Flattened user data from section member list
 */
export interface SectionMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: MembershipStatus;
}

/**
 * Type guard to check if a section is a MEMBERS section
 */
export function isMembersSection(section: { type: SectionType }): boolean {
  return section.type === "MEMBERS";
}

/**
 * Get all users from a section's member access groups (or viewing access groups as fallback)
 * Deduplicates users who appear in multiple access groups
 */
type SectionDataWithMembers = {
  memberAccessGroups?: Array<{
    accessGroup: {
      id: string;
      name: string;
      users: Array<{
        user: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          membershipStatus: MembershipStatus;
        };
      }>;
    };
  }>;
};

type ViewingAccessGroup = {
  accessGroup: {
    id: string;
    name: string;
    users: Array<{
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        membershipStatus: MembershipStatus;
      };
    }>;
  };
};

export function getAllUsersFromSection(
  sectionData: SectionDataWithMembers | null | undefined,
  viewingAccessGroups?: Array<ViewingAccessGroup> | null | undefined
): SectionMember[] {
  if (!sectionData) {
    return [];
  }

  // Prefer MEMBER purpose groups, fallback to VIEW groups if no MEMBER groups
  const accessGroups = sectionData.memberAccessGroups && sectionData.memberAccessGroups.length > 0
    ? sectionData.memberAccessGroups
    : viewingAccessGroups || [];

  const userMap = new Map<string, SectionMember>();

  for (const groupRelation of accessGroups) {
    const group = groupRelation.accessGroup;
    for (const userRelation of group.users) {
      const user = userRelation.user;
      // Deduplicate by user ID
      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          membershipStatus: user.membershipStatus,
        });
      }
    }
  }

  return Array.from(userMap.values());
}

/**
 * Get member access groups from section data (or viewing groups as fallback)
 */
type MemberAccessGroupData = {
  memberAccessGroups?: Array<{
    accessGroup: {
      id: string;
      name: string;
      description?: string | null;
      subscribable?: boolean | null;
    };
  }>;
};

type ViewingAccessGroupForMembers = {
  accessGroup: {
    id: string;
    name: string;
    description?: string | null;
    subscribable?: boolean | null;
  };
};

export function getMemberAccessGroups(
  sectionData: MemberAccessGroupData | null | undefined,
  viewingAccessGroups?: Array<ViewingAccessGroupForMembers> | null | undefined
): Array<{
  id: string;
  name: string;
  description?: string | null;
  subscribable?: boolean | null;
}> {
  if (!sectionData) {
    return [];
  }

  // Prefer MEMBER purpose groups, fallback to VIEW groups if no MEMBER groups
  const accessGroups = sectionData.memberAccessGroups && sectionData.memberAccessGroups.length > 0
    ? sectionData.memberAccessGroups
    : viewingAccessGroups || [];

  return accessGroups.map((groupRelation) => groupRelation.accessGroup);
}

/**
 * Check if a user can access a section (has VIEW access)
 */
export function canUserAccessSection(
  userAccessGroupIds: string[],
  sectionViewingAccessGroupIds: string[]
): boolean {
  return sectionViewingAccessGroupIds.some((id) => userAccessGroupIds.includes(id));
}

/**
 * Check if a user can subscribe to a section's member access groups
 * User must have VIEW access, not already be a member, and group must be subscribable
 */
export function canUserSubscribe(
  userId: string,
  userAccessGroupIds: string[],
  sectionViewingAccessGroupIds: string[],
  memberAccessGroups: Array<{
    id: string;
    subscribable?: boolean | null;
  }>,
  userMemberAccessGroupIds: string[]
): boolean {
  // User must have VIEW access
  if (!canUserAccessSection(userAccessGroupIds, sectionViewingAccessGroupIds)) {
    return false;
  }

  // Check if any member access group is subscribable and user is not already a member
  return memberAccessGroups.some(
    (group) =>
      group.subscribable === true &&
      !userMemberAccessGroupIds.includes(group.id)
  );
}

/**
 * Check if a user is already a member of a section's member access groups
 */
export function isUserMember(
  userAccessGroupIds: string[],
  memberAccessGroups: Array<{
    id: string;
  }>
): boolean {
  const memberGroupIds = memberAccessGroups.map((group) => group.id);
  return memberGroupIds.some((id) => userAccessGroupIds.includes(id));
}
