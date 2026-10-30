import {
  emptyEventAttendeeTicketFilters,
  type EventAttendeeTicketFilters,
} from "./bookingApprovalsAdmin";
import { eventManagementPath } from "../../../shared/navigation/sectionRoutes";

/** Preserve the selected audience on copied/reloaded announcement links.
 * Only the known filter fields are admitted; the server still resolves recipients. */
export function readEventAnnouncementFilters(
  search: string,
): EventAttendeeTicketFilters {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    Object.keys(emptyEventAttendeeTicketFilters).map((key) => [
      key,
      (params.get(`audience.${key}`) ?? "").slice(0, 200),
    ]),
  ) as unknown as EventAttendeeTicketFilters;
}
export function eventAnnouncementPath(
  sectionId: string,
  eventId: string,
  filters: EventAttendeeTicketFilters,
): string {
  const path = eventManagementPath(sectionId, eventId, "announcement");
  const params = new URLSearchParams(path.split("?")[1]);
  for (const key of Object.keys(emptyEventAttendeeTicketFilters) as Array<
    keyof EventAttendeeTicketFilters
  >) {
    if (filters[key]) params.set(`audience.${key}`, filters[key].slice(0, 200));
  }
  return `${path.split("?")[0]}?${params}`;
}
