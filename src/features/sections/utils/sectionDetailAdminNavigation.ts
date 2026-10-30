import { eventManagementPath, sectionManagementPath } from "../../../shared/navigation/sectionRoutes";
interface SectionAdminNavigationSection { id: string; name: string; type?: string }
export function getSectionAdminDestination(section: SectionAdminNavigationSection, _isMembers: boolean, selectedEventId: string | null) {
  return {to: selectedEventId ? eventManagementPath(section.id, selectedEventId) : sectionManagementPath(section.id), state: undefined};
}
