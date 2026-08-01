import type {
  GetMyAnnouncementPreferencesData,
  SectionUserGroupPurpose,
} from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";

interface AnnouncementSection {
  id: string;
  name: string;
}

function grantsSectionAccess(purposes?: SectionUserGroupPurpose[] | null) {
  return (
    purposes?.includes(SectionPurpose.ACCESS) ||
    purposes?.includes(SectionPurpose.MODERATOR)
  );
}

export function getAnnouncementSections(
  data: GetMyAnnouncementPreferencesData | null | undefined,
): AnnouncementSection[] {
  const sections = new Map<string, AnnouncementSection>();
  const addLinks = (
    links?: GetMyAnnouncementPreferencesData["allUserGroups"][number]["purposeLinks"] | null,
  ) => {
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
