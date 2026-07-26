import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "..", relativePath), "utf8");
}

function extractOperationBlock(source: string, operationName: string): string {
  const mutationStart = source.indexOf(`mutation ${operationName}`);
  const queryStart = source.indexOf(`query ${operationName}`);
  const start = mutationStart >= 0 ? mutationStart : queryStart;
  if (start < 0) throw new Error(`Operation not found: ${operationName}`);
  const end = source.indexOf("\n}", start);
  return source.slice(start, end < 0 ? source.length : end + 2);
}

describe("section file storage foundation", () => {
  it("defines private metadata and explicit lifecycle states", () => {
    const schema = readRepoFile("dataconnect/schema/schema.gql");

    expect(schema).toContain("type SectionFile @table");
    expect(schema).toContain("section: Section!");
    expect(schema).toContain("storageObjectPath: String");
    expect(schema).toContain("pendingStorageObjectPath: String");
    expect(schema).toContain("objectGeneration: String");
    expect(schema).toContain("checksumSha256: String");

    for (const state of ["PENDING", "AVAILABLE", "REPLACING", "DELETING", "DELETED"]) {
      expect(schema).toContain(state);
    }
  });

  it("keeps every section-file operation behind the Admin SDK boundary", () => {
    const operations = readRepoFile("dataconnect/api/admin-mutations.gql");
    const names = [
      "CreatePendingSectionFile",
      "GetSectionFileById",
      "ListSectionFilesByStatus",
      "FinalizePendingSectionFile",
      "UpdateAvailableSectionFileMetadata",
      "BeginSectionFileReplacement",
      "FinalizeSectionFileReplacement",
      "AbortSectionFileReplacement",
      "BeginSectionFileDeletion",
      "MarkSectionFileDeleted",
    ];

    for (const name of names) {
      expect(extractOperationBlock(operations, name)).toContain("@auth(level: NO_ACCESS)");
    }
  });

  it("uses compare-and-swap lifecycle transitions", () => {
    const operations = readRepoFile("dataconnect/api/admin-mutations.gql");

    expect(extractOperationBlock(operations, "FinalizePendingSectionFile")).toContain(
      "status: { eq: PENDING }",
    );
    expect(extractOperationBlock(operations, "FinalizeSectionFileReplacement")).toContain(
      "status: { eq: REPLACING }",
    );
    expect(extractOperationBlock(operations, "MarkSectionFileDeleted")).toContain(
      "status: { eq: DELETING }",
    );
  });

  it("denies Firebase client access and expires only temporary uploads", () => {
    const rules = readRepoFile("storage.rules");
    const lifecycle = JSON.parse(
      readRepoFile("config/storage/section-files-lifecycle.json"),
    ) as {
      rule: Array<{ condition: { matchesPrefix: string[] } }>;
    };

    expect(rules).toContain("allow read, write: if false");
    expect(lifecycle.rule).toHaveLength(1);
    expect(lifecycle.rule[0].condition.matchesPrefix).toEqual(["section-file-uploads/"]);
  });
});
