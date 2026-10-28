import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import SectionAdminPage from "../SectionAdminPage";
import { getSectionForUser } from "../../../../shared/utils/firebaseFunctions";
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getSectionForUser: vi.fn(),
}));
let mockGlobalAdmin = false;
vi.mock("../../../users/hooks/useAdminClaim", () => ({
  useAdminClaim: () => mockGlobalAdmin,
}));
vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "user" } },
  dataConnect: {},
}));
vi.mock("../SendAnnouncementPage", () => ({
  default: ({ sectionName }: { sectionName: string }) => (
    <div>Announcements for {sectionName}</div>
  ),
}));
vi.mock("../ManageSectionFiles", () => ({
  default: ({ sectionName }: { sectionName: string }) => (
    <div>Files for {sectionName}</div>
  ),
}));
vi.mock("../SectionEventsManager", () => ({
  default: ({
    sectionName,
    initialEventId,
  }: {
    sectionName: string;
    initialEventId?: string;
  }) => (
    <div>
      Event management for {sectionName}: {initialEventId ?? "all"}
    </div>
  ),
}));
const lookup = vi.mocked(getSectionForUser);
const section = {
  id: "one",
  name: "Authoritative events",
  type: "EVENTS",
  purposeLinks: [],
} as never;
function Location() {
  const l = useLocation();
  const n = useNavigate();
  return (
    <>
      <output>{l.pathname + l.search}</output>
      <button onClick={() => n(-1)}>History back</button>
      <button onClick={() => n(1)}>History forward</button>
      <button onClick={() => n("/sections/two/manage")}>Other section</button>
    </>
  );
}
function start(path = "/sections/one/manage", state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Location />
      <Routes>
        <Route
          path="/sections/:sectionId/manage/*"
          element={<SectionAdminPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mockGlobalAdmin = false;
  lookup.mockReset();
  lookup.mockResolvedValue({ section, hasAccess: true, canModerate: true });
});
describe("canonical section management", () => {
  it("hydrates a cold URL from authoritative metadata and ignores forged navigation state", async () => {
    start(undefined, { sectionName: "Forged", sectionType: "MEMBERS" });
    expect(
      await screen.findByRole("heading", {
        name: "Administer — Authoritative events",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Events/ })).toHaveAttribute(
      "href",
      "/sections/one/manage/events",
    );
    expect(screen.queryByText("Edit Section")).not.toBeInTheDocument();
    expect(screen.queryByText("Tickets and guests")).not.toBeInTheDocument();
  });
  it.each(["files", "announcements", "events"])(
    "loads %s in a fresh tab",
    async (view) => {
      start(`/sections/one/manage/${view}`);
      expect(
        await screen.findByText(
          view === "files"
            ? "Files for Authoritative events"
            : view === "announcements"
              ? "Announcements for Authoritative events"
              : "Event management for Authoritative events: all",
        ),
      ).toBeInTheDocument();
    },
  );
  it("loads a selected event directly without state", async () => {
    start("/sections/one/manage/events/event-2");
    expect(
      await screen.findByText(
        "Event management for Authoritative events: event-2",
      ),
    ).toBeInTheDocument();
  });
  it("uses ordinary links and keeps task selection through back and forward", async () => {
    const u = userEvent.setup();
    start();
    await screen.findByRole("heading", { name: /Administer/ });
    await u.click(screen.getByRole("link", { name: /Manage Files/ }));
    expect(
      await screen.findByText("Files for Authoritative events"),
    ).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "History back" }));
    expect(
      await screen.findByRole("heading", { name: /Administer/ }),
    ).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "History forward" }));
    expect(
      await screen.findByText("Files for Authoritative events"),
    ).toBeInTheDocument();
  });
  it("denies management when server authority does not grant moderation", async () => {
    lookup.mockResolvedValue({ section, hasAccess: true, canModerate: false });
    start();
    expect(await screen.findByText(/Access denied/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Manage Events/ }),
    ).not.toBeInTheDocument();
  });
  it.each([null, "reject"])(
    "shows useful unavailable state for missing or denied metadata %s",
    async (kind) => {
      if (kind) lookup.mockRejectedValue(new Error("permission-denied"));
      else
        lookup.mockResolvedValue({
          section: null,
          hasAccess: false,
          canModerate: false,
        });
      start();
      expect(
        await screen.findByText(/Section unavailable/),
      ).toBeInTheDocument();
    },
  );
  it("never grants a new section the late authority or label of an old one", async () => {
    let complete!: (v: Awaited<ReturnType<typeof getSectionForUser>>) => void;
    lookup.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    lookup.mockResolvedValueOnce({
      section: { id: "two", name: "Other section", type: "MEMBERS" } as never,
      hasAccess: true,
      canModerate: false,
    });
    const u = userEvent.setup();
    start();
    await u.click(screen.getByRole("button", { name: "Other section" }));
    expect(await screen.findByText(/Access denied/)).toBeInTheDocument();
    await act(async () =>
      complete({ section, hasAccess: true, canModerate: true }),
    );
    expect(
      screen.queryByRole("link", { name: /Manage Events/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Authoritative events/)).not.toBeInTheDocument();
  });
  it("does not offer event management in a MEMBERS section even with forged event state", async () => {
    lookup.mockResolvedValue({
      section: { id: "one", name: "Members", type: "MEMBERS" } as never,
      hasAccess: true,
      canModerate: true,
    });
    start("/sections/one/manage/events/event-2", { sectionType: "EVENTS" });
    expect(await screen.findByText(/does not exist/)).toBeInTheDocument();
  });
  it.each(["admin", "explicit moderator", "status moderator"])(
    "offers the same section tasks to a server-authorised %s",
    async (role) => {
      mockGlobalAdmin = role === "admin";
      start();
      expect(
        await screen.findByRole("link", { name: /Manage Events/ }),
      ).toHaveAttribute("href", "/sections/one/manage/events");
      expect(
        screen.getByRole("link", { name: /Manage Files/ }),
      ).toHaveAttribute("href", "/sections/one/manage/files");
      expect(screen.queryByText("Edit Section")).not.toBeInTheDocument();
    },
  );
  it("accepts hyphenated uppercase URLs when metadata serialises UUIDs compactly", async () => {
    const sid = "AABBCCDD-1111-4222-8333-ABCDEF123456";
    lookup.mockResolvedValue({
      section: {
        id: sid.replaceAll("-", "").toLowerCase(),
        name: "Mixed format section",
        type: "EVENTS",
      } as never,
      hasAccess: true,
      canModerate: true,
    });
    start(`/sections/${sid}/manage`);
    expect(
      await screen.findByRole("heading", {
        name: "Administer — Mixed format section",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Events/ })).toHaveAttribute(
      "href",
      `/sections/${sid.toLowerCase()}/manage/events`,
    );
  });
});
