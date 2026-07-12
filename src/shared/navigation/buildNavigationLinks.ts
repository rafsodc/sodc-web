import type { GetSectionsForUserData, SectionUserGroupPurpose } from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import { ROUTES } from "../../constants";
import { sectionDetailLocationState } from "./sectionNavigationState";

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
    type?: string | null;
  } | null;
};

function linkHasPurpose(link: SectionLinkSource, target: SectionUserGroupPurpose): boolean {
  return link.purposes?.includes(target) ?? false;
}

function addSectionLink(
  map: Map<string, NavigationLink>,
  typeMap: Map<string, string | null | undefined>,
  link: SectionLinkSource
) {
  const section = link.section;
  if (!section?.id) {
    return;
  }
  if (!typeMap.has(section.id)) {
    typeMap.set(section.id, section.type);
  }
  if (map.has(section.id)) {
    return;
  }
  const label = section.name || "Untitled section";
  map.set(section.id, {
    label,
    to: `/sections/${section.id}`,
    state: sectionDetailLocationState(ROUTES.HOME),
  });
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

// Same destination as the "Admin" button on a section's own page (see getSectionAdminDestination) —
// both entry points should open the same hub of options, not diverge into a narrower admin surface.
function sectionAdminLink({
  label,
  sectionId,
  sectionName,
  sectionType,
}: {
  label: string;
  sectionId: string;
  sectionName: string;
  sectionType?: string | null;
}): NavigationLink {
  return {
    label,
    to: ROUTES.SECTION_ADMIN.replace(":sectionId", sectionId),
    state: {
      sectionName,
      sectionType: sectionType ?? "MEMBERS",
    },
  };
}

function buildAdminLinks({
  isAdmin,
  sectionMap,
  administerableSectionIds,
  sectionTypeMap,
  sectionsData,
}: {
  isAdmin: boolean;
  sectionMap: Map<string, NavigationLink>;
  administerableSectionIds: Map<string, boolean>;
  sectionTypeMap: Map<string, string | null | undefined>;
  sectionsData?: GetSectionsForUserData;
}): NavigationLink[] {
  const sectionAdminChildren = sortLinks(
    Array.from(administerableSectionIds.keys()).flatMap((sectionId) => {
      const section = sectionMap.get(sectionId);
      if (!section) {
        return [];
      }
      return [
        sectionAdminLink({
          label: section.label,
          sectionId,
          sectionName: section.label,
          sectionType: sectionTypeMap.get(sectionId),
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
    links.push({ label: "Payment Reconciliation", to: ROUTES.PAYMENT_RECONCILIATION });
    links.push({ label: "Email Templates", to: ROUTES.EMAIL_TEMPLATES });
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
  const sectionTypeMap = new Map<string, string | null | undefined>();
  const administerableSectionIds = new Map<string, boolean>();
  const explicitGroups = sectionsData?.user?.userGroups ?? [];

  for (const groupRelation of explicitGroups) {
    for (const purposeLink of groupRelation?.userGroup?.purposeLinks ?? []) {
      if (
        linkHasPurpose(purposeLink, SectionPurpose.ACCESS) ||
        linkHasPurpose(purposeLink, SectionPurpose.MODERATOR)
      ) {
        addSectionLink(sectionMap, sectionTypeMap, purposeLink);
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
          addSectionLink(sectionMap, sectionTypeMap, purposeLink);
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
            sectionAdminLink({
              label: "Administer",
              sectionId,
              sectionName: section.label,
              sectionType: sectionTypeMap.get(sectionId),
            }),
          ],
        };
      }),
    admin: buildAdminLinks({ isAdmin, sectionMap, administerableSectionIds, sectionTypeMap, sectionsData }),
  };
}
