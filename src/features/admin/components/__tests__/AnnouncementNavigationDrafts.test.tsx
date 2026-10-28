import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import * as api from "../../../../shared/utils/firebaseFunctions";
import SendAnnouncementPage from "../SendAnnouncementPage";
import TemplateEditor from "../TemplateEditor";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getAnnouncementDeliveryConfiguration: vi.fn(), getAnnouncementTemplates: vi.fn(), previewAnnouncementTemplate: vi.fn(),
  previewEventAnnouncementAudience: vi.fn(), sendSectionAnnouncement: vi.fn(),
}));
vi.mock("../AnnouncementSendHistory", () => ({ default: () => null }));
const uninstalls: Array<() => void> = [];
function signIn(uid: string) {
  const lifecycle = createSessionLifecycle(); lifecycle.observe(uid);
  uninstalls.push(installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() }));
  return lifecycle;
}
beforeEach(() => {
  vi.clearAllMocks();
  signIn("moderator-a");
  vi.mocked(api.getAnnouncementDeliveryConfiguration).mockResolvedValue({ siteDeliveryMode: "LIVE" });
  vi.mocked(api.getAnnouncementTemplates).mockResolvedValue([{ id: "template-1", name: "BULK: Section update", updatedAt: "2026-10-28", requiredPersonalisation: [] }]);
  vi.mocked(api.previewAnnouncementTemplate).mockResolvedValue({ html: "<p>Prepared content</p>", subject: "Section update" });
});
afterEach(() => { cleanup(); uninstalls.reverse().forEach(uninstall => uninstall()); uninstalls.length = 0; vi.restoreAllMocks(); });

describe("announcement drafts during navigation", () => {
  it("restores template text only for its section/event and supports explicit discard", async () => {
    const user = userEvent.setup();
    const first = render(<TemplateEditor sectionName="Signals" draftKey="section-1:event-1" />);
    await user.click(screen.getByText("Create a GOV Notify template"));
    await user.type(screen.getByLabelText("Template subject"), "Draft subject");
    await user.type(screen.getByLabelText("Template body"), "Private draft content");
    first.unmount();
    const other = render(<TemplateEditor sectionName="Signals" draftKey="section-1:event-2" />);
    expect(screen.getByLabelText("Template subject")).toHaveValue("");
    other.unmount();
    const restored = render(<TemplateEditor sectionName="Signals renamed" draftKey="section-1:event-1" />);
    expect(screen.getByLabelText("Template subject")).toBeVisible();
    expect(screen.getByLabelText("Template subject")).toHaveValue("Draft subject");
    expect(screen.getByLabelText("Template body")).toHaveValue("Private draft content");
    await user.click(screen.getByRole("button", { name: "Discard template draft" }));
    restored.unmount();
    render(<TemplateEditor sectionName="Signals" draftKey="section-1:event-1" />);
    expect(screen.getByLabelText("Template body")).toHaveValue("");
  });
  it("clears private template content on account replacement", async () => {
    const user = userEvent.setup();
    const first = render(<TemplateEditor sectionName="Signals" draftKey="section-1" />);
    await user.click(screen.getByText("Create a GOV Notify template"));
    await user.type(screen.getByLabelText("Template body"), "Member A only");
    first.unmount();
    signIn("moderator-b");
    render(<TemplateEditor sectionName="Signals" draftKey="section-1" />);
    expect(screen.getByLabelText("Template body")).toHaveValue("");
  });
  it("restores composition and the same send retry ID without resending on mount", async () => {
    const id = "00000000-0000-4000-8000-000000000505";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(id);
    vi.mocked(api.sendSectionAnnouncement).mockRejectedValueOnce(new Error("Temporary outage")).mockResolvedValueOnce({
      sendId: id, recipientCount: 2, skippedCount: 0, preparationQueued: true, resumed: true,
      requestedDeliveryMode: "SIMULATION", siteDeliveryMode: "LIVE", effectiveDeliveryMode: "SIMULATION",
    });
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(await screen.findByLabelText("Delivery mode"));
    await user.click(screen.getByRole("option", { name: /Simulation/ }));
    await user.click(screen.getByRole("button", { name: "Send to Signals members" }));
    await screen.findByRole("button", { name: "Resume announcement send" });
    first.unmount();
    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} />);
    const resume = await screen.findByRole("button", { name: "Resume announcement send" });
    await waitFor(() => expect(resume).toBeEnabled());
    expect(screen.getByLabelText("Template")).toHaveTextContent("BULK: Section update");
    expect(screen.getByLabelText("Delivery mode")).toHaveTextContent("Simulation");
    expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(1);
    await user.click(resume);
    expect(await screen.findByText(/Announcement accepted/)).toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(2);
    for (const args of vi.mocked(api.sendSectionAnnouncement).mock.calls) expect(args.slice(0, 5)).toEqual(["section-1", "template-1", id, "BULK: Section update", "SIMULATION"]);
  });
  it("keeps an explicitly different event audience separate from the earlier composition", async () => {
    const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "" };
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId: "event-1", filters }} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    first.unmount();
    const other = render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId: "event-1", filters: { ...filters, includesDinner: "YES" } }} />);
    await waitFor(() => expect(screen.getByLabelText("Template")).toBeEnabled());
    expect(screen.getByLabelText("Template")).not.toHaveTextContent("BULK: Section update");
    expect(screen.getByLabelText("Dinner")).toHaveTextContent("Yes");
    other.unmount();
    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId: "event-1", filters }} />);
    expect(await screen.findByLabelText("Template")).toHaveTextContent("BULK: Section update");
    expect(api.sendSectionAnnouncement).not.toHaveBeenCalled();
  });
  it("does not reuse another section's selected template", async () => {
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    first.unmount();
    render(<SendAnnouncementPage sectionId="section-2" sectionName="Other" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Template")).toBeEnabled());
    expect(screen.getByLabelText("Template")).not.toHaveTextContent("BULK: Section update");
    expect(screen.queryByRole("button", { name: "Send to Other members" })).not.toBeInTheDocument();
    expect(api.sendSectionAnnouncement).not.toHaveBeenCalled();
  });
});
