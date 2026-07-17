import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CALLABLE_RATE_LIMITS } from "../rateLimiter";

const repoRoot = path.resolve(process.cwd(), "..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("rate limiter persistence contracts", () => {
  it("uses a per-window primary key for independently serializable buckets", () => {
    const schema = readRepoFile("dataconnect/schema/schema.gql");
    expect(schema).toContain(
      "type CallableRateLimitBucket @table(key: [\"userId\", \"functionName\", \"windowStart\"])"
    );
    expect(schema).toContain("count: Int! @default(value: 0)");
  });

  it("atomically increments, checks, and cleans counters in one transaction", () => {
    const operations = readRepoFile("dataconnect/api/admin-mutations.gql");
    const start = operations.indexOf("mutation ConsumeCallableRateLimit(");
    expect(start).toBeGreaterThanOrEqual(0);
    const operation = operations.slice(start);

    expect(operation).toContain("@auth(level: NO_ACCESS) @transaction");
    expect(operation).toContain("callableRateLimitBucket_updateMany(");
    expect(operation).toContain("count: { lt: $limit }");
    expect(operation).toContain("data: { count_update: { inc: 1 } }");
    expect(operation).toContain(
      "@check(expr: \"this == 1\", message: \"RATE_LIMIT_EXCEEDED\")"
    );
    expect(operation).toContain("callableRateLimitBucket_deleteMany(");
    expect(operation).toContain("windowStart: { lt: $windowStart }");
  });

  it("defines valid limits and windows in one canonical policy map", () => {
    expect(Object.keys(CALLABLE_RATE_LIMITS).length).toBeGreaterThan(0);
    for (const policy of Object.values(CALLABLE_RATE_LIMITS)) {
      expect(policy.limit).toBeGreaterThan(0);
      expect(policy.windowMs).toBeGreaterThan(0);
    }
  });

  it("documents a risk classification for every callable and every rate-limited policy", () => {
    const docs = readRepoFile("docs/architecture/callable-abuse-protection.md");
    const functionFiles = fs
      .readdirSync(path.join(repoRoot, "functions/src"))
      .filter((fileName) => fileName.endsWith(".ts"));
    const callableNames = functionFiles.flatMap((fileName) => {
      const source = readRepoFile(`functions/src/${fileName}`);
      return [...source.matchAll(/export const (\w+) = onCall(?:<[^>]+>)?\s*\(/g)].map(
        (match) => match[1]
      );
    });

    expect(callableNames.length).toBeGreaterThan(0);
    for (const callableName of callableNames) {
      expect(docs, `missing risk classification for ${callableName}`).toContain(`\`${callableName}\``);
    }
    for (const policyName of Object.keys(CALLABLE_RATE_LIMITS)) {
      expect(docs, `missing documented limit for ${policyName}`).toContain(`\`${policyName}\``);
    }
  });
});
