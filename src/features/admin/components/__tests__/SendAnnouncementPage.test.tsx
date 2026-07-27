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

  it("reuses the same request ID when retrying a partial enqueue", async () => {
    const requestId = "00000000-0000-4000-8000-000000000408";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(requestId);
    vi.mocked(firebaseFunctions.sendSectionAnnouncement)
      .mockResolvedValueOnce({
        sendId: requestId,
        queuedCount: 799,
        failedToEnqueueCount: 1,
        skippedCount: 2,
        resumed: false,
        requestedDeliveryMode: "LIVE",
        siteDeliveryMode: "LIVE",
        effectiveDeliveryMode: "LIVE",
      })
      .mockResolvedValueOnce({
        sendId: requestId,
        queuedCount: 800,
        failedToEnqueueCount: 0,
        skippedCount: 2,
        resumed: true,
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

    expect(await screen.findByText(/1 could not be queued and can be retried/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry 1 failed enqueue" }));

    expect(await screen.findByText(/This send was resumed from its original recipient list/)).toBeInTheDocument();
    expect(firebaseFunctions.sendSectionAnnouncement).toHaveBeenNthCalledWith(
      1,
      "section-1",
      "template-1",
      requestId,
      "BULK: Section update",
      "LIVE",
    );
    expect(firebaseFunctions.sendSectionAnnouncement).toHaveBeenNthCalledWith(
      2,
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
});
