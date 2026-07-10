import { ROUTES } from "../../../constants";

interface SectionAdminNavigationSection {
  id: string;
  name: string;
  type?: string;
}

export function getSectionAdminDestination(
  section: SectionAdminNavigationSection,
  _isMembers: boolean,
  _selectedEventId: string | null
) {
  return {
    to: ROUTES.SECTION_ADMIN.replace(":sectionId", section.id),
    state: {
      sectionName: section.name,
      sectionType: section.type ?? "MEMBERS",
    },
  };
}
