export type EventDetailTab = "about" | "book";

export function eventDetailTabLabel(tab: EventDetailTab): string {
  return tab === "about" ? "About" : "Book";
}
