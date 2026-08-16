import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import SendAnnouncementPage from "../SendAnnouncementPage";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getAnnouncementDeliveryConfiguration: vi.fn(),
  getAnnouncementTemplates: vi.fn(),
  previewAnnouncementTemplate: vi.fn(),
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
      requiredPersonalisation: ["firstName"],
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
