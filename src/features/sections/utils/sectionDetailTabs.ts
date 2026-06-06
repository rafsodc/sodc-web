export type SectionDetailTab = "about" | "events" | "members";

export function getSectionDetailTabs(isMembersSection: boolean): SectionDetailTab[] {
  return isMembersSection ? ["about", "members"] : ["about", "events"];
}

export function getDefaultSectionDetailTab(isMembersSection: boolean): SectionDetailTab {
  return isMembersSection ? "members" : "events";
}

export function sectionDetailTabLabel(tab: SectionDetailTab): string {
  if (tab === "about") return "About";
  if (tab === "events") return "Events";
  return "Members";
}
