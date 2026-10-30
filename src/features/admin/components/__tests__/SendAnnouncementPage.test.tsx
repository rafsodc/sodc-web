import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import SendAnnouncementPage from "../SendAnnouncementPage";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getAnnouncementDeliveryConfiguration: vi.fn(),
  getAnnouncementTemplates: vi.fn(),
  previewAnnouncementTemplate: vi.fn(),
  previewEventAnnouncementAudience: vi.fn(),
  sendSectionAnnouncement: vi.fn(),
}));
vi.mock("../TemplateEditor", () => ({ default: () => null }));
vi.mock("../AnnouncementSendHistory", () => ({ default: () => null }));

describe("SendAnnouncementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseFunctions.getAnnouncementDeliveryConfiguration).mockResolvedValue({
      siteDeliveryMode: "LIVE",
    });
    vi.mocked(firebaseFunctions.getAnnouncementTemplates).mockResolvedValue([{
      id: "template-1",
      name: "BULK: Section update",
      updatedAt: "2026-07-19T10:00:00.000Z",
      requiredPersonalisation: ["firstName", "unsubscribeUrl"],
    }]);
    vi.mocked(firebaseFunctions.previewAnnouncementTemplate).mockResolvedValue({
      html: "<p>Hello Jane</p>",
      subject: "Section update",
    });
  });

  it("acknowledges background preparation without waiting for recipient enqueueing", async () => {
    const requestId = "00000000-0000-4000-8000-000000000408";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(requestId);
    vi.mocked(firebaseFunctions.sendSectionAnnouncement).mockResolvedValue({
      sendId: requestId,
      recipientCount: 800,
      skippedCount: 2,
      preparationQueued: true,
      resumed: false,
      requestedDeliveryMode: "LIVE",
      siteDeliveryMode: "LIVE",
      effectiveDeliveryMode: "LIVE",
    });
    const user = userEvent.setup();

    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(await screen.findByRole("button", { name: "Send to Signals members" }));

    expect(await screen.findByText(/Preparing 800 emails in the background/)).toBeInTheDocument();
    expect(firebaseFunctions.sendSectionAnnouncement).toHaveBeenCalledWith(
      "section-1",
      "template-1",
      requestId,
      "BULK: Section update",
      "LIVE",
    );
  });

  it("shows and honours a restrictive site-wide mode", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementDeliveryConfiguration).mockResolvedValue({
      siteDeliveryMode: "SIMULATION",
    });

    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} />);

    expect(await screen.findByText(/Site-wide email mode is/)).toHaveTextContent("SIMULATION");
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    expect(await screen.findByLabelText("Delivery mode")).toHaveTextContent("Simulation");
  });

  it("offers only approved reply-to choices and submits the internal address ID", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementDeliveryConfiguration).mockResolvedValue({
      siteDeliveryMode: "LIVE",
      replyToOptions: [{
        id: "22222222-2222-4222-8222-222222222222",
        displayLabel: "Membership",
        emailAddress: "membership@example.org",
      }],
      defaultReplyToAddressId: null,
      replyToFallbackSource: "notify_default",
    });
    vi.mocked(firebaseFunctions.sendSectionAnnouncement).mockResolvedValue({
      sendId: "00000000-0000-4000-8000-000000000409",
      recipientCount: 2,
      skippedCount: 0,
      preparationQueued: true,
      resumed: false,
      requestedDeliveryMode: "LIVE",
      siteDeliveryMode: "LIVE",
      effectiveDeliveryMode: "LIVE",
    });
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000409",
    );
    const user = userEvent.setup();

    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Section update/ }));
    await user.click(await screen.findByLabelText("Replies go to"));
    await user.click(screen.getByRole("option", { name: /Membership — membership@example.org/ }));
    await user.click(screen.getByRole("button", { name: "Send to Signals members" }));

    await waitFor(() => expect(firebaseFunctions.sendSectionAnnouncement).toHaveBeenCalledWith(
      "section-1",
      "template-1",
      "00000000-0000-4000-8000-000000000409",
      "BULK: Section update",
      "LIVE",
      "22222222-2222-4222-8222-222222222222",
    ));
  });
});

describe("attendee audience", () => {
  const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "", ticketType: "", includesDinner: "YES", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "" };
  const preview = { eventTitle: "Annual Dinner", fingerprint: "preview-1", matchedTicketCount: 3, recipients: [{ name: "Jane Smith", email: "jane@example.com" }], skipped: [{ name: "No Email", email: "", reason: "missing_contact" }] };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseFunctions.getAnnouncementDeliveryConfiguration).mockResolvedValue({ siteDeliveryMode: "SIMULATION" });
    vi.mocked(firebaseFunctions.getAnnouncementTemplates).mockResolvedValue([{ id: "template-1", name: "BULK: Dinner", updatedAt: "2026-01-01", requiredPersonalisation: [] }]);
    vi.mocked(firebaseFunctions.previewAnnouncementTemplate).mockResolvedValue({ html: "<p>Update</p>", subject: "Dinner" });
    vi.mocked(firebaseFunctions.previewEventAnnouncementAudience).mockResolvedValue(preview);
    vi.mocked(firebaseFunctions.sendSectionAnnouncement).mockResolvedValue({ sendId: "send", recipientCount: 1, skippedCount: 1, preparationQueued: true, resumed: false, requestedDeliveryMode: "SIMULATION", siteDeliveryMode: "SIMULATION", effectiveDeliveryMode: "SIMULATION" });
  });
  async function open() {
    const user = userEvent.setup();
    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId: "event-1", filters }} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Dinner/ }));
    return user;
  }
  it("embeds communications without a second page header and keeps recipient review required", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={onBack} embedded eventAudience={{ eventId: "event-1", eventTitle: "Annual Dinner", filters }} />);
    expect(screen.getByRole("heading", { name: "Communications", level: 2 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "New announcement", level: 3 })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Dinner/ }));
    expect(screen.getByRole("heading", { name: "Draft announcement" })).toBeVisible();
    expect(screen.getByText(/draft is kept while you switch tabs/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "New announcement" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    expect(firebaseFunctions.sendSectionAnnouncement).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard announcement draft" }));
    expect(screen.getByRole("heading", { name: "New announcement" })).toBeVisible();
    expect(screen.queryByText(/draft is kept while you switch tabs/)).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });
  it("carries filters into preview and sends only the confirmed server audience", async () => {
    const user = await open();
    expect(screen.getByLabelText("Dinner")).toHaveTextContent("Yes");
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    expect(await screen.findByText(/3 matching tickets, 1 unique recipients, 1 skipped/)).toBeInTheDocument();
    expect(screen.getByText(/No Email — Missing contact/)).toBeInTheDocument();
    expect(firebaseFunctions.previewEventAnnouncementAudience).toHaveBeenCalledWith("section-1", "event-1", filters);
    await user.click(screen.getByRole("button", { name: "Send to 1 attendee contacts" }));
    expect(firebaseFunctions.sendSectionAnnouncement).toHaveBeenCalledWith("section-1", "template-1", expect.any(String), "BULK: Dinner", "SIMULATION", undefined, { eventAudience: { eventId: "event-1", filters }, audienceFingerprint: "preview-1" });
    expect(await screen.findByText(/Preparing 1 email/)).toBeInTheDocument();
  });
  it("only offers attendee templates without unsubscribe links", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementTemplates).mockResolvedValue([
      { id: "template-1", name: "BULK: Dinner", updatedAt: "2026-01-01", requiredPersonalisation: [] },
      { id: "section-template", name: "BULK: Section", updatedAt: "2026-01-01", requiredPersonalisation: ["unsubscribeUrl"] },
    ]);
    const user = await open();
    expect(screen.getByText(/regardless of announcement preferences/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Template"));
    expect(screen.queryByRole("option", { name: /BULK: Section/ })).not.toBeInTheDocument();
  });
  it("invalidates the preview after filter edits and handles preview failures and empty audiences", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await screen.findByText(/3 matching tickets/);
    await user.type(screen.getByLabelText("Attendee name"), "Jane");
    expect(screen.queryByText(/3 matching tickets/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    vi.mocked(firebaseFunctions.previewEventAnnouncementAudience).mockRejectedValueOnce(new Error("Unavailable"));
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    expect(await screen.findByText(/Unable to load recipients/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    vi.mocked(firebaseFunctions.previewEventAnnouncementAudience).mockResolvedValueOnce({ ...preview, recipients: [] });
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    expect(await screen.findByText(/No recipients can receive/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to 0 attendee contacts" })).toBeDisabled();
    expect(firebaseFunctions.sendSectionAnnouncement).not.toHaveBeenCalled();
  });
  it("requires another preview if attendees changed while composing", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await screen.findByText(/3 matching tickets/);
    vi.mocked(firebaseFunctions.sendSectionAnnouncement).mockRejectedValueOnce({ code: "functions/failed-precondition", details: { code: "ANNOUNCEMENT_AUDIENCE_CHANGED" }, message: "Audience changed" });
    await user.click(screen.getByRole("button", { name: "Send to 1 attendee contacts" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Preview recipients" })).toBeEnabled();
    expect(screen.getByText(/Click Preview recipients again, review the list, then send/)).toBeInTheDocument();
  });
  it.each([
    ["ANNOUNCEMENT_TEMPLATE_UNSUBSCRIBE", "This template contains an unsubscribe link."],
    ["ANNOUNCEMENT_REPLY_TO_UNAVAILABLE", "The selected reply-to address is no longer available."],
  ])("keeps the recipient preview when %s needs attention", async (code, message) => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    await screen.findByText(/3 matching tickets/);
    vi.mocked(firebaseFunctions.sendSectionAnnouncement).mockRejectedValueOnce({ code: "functions/failed-precondition", details: { code } });
    await user.click(screen.getByRole("button", { name: "Send to 1 attendee contacts" }));
    expect(await screen.findByText((text) => text.startsWith(message))).toBeInTheDocument();
    expect(screen.getByText(/3 matching tickets/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to 1 attendee contacts" })).toBeEnabled();
  });
});

describe("booking-owner audience", () => {
  const filters = { attendeeName: "", rank: "", membershipStatus: "", audience: "GUEST", ticketType: "", includesDinner: "", includesSymposium: "", accommodationRequested: "", approvalStatus: "", paymentState: "UNPAID" };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseFunctions.getAnnouncementDeliveryConfiguration).mockResolvedValue({ siteDeliveryMode: "SIMULATION" });
    vi.mocked(firebaseFunctions.getAnnouncementTemplates).mockResolvedValue([{ id: "template-1", name: "BULK: Dinner", updatedAt: "2026-01-01", requiredPersonalisation: [] }]);
    vi.mocked(firebaseFunctions.previewAnnouncementTemplate).mockResolvedValue({ html: "<p>Update</p>", subject: "Dinner" });
    vi.mocked(firebaseFunctions.previewEventAnnouncementAudience).mockResolvedValue({ eventTitle: "Annual Dinner", fingerprint: "reviewed-bookers", recipientTarget: "BOOKERS", matchedTicketCount: 2, recipients: [{ name: "Booking Owner", email: "owner@example.invalid" }], skipped: [] });
    vi.mocked(firebaseFunctions.sendSectionAnnouncement).mockResolvedValue({ sendId: "send", recipientCount: 1, skippedCount: 0, preparationQueued: true, resumed: false, requestedDeliveryMode: "SIMULATION", siteDeliveryMode: "SIMULATION", effectiveDeliveryMode: "SIMULATION" });
  });

  it("rejects an old backend preview without a BOOKERS acknowledgement and keeps sending blocked", async () => {
    vi.mocked(firebaseFunctions.previewEventAnnouncementAudience).mockResolvedValueOnce({
      eventTitle: "Annual Dinner", fingerprint: "legacy-attendee-preview", matchedTicketCount: 1,
      recipients: [{ name: "Accompanying Guest", email: "guest@example.invalid" }], skipped: [],
    });
    const user = userEvent.setup();
    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} eventAudience={{ eventId: "event-1", filters, recipientTarget: "BOOKERS" }} />);
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Dinner/ }));
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    expect(await screen.findByText("Booking-owner preview is not available yet. Retry after the update finishes.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    expect(screen.queryByText("Accompanying Guest — guest@example.invalid")).not.toBeInTheDocument();
    expect(firebaseFunctions.sendSectionAnnouncement).not.toHaveBeenCalled();
    // The same explicit action works once the updated backend confirms the target.
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    expect(await screen.findByRole("button", { name: "Send to 1 booking owner" })).toBeEnabled();
    expect(screen.queryByText(/Booking-owner preview is not available yet/)).not.toBeInTheDocument();
    expect(firebaseFunctions.sendSectionAnnouncement).not.toHaveBeenCalled();
  });

  it("requires owner preview and carries the immutable target through matching guest filters and send", async () => {
    const user = userEvent.setup();
    render(<SendAnnouncementPage sectionId="section-1" sectionName="Signals" onBack={vi.fn()} embedded eventAudience={{ eventId: "event-1", eventTitle: "Annual Dinner", filters, recipientTarget: "BOOKERS" }} />);
    expect(screen.getByRole("heading", { name: "Booking owners" })).toBeVisible();
    expect(screen.getByText(/Guests and organiser guests will not be emailed/)).toBeVisible();
    expect(screen.getByText(/Unpaid filter excludes partially paid tickets and payments in progress/)).toBeVisible();
    await user.click(await screen.findByLabelText("Template"));
    await user.click(screen.getByRole("option", { name: /BULK: Dinner/ }));
    expect(screen.getByRole("button", { name: "Preview recipients before sending" })).toBeDisabled();
    expect(screen.getByText(/This send is manual; no automatic payment reminder is scheduled/)).toBeVisible();
    expect(firebaseFunctions.sendSectionAnnouncement).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Preview recipients" }));
    expect(await screen.findByText(/2 matching tickets, 1 unique booking owner, 0 skipped/)).toBeVisible();
    expect(firebaseFunctions.previewEventAnnouncementAudience).toHaveBeenCalledWith("section-1", "event-1", filters, "BOOKERS");
    expect(screen.getByText("Booking Owner — owner@example.invalid")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Send to 1 booking owner" }));
    expect(firebaseFunctions.sendSectionAnnouncement).toHaveBeenCalledWith("section-1", "template-1", expect.any(String), "BULK: Dinner", "SIMULATION", undefined,
      { eventAudience: { eventId: "event-1", filters, recipientTarget: "BOOKERS" }, audienceFingerprint: "reviewed-bookers" });
    expect(await screen.findByText(/Preparing 1 email/)).toBeVisible();
  });
});
