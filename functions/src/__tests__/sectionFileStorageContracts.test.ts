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

  it("documents gcloud's standardized bucket verification fields", () => {
    const docs = readRepoFile("docs/operations/section-file-storage.md");

    expect(docs).toContain("uniform_bucket_level_access");
    expect(docs).toContain("public_access_prevention");
    expect(docs).toContain("lifecycle_config");
    expect(docs).toContain("cors_config");
    expect(docs).toContain("--raw");
    expect(docs).toContain("--format=\"yaml(iamConfiguration)\"");
  });

  it("documents exact runtime object and signed-URL IAM requirements", () => {
    const docs = readRepoFile("docs/operations/section-file-storage.md");
    const prod = readRepoFile("docs/operations/new-production-instance.md");

    for (const marker of [
      "roles/storage.objectAdmin",
      "iamcredentials.googleapis.com",
      "roles/iam.serviceAccountTokenCreator",
      "iam.serviceAccounts.signBlob",
      "serviceConfig.serviceAccountEmail",
    ]) {
      expect(docs).toContain(marker);
    }
    expect(prod).toContain("roles/storage.objectAdmin");
    expect(prod).toContain("roles/iam.serviceAccountTokenCreator");
    expect(prod).toContain("IAM Credentials API is enabled");
    expect(prod).toContain("gcloud functions describe requestSectionFileUpload");
    expect(prod).toContain("gcloud storage buckets add-iam-policy-binding");
    expect(prod).toContain("gcloud services enable iamcredentials.googleapis.com");
    expect(prod).toContain("gcloud iam service-accounts add-iam-policy-binding");
    expect(prod).toContain("gcloud storage buckets get-iam-policy");
    expect(prod).toContain("gcloud iam service-accounts get-iam-policy");
  });
});
