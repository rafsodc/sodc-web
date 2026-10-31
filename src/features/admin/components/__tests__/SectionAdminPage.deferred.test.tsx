import { act, cleanup, render, screen, waitFor } from "../../../../test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import SectionAdminPage from "../SectionAdminPage";

const deferred = vi.hoisted(() => {
  let releaseFiles!: () => void;
  let releaseEvents!: () => void;
  let rejectAnnouncements!: (error: Error) => void;
  return {
    files: new Promise<void>(resolve => { releaseFiles = resolve; }),
    events: new Promise<void>(resolve => { releaseEvents = resolve; }),
    announcements: new Promise<void>((_resolve, reject) => { rejectAnnouncements = reject; }),
    releaseFiles: () => releaseFiles(), releaseEvents: () => releaseEvents(),
    rejectAnnouncements: (error: Error) => rejectAnnouncements(error),
    filesImports: vi.fn(), eventsImports: vi.fn(), announcementsImports: vi.fn(), eventsMounts: vi.fn(), writes: vi.fn(),
    resolved: false, allowed: false, failed: false, sectionType: "EVENTS",
  };
});
vi.mock("../../../sections/hooks/useCanModerateSection", () => ({
  useCanModerateSection: () => ({ isResolved: deferred.resolved, canModerateSection: deferred.allowed, failed: deferred.failed,
    section: { id: "section-1", name: "Authoritative events", type: deferred.sectionType, purposeLinks: [] },
  }),
}));
vi.mock("../ManageSectionFiles", async () => {
  deferred.filesImports();
  await deferred.files;
  return { default: () => <div>Loaded section files</div> };
});
vi.mock("../SectionEventsManager", async () => {
  deferred.eventsImports();
  await deferred.events;
  return { default: function EventsStub() {
    const [draft, setDraft] = useState("");
    useEffect(() => { deferred.eventsMounts(); }, []);
    return <><label>Event draft<input value={draft} onChange={event => setDraft(event.target.value)} /></label><button onClick={deferred.writes}>Save event</button></>;
  } };
});
vi.mock("../sectionAdminPanels", async importOriginal => {
  const actual = await importOriginal<typeof import("../sectionAdminPanels")>();
  let announcementModule: Promise<{ default: () => React.JSX.Element }> | undefined;
  const loadAnnouncements = () => announcementModule ??= (() => {
    deferred.announcementsImports();
    return deferred.announcements.then(() => ({ default: () => <div>Loaded announcements</div> }));
  })();
  return { ...actual, loadSectionAnnouncementsPanel: loadAnnouncements,
    preloadSectionAdminPanel: async (panel: "events" | "files" | "announcements") => {
      if (panel === "announcements") await loadAnnouncements();
      else await actual.preloadSectionAdminPanel(panel);
    },
  };
});
function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/sections/section-1/manage")}>Management home</button><button onClick={() => navigate("/sections/section-1/manage/events/event-1")}>Open event</button><button onClick={() => navigate("/sections/section-1/manage/events/event-1?task=payments")}>Open payments</button></>;
}
function content(path = "/sections/section-1/manage/events/event-1") {
  return <MemoryRouter initialEntries={[path]}><Navigation /><Routes><Route path="/sections/:sectionId/manage/*" element={<SectionAdminPage />} /></Routes></MemoryRouter>;
}
beforeEach(() => { deferred.resolved = false; deferred.allowed = false; deferred.failed = false; deferred.sectionType = "EVENTS"; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(["/sections/section-1/manage", "/sections/section-1/manage/files/extra", "/sections/section-1/manage/events/event-1/extra"])("does not preload any destination for landing or malformed URL %s", path => {
  render(content(path));
  expect(deferred.filesImports).not.toHaveBeenCalled();
  expect(deferred.eventsImports).not.toHaveBeenCalled();
  expect(deferred.announcementsImports).not.toHaveBeenCalled();
});

it.each(["denied", "failed", "wrong-type"])("does not preload or mount a destination already known to be %s", reason => {
  deferred.resolved = true;
  deferred.allowed = reason !== "denied";
  deferred.failed = reason === "failed";
  deferred.sectionType = reason === "wrong-type" ? "MEMBERS" : "EVENTS";
  render(content());
  expect(deferred.filesImports).not.toHaveBeenCalled();
  expect(deferred.eventsImports).not.toHaveBeenCalled();
  expect(deferred.announcementsImports).not.toHaveBeenCalled();
  expect(deferred.eventsMounts).not.toHaveBeenCalled();
});

it("starts only requested code beside permission checks, mounts only after authorization, and retains a loaded event across tasks", async () => {
  const user = userEvent.setup();
  const view = render(content());
  expect(screen.getByRole("progressbar", { name: "Loading section management" })).toBeInTheDocument();
  await waitFor(() => expect(deferred.eventsImports).toHaveBeenCalledOnce());
  expect(deferred.filesImports).not.toHaveBeenCalled();
  expect(deferred.announcementsImports).not.toHaveBeenCalled();
  expect(deferred.eventsMounts).not.toHaveBeenCalled();
  deferred.resolved = true;
  view.rerender(content());
  expect(screen.getByText(/Access denied/)).toBeInTheDocument();
  expect(deferred.eventsMounts).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Management home" }));
  deferred.allowed = true;
  view.rerender(content());
  expect(screen.getByRole("heading", { name: "Administer — Authoritative events" })).toBeInTheDocument();
  expect(deferred.filesImports).not.toHaveBeenCalled();
  expect(deferred.eventsImports).toHaveBeenCalledOnce();
  expect(deferred.announcementsImports).not.toHaveBeenCalled();

  await user.click(screen.getByRole("link", { name: "Files" }));
  expect(screen.getByRole("progressbar", { name: "Loading section files" })).toBeInTheDocument();
  await waitFor(() => expect(deferred.filesImports).toHaveBeenCalledOnce());
  expect(screen.getByRole("navigation", { name: "Section management" })).toBeInTheDocument();
  expect(deferred.eventsMounts).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Open event" }));
  expect(screen.getByRole("progressbar", { name: "Loading event management" })).toBeInTheDocument();
  await waitFor(() => expect(deferred.eventsImports).toHaveBeenCalledOnce());
  await act(async () => deferred.releaseFiles());
  expect(screen.queryByText("Loaded section files")).not.toBeInTheDocument();
  await act(async () => deferred.releaseEvents());
  const draft = await screen.findByLabelText("Event draft");
  await user.type(draft, "Keep the current event draft");
  await user.click(screen.getByRole("button", { name: "Open payments" }));
  expect(screen.getByLabelText("Event draft")).toHaveValue("Keep the current event draft");
  expect(deferred.eventsImports).toHaveBeenCalledOnce();
  expect(deferred.eventsMounts).toHaveBeenCalledOnce();

  // A failed child remains local; switching to another destination must reset
  // the appropriate boundary rather than trapping the whole admin page.
  vi.spyOn(console, "error").mockImplementation(() => {});
  await user.click(screen.getByRole("link", { name: "Announcements" }));
  expect(screen.getByRole("progressbar", { name: "Loading announcements" })).toBeInTheDocument();
  await waitFor(() => expect(deferred.announcementsImports).toHaveBeenCalledOnce());
  await act(async () => deferred.rejectAnnouncements(new Error("Failed to fetch dynamically imported module")));
  await screen.findByRole("heading", { name: "This page couldn’t load" });
  expect(screen.getByRole("navigation", { name: "Section management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  expect(screen.getByText(/check any recent save before trying it again/)).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Files" }));
  await screen.findByText("Loaded section files");
  expect(screen.queryByRole("heading", { name: "This page couldn’t load" })).not.toBeInTheDocument();
  expect(deferred.filesImports).toHaveBeenCalledOnce();
  expect(deferred.writes).not.toHaveBeenCalled();
});
