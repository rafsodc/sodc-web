import { toCanonicalUuid } from "../utils/uuid";
/** Resource IDs are always encoded; task selectors come from a closed vocabulary. */
export const memberEventTabs = ["about", "book", "attendees"] as const;
export type MemberEventTab = (typeof memberEventTabs)[number];
export const eventManagementTasks = [
  "details",
  "tickets",
  "approvals",
  "attendees",
  "guests",
  "activity",
  "payments",
  "announcement",
] as const;
export type EventManagementTask = (typeof eventManagementTasks)[number];
export function normalizedResourceId(value: string): string {
  try {
    return toCanonicalUuid(value);
  } catch {
    return value;
  }
}
const id = (value: string) => encodeURIComponent(normalizedResourceId(value));
export const sectionPath = (sectionId: string) => `/sections/${id(sectionId)}`;
export const memberEventPath = (
  sectionId: string,
  eventId: string,
  tab: MemberEventTab = "about",
) =>
  `${sectionPath(sectionId)}/events/${id(eventId)}${tab === "about" ? "" : `?tab=${tab}`}`;
export const sectionManagementPath = (
  sectionId: string,
  view: "files" | "announcements" | "events" | "" = "",
) => `${sectionPath(sectionId)}/manage${view ? `/${view}` : ""}`;
export const eventManagementPath = (
  sectionId: string,
  eventId: string,
  task: EventManagementTask = "details",
) =>
  `${sectionManagementPath(sectionId, "events")}/${id(eventId)}${task === "details" ? "" : `?task=${task}`}`;
export const sectionConfigurationPath = (sectionId: string) =>
  `/admin/sections?section=${id(sectionId)}`;
export function readMemberEventTab(search: string): MemberEventTab {
  const value = new URLSearchParams(search).get("tab");
  return memberEventTabs.find((tab) => tab === value) ?? "about";
}
export function readEventManagementTask(search: string): EventManagementTask {
  const value = new URLSearchParams(search).get("task");
  return eventManagementTasks.find((task) => task === value) ?? "details";
}

export const eventEditorPath = (sectionId: string, eventId?: string) =>
  eventId
    ? `${eventManagementPath(sectionId, eventId)}?edit=event`
    : `${sectionManagementPath(sectionId, "events")}?edit=new-event`;
export const ticketEditorPath = (
  sectionId: string,
  eventId: string,
  ticketId = "new",
) =>
  `${eventManagementPath(sectionId, eventId, "tickets")}&ticket=${id(ticketId)}`;
