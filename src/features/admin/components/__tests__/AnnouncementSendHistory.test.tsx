import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import AnnouncementSendHistory from "../AnnouncementSendHistory";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getAnnouncementSendHistory: vi.fn(),
  getAnnouncementSendRecipients: vi.fn(),
}));

const SECTION_ID = "section-abc";

const mockSends: firebaseFunctions.AnnouncementSend[] = [
  {
    id: "send-1",
    templateUuid: "uuid-1",
    templateName: "BULK: Alpha Update",
    sectionId: SECTION_ID,
    sentBy: "user-mod",
    sentAt: "2026-07-01T10:00:00.000Z",
    recipientCount: 3,
    skippedCount: 1,
    processedCount: 3,
  },
  {
    id: "send-2",
    templateUuid: "uuid-2",
    templateName: null,
    sectionId: SECTION_ID,
    sentBy: "user-mod",
    sentAt: "2026-06-15T09:00:00.000Z",
    recipientCount: 2,
    skippedCount: 0,
    processedCount: 2,
  },
];

const mockRecipients: firebaseFunctions.AnnouncementRecipient[] = [
  {
    id: "rec-1",
    sendId: "send-1",
    userId: "user-a",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Smith",
    status: "sent",
    sentAt: "2026-07-01T10:00:05.000Z",
  },
  {
    id: "rec-2",
    sendId: "send-1",
    userId: "user-b",
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "Jones",
    status: "skipped",
    skippedReason: "opted_out",
  },
  {
    id: "rec-3",
    sendId: "send-1",
    userId: "user-c",
    email: "carol@example.com",
    firstName: "Carol",
    lastName: "Brown",
    status: "failed",
    failureReason: "GOV Notify rejected",
  },
];

describe("AnnouncementSendHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no sends exist", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue([]);

    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("No announcements have been sent yet.")).toBeInTheDocument();
    });
  });

  it("shows an error when history fails to load", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockRejectedValue(new Error("network"));

    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load send history")).toBeInTheDocument();
    });
  });

  it("renders send rows with date, template name, and counts", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);

    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("BULK: Alpha Update")).toBeInTheDocument();
    });

    // Second send has no templateName — falls back to UUID
    expect(screen.getByText("uuid-2")).toBeInTheDocument();

    // Counts visible (send-1: 3 processed, 1 skipped; send-2: 2 processed, 0 skipped)
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // skippedCount for send-1
  });

  it("expands a row and loads recipients", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue(mockRecipients);

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("BULK: Alpha Update")).toBeInTheDocument();
    });

    // Click the first row to expand
    await user.click(screen.getAllByRole("button", { name: "Expand" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Carol Brown")).toBeInTheDocument();
    expect(screen.getByText("opted_out")).toBeInTheDocument();
    expect(screen.getByText("GOV Notify rejected")).toBeInTheDocument();

    // Status chips — "Sent"/"Skipped"/"Failed" also appear as column headers, so use getAllByText
    expect(screen.getAllByText("Sent").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Skipped").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an error when recipients fail to load", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockRejectedValue(new Error("network"));

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("BULK: Alpha Update")).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "Expand" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to load recipients")).toBeInTheDocument();
    });
  });

  it("collapses an expanded row on second click", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue(mockRecipients);

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("BULK: Alpha Update")).toBeInTheDocument();
    });

    const expandBtn = screen.getAllByRole("button", { name: "Expand" })[0];
    await user.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Collapse" }));

    await waitFor(() => {
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    });
  });

  it("reloads history when refreshTrigger changes", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);

    const { rerender } = render(
      <AnnouncementSendHistory sectionId={SECTION_ID} refreshTrigger={0} />
    );

    await waitFor(() => {
      expect(screen.getByText("BULK: Alpha Update")).toBeInTheDocument();
    });

    expect(firebaseFunctions.getAnnouncementSendHistory).toHaveBeenCalledTimes(1);

    rerender(<AnnouncementSendHistory sectionId={SECTION_ID} refreshTrigger={1} />);

    await waitFor(() => {
      expect(firebaseFunctions.getAnnouncementSendHistory).toHaveBeenCalledTimes(2);
    });
  });
});
