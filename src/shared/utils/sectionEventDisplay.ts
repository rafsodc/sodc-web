export interface SectionEventListItem {
  id: string;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: string;
  endDateTime: string;
  /** Optional hero image URL when Event.imageUrl is added to schema/admin UI. */
  imageUrl?: string | null;
}

const eventDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const eventTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function isSameCalendarDay(start: Date, end: Date): boolean {
  return (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  );
}

export function formatSectionEventDate(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (!isValidDate(start) || !isValidDate(end)) return "Date unavailable";
  return isSameCalendarDay(start, end)
    ? eventDateFormatter.format(start)
    : `${eventDateFormatter.format(start)} – ${eventDateFormatter.format(end)}`;
}

export function formatSectionEventTime(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (!isValidDate(start) || !isValidDate(end)) return "Time unavailable";
  return isSameCalendarDay(start, end)
    ? `${eventTimeFormatter.format(start)} – ${eventTimeFormatter.format(end)}`
    : `Starts ${eventTimeFormatter.format(start)} · Ends ${eventTimeFormatter.format(end)}`;
}

/**
 * Upcoming events: endDateTime is still in the future (includes events currently in progress).
 * Matches the welcome dashboard rule in useUpcomingEventsForUser (#232).
 */
export function isUpcomingSectionEvent(
  event: Pick<SectionEventListItem, "endDateTime">,
  nowMs = Date.now()
): boolean {
  return new Date(event.endDateTime).getTime() >= nowMs;
}

export function sortUpcomingSectionEvents<T extends SectionEventListItem>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  );
}

/** Past events: most recently ended first. */
export function sortPastSectionEvents<T extends SectionEventListItem>(events: T[]): T[] {
  return [...events].sort(
    (a, b) => new Date(b.endDateTime).getTime() - new Date(a.endDateTime).getTime()
  );
}

export function partitionSectionEventsByTiming<T extends SectionEventListItem>(
  events: T[],
  nowMs = Date.now()
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const event of events) {
    if (isUpcomingSectionEvent(event, nowMs)) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }
  return {
    upcoming: sortUpcomingSectionEvents(upcoming),
    past: sortPastSectionEvents(past),
  };
}

export function formatSectionEventWhen(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  return `${start.toLocaleString()} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
