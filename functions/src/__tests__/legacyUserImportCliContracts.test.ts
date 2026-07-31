import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cli = fs.readFileSync(
  path.resolve(process.cwd(), "scripts/legacy-user-import.ts"),
  "utf8"
);

describe("legacy user import CLI safety contracts", () => {
  it("defaults to dry-run and requires explicit apply guards", () => {
    expect(cli).toContain("apply: flags.has(\"--apply\")");
    expect(cli).toContain("if (!options.apply)");
    expect(cli).toContain("--confirm-project must exactly match");
    expect(cli).toContain("--apply requires a valid --batch-id UUID");
    expect(cli).toContain("--apply requires --state");
  });

  it("stream-decrypts with GPG and never writes plaintext", () => {
    expect(cli).toContain("spawn(\"gpg\"");
    expect(cli).toContain("\"--decrypt\"");
    expect(cli).not.toContain("[\"--batch\", \"--quiet\", \"--decrypt\"");
    expect(cli).toContain("input: child.stdout");
    expect(cli).toContain("stdio: [\"inherit\", \"pipe\", \"pipe\"]");
    expect(cli).not.toMatch(/writeFileSync\([^)]*plaintext/i);
  });

  it("requires an explicit local TTY for PII contact remediation", () => {
    expect(cli).toContain("--interactive-remediation");
    expect(cli).toContain("process.stdin.isTTY");
    expect(cli).toContain("Do not record, capture, or share this terminal");
    expect(cli).toContain("press Enter to clear it");
    expect(cli).toContain("LOST for an email-less lost member");
    expect(cli).toContain("emailLessLegacyUserIds");
    expect(cli).toContain("effectiveSourceChecksum");
  });

  it("stages new Auth users disabled and unverified in bounded batches", () => {
    expect(cli).toContain("batchesOf(pending, options.batchSize)");
    expect(cli).toContain("record.emailVerified = false");
    expect(cli).toContain("disabled: true");
    expect(cli).toContain("customClaims: { enabled: false }");
    expect(cli).toContain("algorithm: \"BCRYPT\"");
  });

  it("keeps create and link writes separate and leaves failures disabled", () => {
    expect(cli).toContain("createMigratedUserProfileAndIdentity");
    expect(cli).toContain("linkLegacyIdentityToExistingUser");
    expect(cli).toContain("partial accounts remain disabled");
    expect(cli.indexOf("await writeProfiles")).toBeLessThan(
      cli.indexOf("await reconcileAccess")
    );
  });

  it("requires an issue 420 input-bound artifact for production apply", () => {
    expect(cli).toContain("production apply requires --approval");
    expect(cli).toContain("approval.issue !== 420");
    expect(cli).toContain("approval.sourceChecksum !== sourceChecksum");
    expect(cli).toContain(
      "approval.expectedRecordCount !== recordCount"
    );
  });
});
