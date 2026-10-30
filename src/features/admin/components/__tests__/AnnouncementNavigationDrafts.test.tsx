import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
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
  const uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
  uninstalls.push(() => { lifecycle.retire(); uninstall(); });
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
    fireEvent.change(screen.getByLabelText("Template subject"), { target: { value: "Draft subject" } });
    fireEvent.change(screen.getByLabelText("Template body"), { target: { value: "Private draft content" } });
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
  }, 20_000);
  it("clears private template content on account replacement", async () => {
    const user = userEvent.setup();
    const first = render(<TemplateEditor sectionName="Signals" draftKey="section-1" />);
    await user.click(screen.getByText("Create a GOV Notify template"));
    fireEvent.change(screen.getByLabelText("Template body"), { target: { value: "Member A only" } });
    first.unmount();
    signIn("moderator-b");
    render(<TemplateEditor sectionName="Signals" draftKey="section-1" />);
    expect(screen.getByLabelText("Template body")).toHaveValue("");
  }, 20_000);
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
  }, 20_000);
  it("restores an embedded event draft and uncertain send without creating a new request", async () => {
    const requestId = "00000000-0000-4000-8000-000000000599";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "MEMBER", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "" };
    vi.mocked(api.previewEventAnnouncementAudience).mockResolvedValue({ eventTitle: "Annual Dinner", fingerprint: "embedded-audience", matchedTicketCount: 1, recipients: [{ name: "Jane Smith", email: "jane@example.com" }], skipped: [] });
    vi.mocked(api.sendSectionAnnouncement).mockRejectedValueOnce(new Error("Response lost"));
    const user = userEvent.setup();
    const props = { sectionId: "section-1", sectionName: "Signals", onBack: vi.fn(), embedded: true, eventAudience: { eventId: "event-1", filters } };
    const first = render(<SendAnnouncementPage {...props} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await user.click(await screen.findByRole("button", { name: "Send to 1 attendee contacts" }));
    await screen.findByRole("button", { name: "Resume announcement send" });
    first.unmount();
    render(<SendAnnouncementPage {...props} />);
    const resume = await screen.findByRole("button", { name: "Resume announcement send" });
    await waitFor(() => expect(resume).toBeEnabled());
    expect(screen.getByText(/existing send request/)).toBeVisible();
    expect(screen.getByLabelText("Template")).toHaveTextContent("BULK: Section update");
    expect(screen.queryByRole("button", { name: "New announcement" })).not.toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(1);
    expect(api.sendSectionAnnouncement).toHaveBeenCalledWith("section-1", "template-1", requestId, "BULK: Section update", "LIVE", undefined, { eventAudience: { eventId: "event-1", filters }, audienceFingerprint: "embedded-audience" });
  }, 20_000);
  it("retains an uncertain member send and its accepted acknowledgement across equivalent section ID spellings", async () => {
    const sectionId = "aabbccdd-1111-4222-8333-abcdef123456";
    const compactId = sectionId.replaceAll("-", "");
    const requestId = "00000000-0000-4000-8000-000000000506";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    vi.mocked(api.sendSectionAnnouncement).mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce({
      sendId: requestId, recipientCount: 2, skippedCount: 0, preparationQueued: true, resumed: true,
      requestedDeliveryMode: "LIVE", siteDeliveryMode: "LIVE", effectiveDeliveryMode: "LIVE",
    });
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage sectionId={compactId} sectionName="Signals" onBack={vi.fn()} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(screen.getByRole("button", { name: "Send to Signals members" }));
    await screen.findByRole("button", { name: "Resume announcement send" });
    first.unmount();

    for (const equivalentId of [sectionId, sectionId.toUpperCase()]) {
      const returning = render(<SendAnnouncementPage sectionId={equivalentId} sectionName="Signals" onBack={vi.fn()} />);
      const resume = await screen.findByRole("button", { name: "Resume announcement send" });
      await waitFor(() => expect(resume).toBeEnabled());
      expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(1);
      returning.unmount();
    }
    const retry = render(<SendAnnouncementPage sectionId={sectionId} sectionName="Signals" onBack={vi.fn()} />);
    const resume = await screen.findByRole("button", { name: "Resume announcement send" });
    await waitFor(() => expect(resume).toBeEnabled());
    await user.click(resume);
    expect(await screen.findByText(/Announcement accepted/)).toBeInTheDocument();
    retry.unmount();

    for (const equivalentId of [compactId, sectionId.toUpperCase()]) {
      const acknowledged = render(<SendAnnouncementPage sectionId={equivalentId} sectionName="Signals" onBack={vi.fn()} />);
      expect(await screen.findByText(/Announcement accepted/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Resume announcement send" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Send to Signals members" })).not.toBeInTheDocument();
      expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(2);
      acknowledged.unmount();
    }
    expect(api.sendSectionAnnouncement).toHaveBeenNthCalledWith(1, compactId, "template-1", requestId, "BULK: Section update", "LIVE");
    expect(api.sendSectionAnnouncement).toHaveBeenNthCalledWith(2, sectionId, "template-1", requestId, "BULK: Section update", "LIVE");
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
  }, 20_000);

  it.each(["section", "event"] as const)("keeps the event retry identity, accepted acknowledgement and template draft when only the %s ID spelling changes", async (resource) => {
    const sectionId = "aabbccdd-1111-4222-8333-abcdef123456";
    const eventId = "eeff0011-2222-4333-8444-abcdef654321";
    const requestId = "00000000-0000-4000-8000-000000000507";
    const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "" };
    const props = (spelling: "compact" | "hyphenated" | "uppercase") => {
      const varied = resource === "section" ? sectionId : eventId;
      const formatted = spelling === "compact" ? varied.replaceAll("-", "") : spelling === "uppercase" ? varied.toUpperCase() : varied;
      return { sectionId: resource === "section" ? formatted : sectionId, sectionName: "Signals", onBack: vi.fn(), eventAudience: { eventId: resource === "event" ? formatted : eventId, filters } };
    };
    vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    vi.mocked(api.previewEventAnnouncementAudience).mockResolvedValue({
      eventTitle: "Annual dinner", fingerprint: "audience-1", matchedTicketCount: 1,
      recipients: [{ name: "Jane Smith", email: "jane@example.invalid" }], skipped: [],
    });
    vi.mocked(api.sendSectionAnnouncement).mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce({
      sendId: requestId, recipientCount: 1, skippedCount: 0, preparationQueued: true, resumed: true,
      requestedDeliveryMode: "LIVE", siteDeliveryMode: "LIVE", effectiveDeliveryMode: "LIVE",
    });
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage {...props("compact")} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(screen.getByText("Create a GOV Notify template"));
    fireEvent.change(screen.getByLabelText("Template body"), { target: { value: "Unsent event template" } });
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await user.click(await screen.findByRole("button", { name: "Send to 1 attendee contacts" }));
    await screen.findByRole("button", { name: "Resume announcement send" });

    first.unmount();
    const distinctResource = props("hyphenated");
    if (resource === "section") distinctResource.sectionId = "aabbccdd-1111-4222-8333-abcdef123457";
    else distinctResource.eventAudience.eventId = "eeff0011-2222-4333-8444-abcdef654322";
    const other = render(<SendAnnouncementPage {...distinctResource} />);
    await waitFor(() => expect(screen.getByLabelText("Template")).toBeEnabled());
    expect(screen.getByLabelText("Template")).not.toHaveTextContent("BULK: Section update");
    expect(screen.getByLabelText("Template body")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Resume announcement send" })).not.toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(1);
    other.unmount();
    for (const spelling of ["compact", "hyphenated"] as const) {
      const returning = render(<SendAnnouncementPage {...props(spelling)} />);
      const resume = await screen.findByRole("button", { name: "Resume announcement send" });
      await waitFor(() => expect(resume).toBeEnabled());
      expect(screen.getByLabelText("Template body")).toHaveValue("Unsent event template");
      expect(screen.queryByLabelText("Recipient preview")).not.toBeInTheDocument();
      expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(1);
      returning.unmount();
    }
    const retry = render(<SendAnnouncementPage {...props("uppercase")} />);
    const resume = await screen.findByRole("button", { name: "Resume announcement send" });
    await waitFor(() => expect(resume).toBeEnabled());
    await user.click(resume);
    expect(await screen.findByText(/Announcement accepted/)).toBeInTheDocument();
    retry.unmount();

    for (const spelling of ["compact", "hyphenated", "uppercase"] as const) {
      const acknowledged = render(<SendAnnouncementPage {...props(spelling)} />);
      expect(await screen.findByText(/Announcement accepted/)).toBeInTheDocument();
      expect(screen.getByLabelText("Template body")).toHaveValue("Unsent event template");
      expect(screen.queryByRole("button", { name: "Resume announcement send" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Send to .*attendee contacts/ })).not.toBeInTheDocument();
      expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(2);
      acknowledged.unmount();
    }
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
    for (const [index, spelling] of ["compact", "uppercase"].entries()) {
      const submitted = props(spelling as "compact" | "uppercase");
      expect(api.sendSectionAnnouncement).toHaveBeenNthCalledWith(index + 1, submitted.sectionId, "template-1", requestId, "BULK: Section update", "LIVE", undefined,
        { eventAudience: { eventId: submitted.eventAudience.eventId, filters }, audienceFingerprint: "audience-1" });
    }
  }, 20_000);

  it("requires a fresh audience preview if an uncertain uncommitted event retry reports that the audience changed", async () => {
    const sectionId = "aabbccdd-1111-4222-8333-abcdef123456";
    const eventId = "eeff0011-2222-4333-8444-abcdef654321";
    const firstRequestId = "00000000-0000-4000-8000-000000000508";
    const nextRequestId = "00000000-0000-4000-8000-000000000509";
    const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "" };
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(firstRequestId).mockReturnValueOnce(nextRequestId);
    const audience = { eventTitle: "Annual dinner", fingerprint: "original-audience", matchedTicketCount: 1, recipients: [{ name: "Jane Smith", email: "jane@example.invalid" }], skipped: [] };
    vi.mocked(api.previewEventAnnouncementAudience).mockResolvedValueOnce(audience).mockResolvedValueOnce({ ...audience, fingerprint: "current-audience" });
    vi.mocked(api.sendSectionAnnouncement)
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockRejectedValueOnce({ code: "functions/failed-precondition", details: { code: "ANNOUNCEMENT_AUDIENCE_CHANGED" }, message: "Audience changed" })
      .mockResolvedValueOnce({ sendId: nextRequestId, recipientCount: 1, skippedCount: 0, preparationQueued: true, resumed: false,
        requestedDeliveryMode: "LIVE", siteDeliveryMode: "LIVE", effectiveDeliveryMode: "LIVE" });
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage sectionId={sectionId.replaceAll("-", "")} sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId: eventId.replaceAll("-", ""), filters }} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await user.click(await screen.findByRole("button", { name: "Send to 1 attendee contacts" }));
    await screen.findByRole("button", { name: "Resume announcement send" });
    first.unmount();

    render(<SendAnnouncementPage sectionId={sectionId.toUpperCase()} sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId, filters }} />);
    const resume = await screen.findByRole("button", { name: "Resume announcement send" });
    await waitFor(() => expect(resume).toBeEnabled());
    await user.click(resume);
    expect(await screen.findByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview recipients" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Resume announcement send" })).not.toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(2);
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
    for (const args of vi.mocked(api.sendSectionAnnouncement).mock.calls) {
      expect(args[2]).toBe(firstRequestId);
      expect(args[6]).toEqual({ eventAudience: { eventId: expect.any(String), filters }, audienceFingerprint: "original-audience" });
    }
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await user.click(await screen.findByRole("button", { name: "Send to 1 attendee contacts" }));
    expect(await screen.findByText(/Announcement accepted/)).toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenNthCalledWith(3, sectionId.toUpperCase(), "template-1", nextRequestId, "BULK: Section update", "LIVE", undefined,
      { eventAudience: { eventId, filters }, audienceFingerprint: "current-audience" });
  }, 20_000);

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
  }, 20_000);
  it("separates a legacy guest-attendee send draft from the BOOKERS composition and preserves the original draft", async () => {
    const requestId = "00000000-0000-4000-8000-000000000610";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "GUEST", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "UNPAID" };
    vi.mocked(api.previewEventAnnouncementAudience).mockResolvedValue({ eventTitle: "Annual Dinner", fingerprint: "legacy-guest-audience", matchedTicketCount: 1, recipients: [{ name: "Accompanying Guest", email: "guest@example.invalid" }], skipped: [] });
    vi.mocked(api.sendSectionAnnouncement).mockRejectedValueOnce(new Error("Response lost"));
    const props = { sectionId: "section-1", sectionName: "Signals", onBack: vi.fn(), eventAudience: { eventId: "event-1", filters } };
    const user = userEvent.setup();
    const attendeeDraft = render(<SendAnnouncementPage {...props} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await user.click(await screen.findByRole("button", { name: "Send to 1 attendee contacts" }));
    await screen.findByRole("button", { name: "Resume announcement send" });
    attendeeDraft.unmount();
    const bookerDraft = render(<SendAnnouncementPage {...props} eventAudience={{ ...props.eventAudience, recipientTarget: "BOOKERS" }} />);
    await waitFor(() => expect(screen.getByLabelText("Template")).toBeEnabled());
    expect(screen.getByLabelText("Template")).not.toHaveTextContent("BULK: Section update");
    expect(screen.getByRole("heading", { name: "Booking owners" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Resume announcement send" })).not.toBeInTheDocument();
    expect(screen.queryByText("Accompanying Guest — guest@example.invalid")).not.toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledOnce();
    bookerDraft.unmount();
    render(<SendAnnouncementPage {...props} />);
    expect(await screen.findByRole("button", { name: "Resume announcement send" })).toBeEnabled();
    expect(screen.getByLabelText("Template")).toHaveTextContent("BULK: Section update");
    expect(api.sendSectionAnnouncement).toHaveBeenCalledOnce();
  }, 20_000);

  it("preserves BOOKERS target, reviewed fingerprint and request ID when resuming an uncertain send after remount", async () => {
    const requestId = "00000000-0000-4000-8000-000000000611";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "UNPAID" };
    vi.mocked(api.previewEventAnnouncementAudience).mockResolvedValue({ eventTitle: "Annual Dinner", fingerprint: "bookers-reviewed-once", recipientTarget: "BOOKERS", matchedTicketCount: 2, recipients: [{ name: "Booking Owner", email: "owner@example.invalid" }], skipped: [] });
    vi.mocked(api.sendSectionAnnouncement).mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce({
      sendId: requestId, recipientCount: 1, skippedCount: 0, preparationQueued: true, resumed: true,
      requestedDeliveryMode: "LIVE", siteDeliveryMode: "LIVE", effectiveDeliveryMode: "LIVE",
    });
    const props = { sectionId: "section-1", sectionName: "Signals", onBack: vi.fn(), embedded: true, eventAudience: { eventId: "event-1", filters, recipientTarget: "BOOKERS" as const } };
    const user = userEvent.setup();
    const first = render(<SendAnnouncementPage {...props} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await user.click(await screen.findByRole("button", { name: "Send to 1 booking owner" }));
    await screen.findByRole("button", { name: "Resume announcement send" });
    first.unmount();
    render(<SendAnnouncementPage {...props} />);
    const resume = await screen.findByRole("button", { name: "Resume announcement send" });
    await waitFor(() => expect(resume).toBeEnabled());
    expect(screen.getByRole("heading", { name: "Booking owners" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Preview recipients" })).toBeDisabled();
    expect(screen.queryByText("Booking Owner — owner@example.invalid")).not.toBeInTheDocument();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledOnce();
    await user.click(resume);
    expect(await screen.findByRole("heading", { name: "Announcement accepted" })).toBeVisible();
    expect(api.sendSectionAnnouncement).toHaveBeenCalledTimes(2);
    expect(api.previewEventAnnouncementAudience).toHaveBeenCalledOnce();
    expect(api.previewEventAnnouncementAudience).toHaveBeenCalledWith("section-1", "event-1", filters, "BOOKERS");
    for (const args of vi.mocked(api.sendSectionAnnouncement).mock.calls) expect(args).toEqual([
      "section-1", "template-1", requestId, "BULK: Section update", "LIVE", undefined,
      { eventAudience: { eventId: "event-1", filters, recipientTarget: "BOOKERS" }, audienceFingerprint: "bookers-reviewed-once" },
    ]);
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
  }, 20_000);

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
  }, 20_000);
});
