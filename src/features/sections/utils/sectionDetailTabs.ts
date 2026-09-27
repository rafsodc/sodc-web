export type EventDetailTab = "about" | "book" | "attendees";

export function eventDetailTabLabel(tab: EventDetailTab): string {
  return { about: "About", book: "Book", attendees: "Attendees" }[tab];
}
