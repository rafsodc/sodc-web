import { sectionPath } from "./sectionRoutes";
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
    to: sectionPath(section.id),
    state: sectionDetailLocationState(ROUTES.HOME),
  });
}


function sortLinks<T extends NavigationLink>(links: Iterable<T>): T[] {
  return Array.from(links).sort((a, b) => a.label.localeCompare(b.label));
}

function buildAdminLinks({
  isAdmin,
}: {
  isAdmin: boolean;
}): NavigationLink[] {
  if (!isAdmin) return [];
  const links: NavigationLink[] = [
    { label: "Manage Users", to: ROUTES.MANAGE_USERS },
    { label: "Approvals", to: ROUTES.APPROVE_USERS },
    { label: "Manage Sections", to: ROUTES.MANAGE_SECTIONS },
    { label: "User Groups", to: ROUTES.USER_GROUPS },
    { label: "Payment Reconciliation", to: ROUTES.PAYMENT_RECONCILIATION },
    { label: "Email Templates", to: ROUTES.EMAIL_TEMPLATES },
    { label: "Email Delivery", to: ROUTES.EMAIL_DELIVERY },
    { label: "Audit Logs", to: ROUTES.AUDIT_LOGS },
  ];
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
  const explicitGroups = sectionsData?.user?.userGroups ?? [];

  for (const groupRelation of explicitGroups) {
    for (const purposeLink of groupRelation?.userGroup?.purposeLinks ?? []) {
      if (
        linkHasPurpose(purposeLink, SectionPurpose.ACCESS) ||
        linkHasPurpose(purposeLink, SectionPurpose.MODERATOR)
      ) {
        addSectionLink(sectionMap, purposeLink);
      }
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
        }
    }
  }



  return {
    sections: sortLinks(sectionMap.values()),
    admin: buildAdminLinks({ isAdmin }),
  };
}
