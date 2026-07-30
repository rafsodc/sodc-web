import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), "..", relativePath), "utf8");
}

function operationBlock(source: string, name: string): string {
  const start = source.indexOf(`${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const nextOperation = source.indexOf("\nmutation ", start + 1);
  const nextQuery = source.indexOf("\nquery ", start + 1);
  const candidates = [nextOperation, nextQuery].filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

describe("legacy migration Data Connect contracts", () => {
  const schema = readRepoFile("dataconnect/schema/schema.gql");
  const operations = readRepoFile("dataconnect/api/admin-mutations.gql");

  it("stores the approved profile and global announcement fields", () => {
    expect(schema).toContain("mobileNumber: String");
    expect(schema).toContain("postNominals: String");
    expect(schema).toContain("announcementOptOutAll: Boolean! @default(value: false)");
    expect(schema).toContain("profileReviewedAt: Timestamp");
  });

  it("retains legacy identifiers as provenance without password material", () => {
    const start = schema.indexOf("type LegacyUserIdentity");
    const end = schema.indexOf("\n}", start);
    const identity = schema.slice(start, end + 2);

    expect(identity).toContain("@table(key: [\"sourceSystem\", \"legacyUserId\"])");
    expect(identity).toContain("@unique(fields: [\"user\"])");
    expect(identity).toContain("legacyUserId: UUID!");
    expect(identity).toContain("oldUid: Int");
    expect(identity).toContain("migrationBatchId: UUID!");
    expect(identity).not.toContain("password");
  });

  it("creates new migrated profiles transactionally without upserting existing profiles", () => {
    const create = operationBlock(operations, "CreateMigratedUserProfileAndIdentity");

    expect(create).toContain("@auth(level: NO_ACCESS) @transaction");
    expect(create).toContain("user_insert(");
    expect(create).not.toContain("user_upsert(");
    expect(create).toContain("legacyUserIdentity_insert(");
    expect(create).toContain("$oldUid: Int");
    expect(create).toContain("oldUid: $oldUid");
    expect(create).toContain("profileReviewedAt: null");
    expect(create).not.toContain("passwordHash");
  });

  it("links reconciled existing profiles without updating them", () => {
    const link = operationBlock(operations, "LinkLegacyIdentityToExistingUser");

    expect(link).toContain("@auth(level: NO_ACCESS)");
    expect(link).toContain("legacyUserIdentity_insert(");
    expect(link).toContain("$oldUid: Int");
    expect(link).toContain("oldUid: $oldUid");
    expect(link).not.toContain("user_update(");
    expect(link).not.toContain("user_upsert(");
  });
});
