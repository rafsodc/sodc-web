import { ROUTES } from "../../../constants";

interface SectionAdminNavigationSection {
  id: string;
  name: string;
}

export function getSectionAdminDestination(
  section: SectionAdminNavigationSection,
  isMembers: boolean,
  selectedEventId: string | null
) {
  if (isMembers) {
    return {
      to: ROUTES.MANAGE_SECTIONS,
      state: { editSectionId: section.id },
    };
  }

  return {
    to: ROUTES.MANAGE_SECTIONS,
    state: {
      managedSection: {
        id: section.id,
        name: section.name,
      },
      eventId: selectedEventId ?? undefined,
    },
  };
}
