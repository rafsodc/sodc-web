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

  it("defines immutable audits, enforceable quotas, and stale-state reconciliation", () => {
    const schema = readRepoFile("dataconnect/schema/schema.gql");
    const operations = readRepoFile("dataconnect/api/admin-mutations.gql");
    const api = readRepoFile("functions/src/sectionFiles.ts");
    const reconciliation = readRepoFile("functions/src/sectionFileReconciliation.ts");

    expect(schema).toContain("type SectionFileAudit @table");
    expect(extractOperationBlock(operations, "RecordSectionFileAudit")).toContain(
      "@auth(level: NO_ACCESS)",
    );
    expect(extractOperationBlock(operations, "AbandonPendingSectionFile")).toContain(
      "updatedAt: { lt: $updatedBefore }",
    );
    expect(api).toContain("MAX_SECTION_FILE_COUNT = 200");
    expect(api).toContain("MAX_SECTION_FILE_TOTAL_BYTES = 500 * 1024 * 1024");
    expect(api).toContain("await enforceSectionQuota(");
    expect(api).toContain("await recordSectionFileAudit(");
    expect(reconciliation).toContain("schedule: \"every 30 minutes\"");
    expect(reconciliation).toContain("maxInstances: 1");
    expect(reconciliation).toContain("SectionFileStatus.PENDING");
    expect(reconciliation).toContain("SectionFileStatus.REPLACING");
    expect(reconciliation).toContain("SectionFileStatus.DELETING");
  });

  it("documents fail-closed scale-to-zero scanning and release sign-off", () => {
    const docs = readRepoFile("docs/operations/section-file-storage.md");
    expect(docs).toContain("--no-allow-unauthenticated");
    expect(docs).toContain("--min=0");
    expect(docs).toContain("roles/run.invoker");
    expect(docs).toContain("EICAR");
    expect(docs).toContain("Data Connect → Functions → Hosting");
  });

  it("bounds scanner metadata and object download requests", () => {
    const scanner = readRepoFile("services/section-file-malware-scanner/server.js");

    expect(scanner).toContain("metadataTimeoutMs = 5_000");
    expect(scanner).toContain("objectDownloadTimeoutMs = 60_000");
    expect(scanner).toContain("AbortSignal.timeout(metadataTimeoutMs)");
    expect(scanner).toContain("AbortSignal.timeout(objectDownloadTimeoutMs)");
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
