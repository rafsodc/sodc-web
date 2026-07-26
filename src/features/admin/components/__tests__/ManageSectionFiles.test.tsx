import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import ManageSectionFiles from "../ManageSectionFiles";
import {
  deleteSectionFile,
  listSectionFiles,
  updateSectionFileMetadata,
  uploadSectionFile,
} from "../../../../shared/utils/firebaseFunctions";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  listSectionFiles: vi.fn(),
  uploadSectionFile: vi.fn(),
  replaceSectionFile: vi.fn(),
  updateSectionFileMetadata: vi.fn(),
  deleteSectionFile: vi.fn(),
}));

const file = {
  id: "file-1",
  sectionId: "section-1",
  displayName: "Joining instructions",
  originalFilename: "joining.pdf",
  description: "Read before attending",
  contentType: "application/pdf",
  sizeBytes: 1024,
  uploadedBy: "moderator-1",
  createdAt: "2026-07-20T12:00:00.000Z",
  updatedAt: "2026-07-20T12:00:00.000Z",
  canonicalUrl: "https://members.example.org/sections/section-1/files/file-1",
};

describe("ManageSectionFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSectionFiles).mockResolvedValue([file]);
    vi.mocked(updateSectionFileMetadata).mockResolvedValue();
    vi.mocked(deleteSectionFile).mockResolvedValue();
    vi.mocked(uploadSectionFile).mockResolvedValue("file-2");
  });

  it("lists files and copies only the stable application link", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ManageSectionFiles sectionId="section-1" sectionName="Test Section" onBack={vi.fn()} />);

    expect(await screen.findByText("Joining instructions")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy link for Joining instructions" }));

    expect(writeText).toHaveBeenCalledWith(file.canonicalUrl);
    expect(await screen.findByText("Stable file link copied.")).toBeInTheDocument();
  });

  it("uploads an approved file with member-facing metadata", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ManageSectionFiles sectionId="section-1" sectionName="Test Section" onBack={vi.fn()} />,
    );
    await screen.findByText("Joining instructions");
    const input = container.querySelector('input[type="file"]:not([hidden])')
      ?? container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const upload = new File(["%PDF-test"], "orders.pdf", { type: "application/pdf" });
    await user.upload(input as HTMLInputElement, upload);
    await user.clear(screen.getByLabelText(/Display name/));
    await user.type(screen.getByLabelText(/Display name/), "Orders");
    await user.type(screen.getByLabelText("Description (optional)"), "Current orders");
    await user.click(screen.getByRole("button", { name: "Upload and verify" }));

    await waitFor(() => expect(uploadSectionFile).toHaveBeenCalledWith(
      "section-1",
      upload,
      { displayName: "Orders", description: "Current orders" },
      expect.any(Function),
    ));
    expect(listSectionFiles).toHaveBeenCalledTimes(2);
  });

  it("edits member-facing metadata and refreshes", async () => {
    const user = userEvent.setup();
    render(<ManageSectionFiles sectionId="section-1" sectionName="Test Section" onBack={vi.fn()} />);
    await screen.findByText("Joining instructions");

    await user.click(screen.getByRole("button", { name: "Edit Joining instructions" }));
    const name = screen.getByLabelText("Display name");
    await user.clear(name);
    await user.type(name, "Updated instructions");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateSectionFileMetadata).toHaveBeenCalledWith(
      "section-1",
      "file-1",
      { displayName: "Updated instructions", description: "Read before attending" },
    ));
    expect(listSectionFiles).toHaveBeenCalledTimes(2);
  });

  it("requires confirmation and explains that emailed links stop working", async () => {
    const user = userEvent.setup();
    render(<ManageSectionFiles sectionId="section-1" sectionName="Test Section" onBack={vi.fn()} />);
    await screen.findByText("Joining instructions");

    await user.click(screen.getByRole("button", { name: "Delete Joining instructions" }));
    expect(screen.getByText(/emailed link will no longer work/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete file" }));

    await waitFor(() => expect(deleteSectionFile).toHaveBeenCalledWith("section-1", "file-1"));
  });

  it("shows a permission-safe error when the list cannot be loaded", async () => {
    vi.mocked(listSectionFiles).mockRejectedValue(new Error("permission-denied"));
    render(<ManageSectionFiles sectionId="section-1" sectionName="Test Section" onBack={vi.fn()} />);
    expect(await screen.findByText(/no longer have permission/i)).toBeInTheDocument();
  });
});
