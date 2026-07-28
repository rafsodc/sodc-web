import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpsCallable } from "firebase/functions";
import {
  listSectionFiles,
  replaceSectionFile,
  requestSectionFileDownload,
} from "../firebaseFunctions/sectionFiles";

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("../../../config/firebase", () => ({
  functions: { region: "europe-west2" },
}));

describe("section file callable clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists files without exposing storage paths", async () => {
    const callable = vi.fn().mockResolvedValue({ data: { files: [] } });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);

    await expect(listSectionFiles("section-1")).resolves.toEqual([]);
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "listSectionFiles");
    expect(callable).toHaveBeenCalledWith({ sectionId: "section-1" });
  });

  it("requests a fresh download grant for the route identifiers", async () => {
    const response = {
      file: { id: "file-1" },
      downloadUrl: "https://storage.example/signed",
      expiresAt: "2026-07-26T18:00:00.000Z",
    };
    const callable = vi.fn().mockResolvedValue({ data: response });
    vi.mocked(httpsCallable).mockReturnValue(callable as never);

    await expect(requestSectionFileDownload("section-1", "file-1")).resolves.toEqual(response);
    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "requestSectionFileDownload",
    );
    expect(callable).toHaveBeenCalledWith({ sectionId: "section-1", fileId: "file-1" });
  });

  it("finalizes replacements using only trusted route identifiers", async () => {
    const requestGrant = vi.fn().mockResolvedValue({
      data: {
        fileId: "file-1",
        uploadUrl: "https://storage.example/upload",
        expiresAt: "2026-07-28T07:00:00.000Z",
        requiredHeaders: { "Content-Type": "application/pdf" },
        replacement: {
          originalFilename: "replacement.pdf",
          contentType: "application/pdf",
          sizeBytes: 9,
        },
      },
    });
    const finalize = vi.fn().mockResolvedValue({ data: { fileId: "file-1" } });
    vi.mocked(httpsCallable).mockImplementation(((_functions: unknown, name: string) => {
      if (name === "requestSectionFileReplacement") return requestGrant;
      if (name === "finalizeSectionFileReplacement") return finalize;
      throw new Error(`Unexpected callable ${name}`);
    }) as unknown as typeof httpsCallable);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const replacement = new File(["%PDF-new"], "replacement.pdf", {
      type: "application/pdf",
    });

    await replaceSectionFile("section-1", "file-1", replacement);

    expect(finalize).toHaveBeenCalledWith({ sectionId: "section-1", fileId: "file-1" });
  });
});
