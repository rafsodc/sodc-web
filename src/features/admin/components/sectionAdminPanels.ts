export type SectionAdminPanel = "files" | "announcements" | "events";

const importFiles = () => import("./ManageSectionFiles");
const importAnnouncements = () => import("./SendAnnouncementPage");
const importEvents = () => import("./SectionEventsManager");
let filesModule: ReturnType<typeof importFiles> | undefined;
let announcementsModule: ReturnType<typeof importAnnouncements> | undefined;
let eventsModule: ReturnType<typeof importEvents> | undefined;

export const loadSectionFilesPanel = () => filesModule ??= importFiles();
export const loadSectionAnnouncementsPanel = () => announcementsModule ??= importAnnouncements();
export const loadSectionEventsPanel = () => eventsModule ??= importEvents();

/** Code only: permission checks still own mounting and all private SDK reads. */
export async function preloadSectionAdminPanel(panel: SectionAdminPanel): Promise<void> {
  if (panel === "files") await loadSectionFilesPanel();
  else if (panel === "announcements") await loadSectionAnnouncementsPanel();
  else await loadSectionEventsPanel();
}
