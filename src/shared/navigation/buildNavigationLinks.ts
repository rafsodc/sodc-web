import type { GetSectionsForUserData, SectionUserGroupPurpose } from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import { ROUTES } from "../../constants";
import { sectionDetailLocationState } from "./sectionNavigationState";

export interface NavigationLink {
  label: string;
  to: string;
  state?: unknown;
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

function addSectionLink(map: Map<string, NavigationLink>, link: SectionLinkSource) {
  const section = link.section;
  if (!section?.id || map.has(section.id)) {
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

function buildAdminLinks({
  isAdmin,
  administerableSectionIds,
}: {
  isAdmin: boolean;
  administerableSectionIds: Map<string, boolean>;
}): NavigationLink[] {
  const links: NavigationLink[] = [];

  if (isAdmin) {
    links.push({ label: "Manage Users", to: ROUTES.MANAGE_USERS });
    links.push({ label: "Approvals", to: ROUTES.APPROVE_USERS });
  }

  if (isAdmin || administerableSectionIds.size > 0) {
    links.push({ label: "Manage Sections", to: ROUTES.MANAGE_SECTIONS });
  }

  if (isAdmin) {
    links.push({ label: "User Groups", to: ROUTES.USER_GROUPS });
    links.push({ label: "Payment Reconciliation", to: ROUTES.PAYMENT_RECONCILIATION });
    links.push({ label: "Email Templates", to: ROUTES.EMAIL_TEMPLATES });
    links.push({ label: "Email Delivery", to: ROUTES.EMAIL_DELIVERY });
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
    sections: sortLinks(sectionMap.values()),
    admin: buildAdminLinks({ isAdmin, administerableSectionIds }),
  };
}
