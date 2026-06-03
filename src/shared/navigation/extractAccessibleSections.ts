import type { GetSectionsForUserData, SectionType, SectionUserGroupPurpose } from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";

export interface AccessibleSection {
  id: string;
  name: string;
  type: SectionType;
  description?: string | null;
}

type SectionLinkSource = {
  purposes?: SectionUserGroupPurpose[] | null;
  section?: {
    id?: string | null;
    name?: string | null;
    type?: SectionType | null;
    description?: string | null;
  } | null;
};

function linkHasPurpose(link: SectionLinkSource, target: SectionUserGroupPurpose): boolean {
  return link.purposes?.includes(target) ?? false;
}

function addSection(map: Map<string, AccessibleSection>, link: SectionLinkSource) {
  const section = link.section;
  if (!section?.id || map.has(section.id)) {
    return;
  }
  map.set(section.id, {
    id: section.id,
    name: section.name || "Untitled section",
    type: section.type!,
    description: section.description,
  });
}

/**
 * Sections the member can access via ACCESS or MODERATOR purpose links.
 * Mirrors rules in `buildNavigationLinks` (excluding nav-only entries like My Payments).
 */
export function extractAccessibleSections(sectionsData?: GetSectionsForUserData): AccessibleSection[] {
  if (!sectionsData) {
    return [];
  }

  const sectionMap = new Map<string, AccessibleSection>();
  const explicitGroups = sectionsData.user?.userGroups ?? [];

  for (const groupRelation of explicitGroups) {
    for (const purposeLink of groupRelation?.userGroup?.purposeLinks ?? []) {
      if (
        linkHasPurpose(purposeLink, SectionPurpose.ACCESS) ||
        linkHasPurpose(purposeLink, SectionPurpose.MODERATOR)
      ) {
        addSection(sectionMap, purposeLink);
      }
    }
  }

  const userStatus = sectionsData.user?.membershipStatus;
  if (userStatus) {
    for (const userGroup of sectionsData.allUserGroups ?? []) {
      if (!userGroup?.membershipStatuses?.includes(userStatus)) {
        continue;
      }
      for (const purposeLink of userGroup.purposeLinks ?? []) {
        if (
          linkHasPurpose(purposeLink, SectionPurpose.ACCESS) ||
          linkHasPurpose(purposeLink, SectionPurpose.MODERATOR)
        ) {
          addSection(sectionMap, purposeLink);
        }
      }
    }
  }

  return Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
