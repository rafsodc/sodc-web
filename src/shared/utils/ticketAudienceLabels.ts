import { TicketAudience } from "@dataconnect/generated";

export const TICKET_CATEGORY_LABEL = "Ticket category";

export function getTicketCategoryLabel(audience: TicketAudience): string {
  return audience === TicketAudience.GUEST ? "Guest ticket" : "Member ticket";
}
