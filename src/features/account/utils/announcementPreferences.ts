interface AnnouncementSection {
  id: string;
  name: string;
}

interface PurposeLink {
  purposes?: string[] | null;
  section?: AnnouncementSection | null;
}

interface PreferenceGroup {
  membershipStatuses?: string[] | null;
  purposeLinks?: PurposeLink[] | null;
}

export interface AnnouncementPreferenceData {
  user?: {
    membershipStatus?: string | null;
    userGroups?: Array<{ userGroup: PreferenceGroup }> | null;
  } | null;
  allUserGroups?: PreferenceGroup[] | null;
}

function grantsSectionAccess(purposes?: string[] | null) {
  return purposes?.includes("ACCESS") || purposes?.includes("MODERATOR");
}

export function getAnnouncementSections(
  data: AnnouncementPreferenceData | null | undefined,
): AnnouncementSection[] {
  const sections = new Map<string, AnnouncementSection>();
  const addLinks = (links?: PurposeLink[] | null) => {
    for (const link of links ?? []) {
      if (grantsSectionAccess(link.purposes) && link.section && !sections.has(link.section.id)) {
        sections.set(link.section.id, link.section);
      }
    }
  };

  for (const membership of data?.user?.userGroups ?? []) {
    addLinks(membership.userGroup.purposeLinks);
  }

  const membershipStatus = data?.user?.membershipStatus;
  for (const group of data?.allUserGroups ?? []) {
    if (membershipStatus && group.membershipStatuses?.includes(membershipStatus)) {
      addLinks(group.purposeLinks);
    }
  }

  return [...sections.values()].sort((left, right) => left.name.localeCompare(right.name));
}
