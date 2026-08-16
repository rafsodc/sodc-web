import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import AnnouncementSendHistory from "../AnnouncementSendHistory";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  getAnnouncementSendHistory: vi.fn(),
  getAnnouncementSendRecipients: vi.fn(),
  retryAnnouncementPreparation: vi.fn(),
}));

const SECTION_ID = "section-abc";
const LIVE_SEND_MODES = {
  requestedDeliveryMode: "LIVE",
  siteDeliveryMode: "LIVE",
  effectiveDeliveryMode: "LIVE",
} as const;

const mockSends: firebaseFunctions.AnnouncementSend[] = [
  {
    ...LIVE_SEND_MODES,
    id: "send-1",
    templateUuid: "uuid-1",
    templateName: "BULK: Alpha Update",
    sectionId: SECTION_ID,
    sentBy: "user-mod",
    sentAt: "2026-07-01T10:00:00.000Z",
    recipientCount: 3,
    skippedCount: 1,
    processedCount: 3,
    failureCount: 1,
    enqueueFailureCount: 0,
    recordedRecipientCount: 4,
    progressAvailable: true,
    preparationIncomplete: false,
  },
  {
    ...LIVE_SEND_MODES,
    id: "send-2",
    templateUuid: "uuid-2",
    templateName: null,
    sectionId: SECTION_ID,
    sentBy: "user-mod",
    sentAt: "2026-06-15T09:00:00.000Z",
    recipientCount: 2,
    skippedCount: 0,
    processedCount: 2,
    failureCount: 0,
    enqueueFailureCount: 0,
    recordedRecipientCount: 2,
    progressAvailable: true,
    preparationIncomplete: false,
  },
];

const mockRecipients: firebaseFunctions.AnnouncementRecipient[] = [
  {
    effectiveDeliveryMode: "LIVE",
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
    effectiveDeliveryMode: "LIVE",
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
    effectiveDeliveryMode: "LIVE",
    id: "rec-3",
    sendId: "send-1",
    userId: "user-c",
    email: "carol@example.com",
    firstName: "Carol",
    lastName: "Brown",
    status: "failed",
    failureReason: "Can’t send to this recipient using a team-only API key",
    failureCategory: "notify_team_only",
  },
  {
    effectiveDeliveryMode: "LIVE",
    id: "rec-4",
    sendId: "send-1",
    userId: "user-d",
    email: "dave@example.com",
    firstName: "Dave",
    lastName: "White",
    status: "delivered",
    sentAt: "2026-07-01T10:00:05.000Z",
  },
  {
    effectiveDeliveryMode: "LIVE",
    id: "rec-5",
    sendId: "send-1",
    userId: "user-e",
    email: "eve@example.com",
    firstName: "Eve",
    lastName: "Black",
    status: "bounced",
    sentAt: "2026-07-01T10:00:05.000Z",
    failureReason: "GOV Notify reported permanent-failure",
  },
  {
    effectiveDeliveryMode: "LIVE",
    id: "rec-6",
    sendId: "send-1",
    userId: "user-f",
    email: "frank@example.com",
    firstName: "Frank",
    lastName: "Green",
    status: "queued",
  },
  {
    effectiveDeliveryMode: "LIVE",
    id: "rec-7",
    sendId: "send-1",
    userId: "user-g",
    email: "grace@example.com",
    firstName: "Grace",
    lastName: "Blue",
    status: "delivery_unknown",
  },
];

const mockRecipientPage: firebaseFunctions.AnnouncementRecipientPage = {
  recipients: mockRecipients,
  totalCount: mockRecipients.length,
  filteredCount: mockRecipients.length,
  initialCounts: {
    A: 0, B: 3, C: 0, D: 0, E: 0, F: 0, G: 1, H: 0, I: 0,
    J: 1, K: 0, L: 0, M: 0, N: 0, O: 0, P: 0, Q: 0, R: 0,
    S: 1, T: 0, U: 0, V: 0, W: 1, X: 0, Y: 0, Z: 0, OTHER: 0,
  },
  page: 1,
  pageSize: 50,
  pageCount: 1,
};

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
      expect(screen.getByText("We could not complete the announcement operation. Please try again.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/network/i)).not.toBeInTheDocument();
  });

  it("ignores a superseded history response", async () => {
    let resolveFirst!: (value: firebaseFunctions.AnnouncementSend[]) => void;
    let resolveSecond!: (value: firebaseFunctions.AnnouncementSend[]) => void;
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { rerender } = render(
      <AnnouncementSendHistory sectionId={SECTION_ID} refreshTrigger={0} />,
    );
    rerender(<AnnouncementSendHistory sectionId={SECTION_ID} refreshTrigger={1} />);

    resolveSecond([mockSends[1]]);
    expect(await screen.findByText("uuid-2")).toBeInTheDocument();

    resolveFirst([mockSends[0]]);
    await waitFor(() => {
      expect(screen.getByText("uuid-2")).toBeInTheDocument();
      expect(screen.queryByText("BULK: Alpha Update")).not.toBeInTheDocument();
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
    expect(screen.getAllByText("1")).toHaveLength(2); // skipped and attention counts for send-1
  });

  it("expands a row and loads recipients", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue(mockRecipientPage);

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
    expect(screen.getByText("Dave White")).toBeInTheDocument();
    expect(screen.getByText("Eve Black")).toBeInTheDocument();
    expect(screen.getByText("Frank Green")).toBeInTheDocument();
    expect(screen.getByText("Grace Blue")).toBeInTheDocument();
    expect(screen.getByText("Recipient opted out")).toBeInTheDocument();
    expect(screen.getByText("Recipient is not on the GOV.UK Notify team or guest list.")).toBeInTheDocument();
    expect(screen.getByText("Delivery failed; diagnostic detail is available in secure logs.")).toBeInTheDocument();
    expect(screen.queryByText(/team-only API key/i)).not.toBeInTheDocument();
    expect(screen.queryByText("GOV Notify reported permanent-failure")).not.toBeInTheDocument();

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getAllByText("Skipped").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Bounced")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Checking delivery")).toBeInTheDocument();
    expect(screen.getByText("Not on Notify team")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "B: 3 recipients" })).toBeEnabled();
  });

  it("uses numeric pages for All and keeps small surname-initial groups together", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockImplementation(
      async (_sendId, _sectionId, options) => ({
        ...mockRecipientPage,
        filteredCount: 51,
        pageCount: options?.initial === "B" ? 1 : 2,
        recipients: options?.initial === "B"
          ? mockRecipients.filter((recipient) => recipient.lastName.startsWith("B"))
          : mockRecipients,
      }),
    );

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);

    expect(await screen.findByLabelText("Recipient result pages")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "B: 3 recipients" }));

    await waitFor(() => expect(firebaseFunctions.getAnnouncementSendRecipients).toHaveBeenLastCalledWith(
      "send-1",
      SECTION_ID,
      expect.objectContaining({ initial: "B", page: 1 }),
    ));
    expect(screen.queryByLabelText("Recipient result pages")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–3 of 3 recipients with surname B")).toBeInTheDocument();
  });

  it("automatically loads and virtualizes a surname-initial group that exceeds the API page size", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    const smiths = Array.from({ length: 251 }, (_value, index) => ({
      ...mockRecipients[0],
      id: `smith-${index + 1}`,
      userId: `smith-user-${index + 1}`,
      email: `smith-${index + 1}@example.com`,
      firstName: `Person ${index + 1}`,
      lastName: `Smith ${index + 1}`,
    }));
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockImplementation(
      async (_sendId, _sectionId, options) => options?.initial === "S"
        ? {
            ...mockRecipientPage,
            recipients: options.page === 2 ? smiths.slice(250) : smiths.slice(0, 250),
            filteredCount: 251,
            initialCounts: { ...mockRecipientPage.initialCounts, S: 251 },
            page: options.page ?? 1,
            pageSize: 250,
            pageCount: 2,
          }
        : {
            ...mockRecipientPage,
            filteredCount: 251,
            initialCounts: { ...mockRecipientPage.initialCounts, S: 251 },
            pageCount: 6,
          },
    );

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);
    await user.click(screen.getByRole("button", { name: "S: 251 recipients" }));

    expect(await screen.findByText("Showing 1–251 of 251 recipients with surname S")).toBeInTheDocument();
    expect(screen.getByLabelText("Virtualized recipient results")).toBeInTheDocument();
    expect(screen.queryByLabelText("Recipient result pages")).not.toBeInTheDocument();
    expect(firebaseFunctions.getAnnouncementSendRecipients).toHaveBeenNthCalledWith(
      2,
      "send-1",
      SECTION_ID,
      expect.objectContaining({ initial: "S", page: 1 }),
    );
    expect(firebaseFunctions.getAnnouncementSendRecipients).toHaveBeenNthCalledWith(
      3,
      "send-1",
      SECTION_ID,
      expect.objectContaining({ initial: "S", page: 2 }),
    );
  });

  it("keeps loaded recipients and retries from a failed surname-initial chunk", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    const pageTwoRecipient = {
      ...mockRecipients[0],
      id: "rec-s-3",
      userId: "user-s-3",
      firstName: "Third",
      lastName: "Smith",
      email: "third.smith@example.com",
    };
    let pageTwoAttempts = 0;
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockImplementation(
      async (_sendId, _sectionId, options) => {
        if (options?.initial !== "S") {
          return {
            ...mockRecipientPage,
            initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
          };
        }
        if (options.page === 2) {
          pageTwoAttempts += 1;
          if (pageTwoAttempts === 1) throw new Error("temporary failure");
          return {
            ...mockRecipientPage,
            recipients: [pageTwoRecipient],
            initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
            filteredCount: 3,
            page: 2,
            pageSize: 2,
            pageCount: 2,
          };
        }
        return {
          ...mockRecipientPage,
          recipients: mockRecipients.slice(0, 2),
          initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
          filteredCount: 3,
          pageSize: 2,
          pageCount: 2,
        };
      },
    );

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);
    await user.click(screen.getByRole("button", { name: "S: 3 recipients" }));

    expect(await screen.findByText(/Loaded 2 of 3; the group is incomplete/)).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry loading remaining recipients" }));

    expect(await screen.findByText("Showing 1–3 of 3 recipients with surname S")).toBeInTheDocument();
    expect(screen.getByText("Third Smith")).toBeInTheDocument();
    expect(pageTwoAttempts).toBe(2);
  });

  it("asks for a refresh when surname-initial counts change between chunks", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockImplementation(
      async (_sendId, _sectionId, options) => options?.initial === "S" && options.page === 2
        ? {
            ...mockRecipientPage,
            recipients: [mockRecipients[2]],
            filteredCount: 4,
            initialCounts: { ...mockRecipientPage.initialCounts, S: 4 },
            page: 2,
            pageSize: 2,
            pageCount: 2,
          }
        : {
            ...mockRecipientPage,
            recipients: options?.initial === "S" ? mockRecipients.slice(0, 2) : mockRecipients,
            filteredCount: 3,
            initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
            pageSize: options?.initial === "S" ? 2 : 50,
            pageCount: options?.initial === "S" ? 2 : 1,
          },
    );

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);
    await user.click(screen.getByRole("button", { name: "S: 3 recipients" }));

    expect(await screen.findByText("Results changed while loading. Refresh to load the current group."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh group" })).toBeInTheDocument();
  });

  it("ignores a chained surname response after switching back to All", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    let resolveSecondSurnamePage!: (value: firebaseFunctions.AnnouncementRecipientPage) => void;
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockImplementation(
      async (_sendId, _sectionId, options) => {
        if (options?.initial === "S" && options.page === 2) {
          return new Promise((resolve) => { resolveSecondSurnamePage = resolve; });
        }
        if (options?.initial === "S") {
          return {
            ...mockRecipientPage,
            recipients: mockRecipients.slice(0, 2),
            filteredCount: 3,
            initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
            pageSize: 2,
            pageCount: 2,
          };
        }
        return {
          ...mockRecipientPage,
          initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
        };
      },
    );

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);
    await user.click(screen.getByRole("button", { name: "S: 3 recipients" }));
    await waitFor(() => expect(firebaseFunctions.getAnnouncementSendRecipients).toHaveBeenCalledWith(
      "send-1",
      SECTION_ID,
      expect.objectContaining({ initial: "S", page: 2 }),
    ));

    await user.click(screen.getByRole("button", { name: /^All \(/ }));
    expect(await screen.findByText(`Showing 1–${mockRecipients.length} of ${mockRecipients.length} recipients`))
      .toBeInTheDocument();

    await act(async () => {
      resolveSecondSurnamePage({
        ...mockRecipientPage,
        recipients: [{
          ...mockRecipients[0],
          id: "stale-recipient",
          firstName: "Stale",
          lastName: "Smith",
        }],
        filteredCount: 3,
        initialCounts: { ...mockRecipientPage.initialCounts, S: 3 },
        page: 2,
        pageSize: 2,
        pageCount: 2,
      });
    });

    expect(screen.queryByText("Stale Smith")).not.toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("refreshes history and any expanded recipient view", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue(mockRecipientPage);

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);
    await screen.findByText("Alice Smith");
    await user.click(screen.getByRole("button", { name: "Refresh send history" }));

    await waitFor(() => {
      expect(firebaseFunctions.getAnnouncementSendHistory).toHaveBeenCalledTimes(2);
      expect(firebaseFunctions.getAnnouncementSendRecipients).toHaveBeenCalledTimes(2);
    });
  });

  it("distinguishes a send with no recorded recipients from an empty filter result", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue({
      ...mockRecipientPage,
      recipients: [],
      totalCount: 0,
      filteredCount: 0,
      initialCounts: Object.fromEntries(
        [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "OTHER"].map((initial) => [initial, 0]),
      ),
    });

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);

    expect(await screen.findByText("No recipients recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows unavailable progress rather than a false zero", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue([{
      ...mockSends[0],
      processedCount: null,
      failureCount: null,
      enqueueFailureCount: null,
      recordedRecipientCount: null,
      progressAvailable: false,
    }]);

    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);

    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("queues a new preparation generation for an incomplete send", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue([{
      ...mockSends[0],
      enqueueFailureCount: 1,
      recordedRecipientCount: 3,
      preparationIncomplete: true,
    }]);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue(mockRecipientPage);
    vi.mocked(firebaseFunctions.retryAnnouncementPreparation).mockResolvedValue();

    const user = userEvent.setup();
    render(<AnnouncementSendHistory sectionId={SECTION_ID} />);
    await user.click((await screen.findAllByRole("button", { name: "Expand" }))[0]);
    await user.click(await screen.findByRole("button", { name: "Retry preparation" }));

    await waitFor(() => expect(firebaseFunctions.retryAnnouncementPreparation).toHaveBeenCalledWith(
      "send-1",
      SECTION_ID,
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ));
    expect(await screen.findByText("Preparation retry queued. Refresh shortly to see progress."))
      .toBeInTheDocument();
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
      expect(screen.getByText("We could not complete the announcement operation. Please try again.")).toBeInTheDocument();
    });
    expect(screen.queryByText(/network/i)).not.toBeInTheDocument();
  });

  it("collapses an expanded row on second click", async () => {
    vi.mocked(firebaseFunctions.getAnnouncementSendHistory).mockResolvedValue(mockSends);
    vi.mocked(firebaseFunctions.getAnnouncementSendRecipients).mockResolvedValue(mockRecipientPage);

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
