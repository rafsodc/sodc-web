import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "src", "sectionFiles.ts"), "utf8");
const schema = fs.readFileSync(
  path.resolve(process.cwd(), "..", "dataconnect", "schema", "schema.gql"),
  "utf8",
);

describe("section file API security contracts", () => {
  it("does not evaluate auth.uid defaults for backend-only SectionFile writes", () => {
    const start = schema.indexOf("type SectionFile ");
    const end = schema.indexOf("\n}", start);
    const sectionFileType = schema.slice(start, end);
    expect(sectionFileType).not.toContain("@default(expr: \"auth.uid\")");
    expect(source).toContain("uploadedBy: uid");
    expect(source).toContain("updatedBy: uid");
  });

  it("returns stable application URLs built from APP_BASE_URL", () => {
    expect(source).toContain("canonicalUrl:");
    expect(source).toContain("APP_BASE_URL");
    expect(source).toContain("/sections/${file.sectionId}/files/${file.id}");
  });

  it("derives all object paths from trusted section and file identifiers", () => {
    expect(source).toContain("`section-file-uploads/${sectionId}/${fileId}/${uploadId}`");
    expect(source).toContain("`section-files/${sectionId}/${fileId}/${inspected.generation}`");
    expect(source).not.toMatch(/request\.data\?\.(?:storageObjectPath|pendingStorageObjectPath)/);
  });

  it("cross-checks file metadata against the authorized section", () => {
    expect(source).toContain("validateUUID(file.sectionId, \"stored sectionId\") !== sectionId");
    expect(source).toContain("await requireSectionAccess(sectionId, uid, isAdmin)");
    expect(source).toContain("await requireSectionModerator(sectionId, uid, isAdmin)");
  });

  it("validates stored object properties before lifecycle promotion", () => {
    expect(source).toContain("actualSize !== expected.sizeBytes");
    expect(source).toContain("actualType !== expected.contentType");
    expect(source).toContain("validateFileSignature(bytes, actualType)");
    expect(source).toContain("createHash(\"sha256\")");
    expect(source).toContain("ensureTransition(result.data.sectionFile_updateMany)");
  });

  it("uses short-lived V4 upload and download grants", () => {
    expect(source).toContain("SIGNED_UPLOAD_TTL_MS = 15 * 60 * 1000");
    expect(source).toContain("SIGNED_DOWNLOAD_TTL_MS = 5 * 60 * 1000");
    expect(source).toContain("action: \"write\"");
    expect(source).toContain("action: \"read\"");
  });

  it("provides a trusted rollback for interrupted replacements", () => {
    expect(source).toContain("export const cancelSectionFileReplacement");
    expect(source).toContain("abortSectionFileReplacement");
    expect(source).toContain("bestEffortDelete(file.pendingStorageObjectPath");
  });

  it("never includes internal object paths in member-facing file responses", () => {
    const start = source.indexOf("function fileResponse(");
    const end = source.indexOf("\n}", start);
    const responseBlock = source.slice(start, end);
    expect(responseBlock).not.toContain("storageObjectPath");
    expect(responseBlock).not.toContain("pendingStorageObjectPath");
  });
});
