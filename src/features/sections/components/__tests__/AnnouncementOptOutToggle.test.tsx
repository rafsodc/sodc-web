import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import AnnouncementOptOutToggle from "../AnnouncementOptOutToggle";

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@dataconnect/generated/react", () => ({
  useGetSectionAnnouncementOptOut: vi.fn(),
  useOptOutSectionAnnouncement: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
  })),
  useOptInSectionAnnouncement: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
  })),
}));

import * as generated from "@dataconnect/generated/react";

describe("AnnouncementOptOutToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it("renders nothing while loading", () => {
    vi.mocked(generated.useGetSectionAnnouncementOptOut).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    const { container } = render(<AnnouncementOptOutToggle sectionId="s1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers to turn emails off when not opted out", () => {
    vi.mocked(generated.useGetSectionAnnouncementOptOut).mockReturnValue({
      data: { sectionAnnouncementOptOut: null },
      isLoading: false,
    } as never);

    render(<AnnouncementOptOutToggle sectionId="s1" />);
    expect(screen.getByRole("button", { name: "Turn Off Emails" })).toBeInTheDocument();
  });

  it("offers to turn emails on when opted out", () => {
    vi.mocked(generated.useGetSectionAnnouncementOptOut).mockReturnValue({
      data: { sectionAnnouncementOptOut: { createdAt: "2026-01-01T00:00:00Z" } },
      isLoading: false,
    } as never);

    render(<AnnouncementOptOutToggle sectionId="s1" />);
    expect(screen.getByRole("button", { name: "Turn On Emails" })).toBeInTheDocument();
  });

  it("calls opt-out mutation when turning off and shows snackbar", async () => {
    const user = userEvent.setup();
    vi.mocked(generated.useGetSectionAnnouncementOptOut).mockReturnValue({
      data: { sectionAnnouncementOptOut: null },
      isLoading: false,
    } as never);
    vi.mocked(generated.useOptOutSectionAnnouncement).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as never);

    render(<AnnouncementOptOutToggle sectionId="s1" />);

    await user.click(screen.getByRole("button", { name: "Turn Off Emails" }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ sectionId: "s1" });
    });
    expect(
      screen.getByText("You will no longer receive announcements from this section")
    ).toBeInTheDocument();

    // clicking outside closes the snackbar via clickaway
    await user.click(document.body);
    await waitFor(() => {
      expect(
        screen.queryByText("You will no longer receive announcements from this section")
      ).not.toBeInTheDocument();
    });
  });

  it("calls opt-in mutation when turning on and shows snackbar", async () => {
    const user = userEvent.setup();
    vi.mocked(generated.useGetSectionAnnouncementOptOut).mockReturnValue({
      data: { sectionAnnouncementOptOut: { createdAt: "2026-01-01T00:00:00Z" } },
      isLoading: false,
    } as never);
    vi.mocked(generated.useOptInSectionAnnouncement).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as never);

    render(<AnnouncementOptOutToggle sectionId="s1" />);

    await user.click(screen.getByRole("button", { name: "Turn On Emails" }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ sectionId: "s1" });
    });
    expect(
      screen.getByText("You will now receive announcements from this section")
    ).toBeInTheDocument();
  });

  it("reverts optimistic state on mutation error", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue(new Error("Network error"));
    vi.mocked(generated.useGetSectionAnnouncementOptOut).mockReturnValue({
      data: { sectionAnnouncementOptOut: null },
      isLoading: false,
    } as never);
    vi.mocked(generated.useOptOutSectionAnnouncement).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as never);

    render(<AnnouncementOptOutToggle sectionId="s1" />);
    const toggle = screen.getByRole("button", { name: "Turn Off Emails" });

    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Turn Off Emails" })).toBeInTheDocument();
    });
  });
});
