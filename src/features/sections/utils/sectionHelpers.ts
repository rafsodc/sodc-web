import type { SectionType, MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/generated";
import { linkHasPurpose, type PurposeBearingLink } from "./purposeLinks";

/**
 * Flattened user data from section member list
 */
export interface SectionMember {
  userId: string;
  firstName: string;
  lastName: string;
  membershipStatus: MembershipStatus;
  rank: string | null;
  sharesContactInfo: boolean;
  /** Null whenever sharesContactInfo is false — withheld server-side, not just hidden client-side. */
  email: string | null;
}

/** Sorts by surname, then first name to break ties. Does not mutate the input array. */
export function sortMembersBySurname(members: SectionMember[]): SectionMember[] {
  return [...members].sort((a, b) => {
    const lastNameCompare = a.lastName.localeCompare(b.lastName);
    return lastNameCompare !== 0 ? lastNameCompare : a.firstName.localeCompare(b.firstName);
  });
}

/** Purposes that allow opening / seeing a section. MODERATOR implies this for authorization. */
export const SECTION_ACCESS_PURPOSES: ReadonlyArray<string> = ["ACCESS", "MODERATOR"];

export function purposeGrantsSectionAccess(purpose: SectionUserGroupPurpose | string): boolean {
  return SECTION_ACCESS_PURPOSES.includes(purpose);
}

/**
 * Type guard to check if a section is a MEMBERS section
 */
export function isMembersSection(section: { type: SectionType }): boolean {
  return section.type === "MEMBERS";
}

type PurposeLinkWithUsers = PurposeBearingLink & {
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

type SectionDataWithPurposeLinks = {
  purposeLinks?: PurposeLinkWithUsers[];
};

/**
 * MEMBER-purpose groups for rollup. A section only has members if it has an explicit
 * MEMBER-purpose group — ACCESS/MODERATOR only grant seeing the section, not membership. See #322.
 */
function getRollupPurposeLinks(
  sectionData: SectionDataWithPurposeLinks | null | undefined
): PurposeLinkWithUsers[] {
  const links = sectionData?.purposeLinks ?? [];
  return links.filter((l) => linkHasPurpose(l, "MEMBER"));
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
          // This raw purposeLinks shape predates rank/shareContactInfo and isn't used by any
          // production call site (only getSectionMembersMerged is, which does carry them) —
          // default rather than plumb the fields through a function nothing calls.
          rank: null,
          sharesContactInfo: true,
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
 * Member-list / subscription groups: only groups with an explicit MEMBER-purpose link. See #322.
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
  return sectionData.purposeLinks
    .filter((l) => linkHasPurpose(l, "MEMBER"))
    .map((groupRelation) => groupRelation.userGroup);
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
