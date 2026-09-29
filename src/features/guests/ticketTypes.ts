import { ORGANISER_GUEST } from "../../shared/utils/ticketAudienceLabels";
import type { TicketTypeRow } from "../admin/components/sectionEventsManagerTypes";
import type { GuestType } from "./api";
export function organiserTicketTypeRow(type: GuestType): TicketTypeRow {
  return {
    id: type.id,
    title: type.title,
    description: type.description ?? null,
    price: type.priceMinor / 100,
    sortOrder: type.sortOrder ?? 0,
    audience: ORGANISER_GUEST,
    includesDinner: type.includesDinner,
    includesSymposium: type.includesSymposium,
    userGroup: null,
    active: type.active,
    version: type.version,
  };
}
