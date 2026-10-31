import { expect, it, vi } from "vitest";
import { loadSectionAnnouncementsPanel, loadSectionEventsPanel, loadSectionFilesPanel, preloadSectionAdminPanel } from "../sectionAdminPanels";

const imports = vi.hoisted(() => ({ files: vi.fn(), events: vi.fn(), announcements: vi.fn() }));
vi.mock("../ManageSectionFiles", () => { imports.files(); return { default: () => null }; });
vi.mock("../SectionEventsManager", () => { imports.events(); return { default: () => null }; });
vi.mock("../SendAnnouncementPage", () => { imports.announcements(); throw new Error("Failed to fetch dynamically imported module"); });

it("shares requested destination imports between intent preloading and lazy rendering", async () => {
  const files = loadSectionFilesPanel();
  expect(loadSectionFilesPanel()).toBe(files);
  await Promise.all([files, preloadSectionAdminPanel("files")]);
  expect(imports.files).toHaveBeenCalledOnce();
  expect(imports.events).not.toHaveBeenCalled();
  expect(imports.announcements).not.toHaveBeenCalled();
  const events = loadSectionEventsPanel();
  expect(loadSectionEventsPanel()).toBe(events);
  await Promise.all([events, preloadSectionAdminPanel("events")]);
  expect(imports.events).toHaveBeenCalledOnce();
  expect(imports.files).toHaveBeenCalledOnce();
});

it("retains a failed destination import until explicit page recovery instead of retrying automatically", async () => {
  await expect(preloadSectionAdminPanel("announcements")).rejects.toThrow();
  const failed = loadSectionAnnouncementsPanel();
  expect(loadSectionAnnouncementsPanel()).toBe(failed);
  await expect(failed).rejects.toThrow();
  await expect(preloadSectionAdminPanel("announcements")).rejects.toThrow();
  expect(imports.announcements).toHaveBeenCalledOnce();
});
