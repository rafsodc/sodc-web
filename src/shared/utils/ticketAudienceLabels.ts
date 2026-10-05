import { TicketAudience } from "@dataconnect/generated";

export const ORGANISER_GUEST = TicketAudience.ORGANISER_GUEST;
export type ManagedTicketAudience = TicketAudience;
export const TICKET_CATEGORY_LABEL = "Ticket category";

export function getTicketCategoryLabel(audience: ManagedTicketAudience): string {
  if (audience === ORGANISER_GUEST) return "Organiser/club guest ticket";
  return audience === TicketAudience.GUEST ? "Member’s guest ticket" : "Member ticket";
}
