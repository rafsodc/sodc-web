import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import SectionFilesList from "../SectionFilesList";
import {
  listSectionFiles,
  requestSectionFileDownload,
} from "../../../../shared/utils/firebaseFunctions";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  listSectionFiles: vi.fn(),
  requestSectionFileDownload: vi.fn(),
}));

describe("SectionFilesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows safe member-facing file metadata", async () => {
    vi.mocked(listSectionFiles).mockResolvedValue([
      {
        id: "file-1",
        sectionId: "section-1",
        displayName: "Joining instructions",
        originalFilename: "instructions.pdf",
        description: "Read before attending",
        contentType: "application/pdf",
        sizeBytes: 1536,
        uploadedBy: "moderator-1",
        createdAt: "2026-07-20T12:00:00.000Z",
        updatedAt: "2026-07-20T12:00:00.000Z",
        canonicalUrl: "https://members.example.org/sections/section-1/files/file-1",
      },
    ]);

    render(<SectionFilesList sectionId="section-1" />);

    expect(await screen.findByText("Joining instructions")).toBeInTheDocument();
    expect(screen.getByText(/Read before attending/)).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf/)).toBeInTheDocument();
    expect(screen.getByText(/1.5 KB/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Joining instructions" })).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    vi.mocked(listSectionFiles).mockResolvedValue([]);
    render(<SectionFilesList sectionId="section-1" />);
    expect(await screen.findByText("No files are available for this section.")).toBeInTheDocument();
  });

  it("uses a non-enumerating error and supports retry", async () => {
    vi.mocked(listSectionFiles)
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce([]);
    render(<SectionFilesList sectionId="section-1" />);

    const reload = await screen.findByRole("button", { name: "Try again" });
    reload.click();
    await waitFor(() => expect(listSectionFiles).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No files are available for this section.")).toBeInTheDocument();
  });

  it("keeps the file list visible and shows a download-specific error", async () => {
    const user = userEvent.setup();
    vi.mocked(listSectionFiles).mockResolvedValue([
      {
        id: "file-1",
        sectionId: "section-1",
        displayName: "Joining instructions",
        originalFilename: "instructions.pdf",
        description: null,
        contentType: "application/pdf",
        sizeBytes: 1536,
        uploadedBy: "moderator-1",
        createdAt: "2026-07-20T12:00:00.000Z",
        updatedAt: "2026-07-20T12:00:00.000Z",
        canonicalUrl: "https://members.example.org/sections/section-1/files/file-1",
      },
    ]);
    vi.mocked(requestSectionFileDownload).mockRejectedValue(new Error("permission denied"));
    render(<SectionFilesList sectionId="section-1" />);

    await user.click(
      await screen.findByRole("button", { name: "Download Joining instructions" }),
    );

    expect(await screen.findByText(/could not be downloaded/i)).toBeInTheDocument();
    expect(screen.getByText("Joining instructions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
