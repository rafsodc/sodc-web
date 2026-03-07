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
 * Get all users from a section's member groups (or section access groups as fallback)
 * Deduplicates users who appear in multiple user groups.
 */
type SectionDataWithMembers = {
  memberGroups?: Array<{
    userGroup: {
      id: string;
      name: string;
      membershipStatuses?: MembershipStatus[] | null;
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

type SectionUserGroupRelation = {
  userGroup: {
    id: string;
    name: string;
    membershipStatuses?: MembershipStatus[] | null;
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
  accessGroups?: Array<SectionUserGroupRelation> | null | undefined,
  additionalUsersByStatus?: Array<SectionMember> | null | undefined
): SectionMember[] {
  if (!sectionData) {
    return [];
  }

  // Prefer member groups, fallback to section access groups if no member groups
  const groups = sectionData.memberGroups && sectionData.memberGroups.length > 0
    ? sectionData.memberGroups
    : accessGroups || [];

  const userMap = new Map<string, SectionMember>();

  for (const groupRelation of groups) {
    const group = groupRelation.userGroup;
    for (const userRelation of group.users) {
      const user = userRelation.user;
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

  if (additionalUsersByStatus) {
    for (const user of additionalUsersByStatus) {
      const matchesGroup = groups.some((groupRelation) => {
        const group = groupRelation.userGroup;
        return group.membershipStatuses && group.membershipStatuses.includes(user.membershipStatus);
      });
      if (matchesGroup && !userMap.has(user.userId)) {
        userMap.set(user.userId, user);
      }
    }
  }

  return Array.from(userMap.values());
}

/**
 * Get member groups from section data (or section access groups as fallback)
 */
type SectionMemberGroupData = {
  memberGroups?: Array<{
    userGroup: {
      id: string;
      name: string;
      description?: string | null;
      subscribable?: boolean | null;
    };
  }>;
};

type SectionUserGroupForMembers = {
  userGroup: {
    id: string;
    name: string;
    description?: string | null;
    subscribable?: boolean | null;
  };
};

export function getMemberGroups(
  sectionData: SectionMemberGroupData | null | undefined,
  accessGroups?: Array<SectionUserGroupForMembers> | null | undefined
): Array<{
  id: string;
  name: string;
  description?: string | null;
  subscribable?: boolean | null;
}> {
  if (!sectionData) {
    return [];
  }

  const groups = sectionData.memberGroups && sectionData.memberGroups.length > 0
    ? sectionData.memberGroups
    : accessGroups || [];

  return groups.map((groupRelation) => groupRelation.userGroup);
}

/**
 * Check if a user can access a section (in a user group linked to the section)
 */
export function canUserAccessSection(
  userUserGroupIds: string[],
  sectionAccessGroupIds: string[]
): boolean {
  return sectionAccessGroupIds.some((id) => userUserGroupIds.includes(id));
}

/**
 * Check if a user can subscribe to a section's member groups
 * User must have section access, not already be a member, and group must be subscribable
 */
export function canUserSubscribe(
  _userId: string,
  userUserGroupIds: string[],
  sectionAccessGroupIds: string[],
  memberGroups: Array<{
    id: string;
    subscribable?: boolean | null;
  }>,
  userMemberGroupIds: string[]
): boolean {
  if (!canUserAccessSection(userUserGroupIds, sectionAccessGroupIds)) {
    return false;
  }
  return memberGroups.some(
    (group) =>
      group.subscribable === true &&
      !userMemberGroupIds.includes(group.id)
  );
}

/**
 * Check if a user is already in one of a section's member groups
 */
export function isUserMember(
  userUserGroupIds: string[],
  memberGroups: Array<{
    id: string;
  }>
): boolean {
  const memberGroupIds = memberGroups.map((group) => group.id);
  return memberGroupIds.some((id) => userUserGroupIds.includes(id));
}
