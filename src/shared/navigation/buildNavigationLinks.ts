import type { GetSectionsForUserData, SectionUserGroupPurpose } from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import { ROUTES } from "../../constants";

export interface NavigationLink {
  label: string;
  to: string;
  state?: unknown;
  children?: NavigationLink[];
}

export interface NavigationLinks {
  sections: NavigationLink[];
  admin: NavigationLink[];
}

interface BuildNavigationLinksArgs {
  isEnabled: boolean;
  isAdmin: boolean;
  sectionsData?: GetSectionsForUserData;
}

type SectionLinkSource = {
  purposes?: SectionUserGroupPurpose[] | null;
  section?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

function linkHasPurpose(link: SectionLinkSource, target: SectionUserGroupPurpose): boolean {
  return link.purposes?.includes(target) ?? false;
}

function addSectionLink(map: Map<string, NavigationLink>, link: SectionLinkSource) {
  const section = link.section;
  if (!section?.id || map.has(section.id)) {
    return;
  }
  const label = section.name || "Untitled section";
  map.set(section.id, { label, to: `/sections/${section.id}` });
}

function markSectionAdministerable(map: Map<string, boolean>, link: SectionLinkSource) {
  const section = link.section;
  if (!linkHasPurpose(link, SectionPurpose.MODERATOR) || !section?.id) {
    return;
  }
  map.set(section.id, true);
}

function sortLinks<T extends NavigationLink>(links: Iterable<T>): T[] {
  return Array.from(links).sort((a, b) => a.label.localeCompare(b.label));
}

function manageSectionLink({
  label,
  sectionId,
  sectionName,
}: {
  label: string;
  sectionId: string;
  sectionName: string;
}): NavigationLink {
  return {
    label,
    to: ROUTES.MANAGE_SECTIONS,
    state: {
      managedSection: {
        id: sectionId,
        name: sectionName,
      },
    },
  };
}

function buildAdminLinks({
  isAdmin,
  sectionMap,
  administerableSectionIds,
  sectionsData,
}: {
  isAdmin: boolean;
  sectionMap: Map<string, NavigationLink>;
  administerableSectionIds: Map<string, boolean>;
  sectionsData?: GetSectionsForUserData;
}): NavigationLink[] {
  const sectionAdminChildren = sortLinks(
    Array.from(administerableSectionIds.keys()).flatMap((sectionId) => {
      const section = sectionMap.get(sectionId);
      if (!section) {
        return [];
      }
      return [
        manageSectionLink({
          label: section.label,
          sectionId,
          sectionName: section.label,
        }),
      ];
    })
  );

  const userGroupChildren = isAdmin
    ? sortLinks(
        (sectionsData?.allUserGroups ?? []).map((group) => ({
          label: group.name || "Untitled user group",
          to: ROUTES.USER_GROUPS,
          state: {
            expandedGroupId: group.id,
          },
        }))
      )
    : [];

  const links: NavigationLink[] = [];

  if (isAdmin) {
    links.push({ label: "Manage Users", to: ROUTES.MANAGE_USERS });
    links.push({ label: "Approvals", to: ROUTES.APPROVE_USERS });
  }

  if (isAdmin || sectionAdminChildren.length > 0) {
    links.push({
      label: "Manage Sections",
      to: ROUTES.MANAGE_SECTIONS,
      state: null,
      children: sectionAdminChildren,
    });
  }

  if (isAdmin) {
    links.push({
      label: "User Groups",
      to: ROUTES.USER_GROUPS,
      state: null,
      children: userGroupChildren,
    });
    links.push({ label: "Audit Logs", to: ROUTES.AUDIT_LOGS });
  }

  return links;
}

export function buildNavigationLinks({
  isEnabled,
  isAdmin,
  sectionsData,
}: BuildNavigationLinksArgs): NavigationLinks {
  if (!isEnabled) {
    return { sections: [], admin: [] };
  }

  const sectionMap = new Map<string, NavigationLink>();
  const administerableSectionIds = new Map<string, boolean>();
  const explicitGroups = sectionsData?.user?.userGroups ?? [];

  for (const groupRelation of explicitGroups) {
    for (const purposeLink of groupRelation?.userGroup?.purposeLinks ?? []) {
      if (
        linkHasPurpose(purposeLink, SectionPurpose.ACCESS) ||
        linkHasPurpose(purposeLink, SectionPurpose.MODERATOR)
      ) {
        addSectionLink(sectionMap, purposeLink);
      }
      markSectionAdministerable(administerableSectionIds, purposeLink);
    }
  }

  const userStatus = sectionsData?.user?.membershipStatus;
  if (userStatus) {
    for (const userGroup of sectionsData?.allUserGroups ?? []) {
      if (!userGroup?.membershipStatuses?.includes(userStatus)) {
        continue;
      }
      for (const purposeLink of userGroup.purposeLinks ?? []) {
        if (
          linkHasPurpose(purposeLink, SectionPurpose.ACCESS) ||
          linkHasPurpose(purposeLink, SectionPurpose.MODERATOR)
        ) {
          addSectionLink(sectionMap, purposeLink);
        }
        markSectionAdministerable(administerableSectionIds, purposeLink);
      }
    }
  }

  if (isAdmin) {
    for (const sectionId of sectionMap.keys()) {
      administerableSectionIds.set(sectionId, true);
    }
  }

  return {
    sections: sortLinks(sectionMap.values()).map((section) => {
      const sectionId = section.to.replace("/sections/", "");
      if (!administerableSectionIds.has(sectionId)) {
        return section;
      }
      return {
        ...section,
        children: [
          manageSectionLink({
            label: "Administer",
            sectionId,
            sectionName: section.label,
          }),
        ],
      };
    }),
    admin: buildAdminLinks({ isAdmin, sectionMap, administerableSectionIds, sectionsData }),
  };
}
