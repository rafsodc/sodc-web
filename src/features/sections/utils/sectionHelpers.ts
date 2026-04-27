import type { SectionType, MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/generated";

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

/** Purposes that allow opening / seeing a section. MODERATOR implies this for authorization. */
export function purposeGrantsSectionAccess(purpose: SectionUserGroupPurpose | string): boolean {
  return purpose === "ACCESS" || purpose === "MODERATOR";
}

/**
 * Type guard to check if a section is a MEMBERS section
 */
export function isMembersSection(section: { type: SectionType }): boolean {
  return section.type === "MEMBERS";
}

type PurposeLinkWithUsers = {
  purpose?: string;
  purposes?: string[] | null;
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

function linkHasPurpose(link: { purpose?: string; purposes?: string[] | null }, target: string): boolean {
  return link.purpose === target || (link.purposes?.includes(target) ?? false);
}

type SectionDataWithPurposeLinks = {
  purposeLinks?: PurposeLinkWithUsers[];
};

/** MEMBER-purpose groups for rollup; if none, ACCESS-purpose groups (legacy fallback). */
function getRollupPurposeLinks(
  sectionData: SectionDataWithPurposeLinks | null | undefined
): PurposeLinkWithUsers[] {
  const links = sectionData?.purposeLinks ?? [];
  const memberLinks = links.filter((l) => linkHasPurpose(l, "MEMBER"));
  return memberLinks.length > 0 ? memberLinks : links.filter((l) => linkHasPurpose(l, "ACCESS"));
}

/**
 * Get all users from a section's member rollup groups.
 * Deduplicates users who appear in multiple user groups.
 */
export function getAllUsersFromSection(
  sectionData: SectionDataWithPurposeLinks | null | undefined,
  _unusedLegacy?: unknown,
  additionalUsersByStatus?: Array<SectionMember> | null | undefined
): SectionMember[] {
  if (!sectionData) {
    return [];
  }

  const groups = getRollupPurposeLinks(sectionData);

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

type SectionMemberGroupData = {
  purposeLinks?: Array<{
    purpose?: string;
    purposes?: string[] | null;
    userGroup: {
      id: string;
      name: string;
      description?: string | null;
      subscribable?: boolean | null;
    };
  }>;
};

/**
 * Member-list / subscription groups: MEMBER purpose, or ACCESS if no MEMBER rows (legacy fallback).
 */
export function getMemberGroups(
  sectionData: SectionMemberGroupData | null | undefined,
  _unusedLegacy?: unknown
): Array<{
  id: string;
  name: string;
  description?: string | null;
  subscribable?: boolean | null;
}> {
  if (!sectionData?.purposeLinks?.length) {
    return [];
  }
  const member = sectionData.purposeLinks.filter((l) => linkHasPurpose(l, "MEMBER"));
  const source = member.length > 0 ? member : sectionData.purposeLinks.filter((l) => linkHasPurpose(l, "ACCESS"));
  return source.map((groupRelation) => groupRelation.userGroup);
}

/**
 * Check if a user can access a section (via ACCESS or MODERATOR purpose on a group they belong to).
 */
export function canUserAccessSection(
  userUserGroupIds: string[],
  sectionPurposeLinks: Array<{ purpose?: string; purposes?: string[] | null; userGroup: { id: string } }>
): boolean {
  return sectionPurposeLinks.some(
    (link) => {
      const grantsAccess =
        linkHasPurpose(link, "ACCESS") || linkHasPurpose(link, "MODERATOR");
      return grantsAccess && userUserGroupIds.includes(link.userGroup.id);
    }
  );
}

/**
 * Check if a user can subscribe to a section's member groups
 * User must have section access, not already be a member, and group must be subscribable
 */
export function canUserSubscribe(
  _userId: string,
  userUserGroupIds: string[],
  sectionPurposeLinks: Array<{ purpose?: string; purposes?: string[] | null; userGroup: { id: string } }>,
  memberGroups: Array<{
    id: string;
    subscribable?: boolean | null;
  }>,
  userMemberGroupIds: string[]
): boolean {
  if (!canUserAccessSection(userUserGroupIds, sectionPurposeLinks)) {
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
