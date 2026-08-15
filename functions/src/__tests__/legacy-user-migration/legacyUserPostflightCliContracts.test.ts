import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cli = fs.readFileSync(
  path.resolve(process.cwd(), "scripts/legacy-user-postflight.ts"),
  "utf8"
);

describe("legacy user postflight CLI safety contracts", () => {
  it("requires an exact declared project and production-mode agreement", () => {
    expect(cli).toContain("--confirm-project must exactly match");
    expect(cli).toContain("target project is not declared in .firebaserc");
    expect(cli).toContain("production target requires --production");
  });

  it("binds the effective source to the protected import ledger", () => {
    expect(cli).toContain("effectiveLegacySourceChecksum");
    expect(cli).toContain("readMigrationLedger(options.statePath, binding)");
    expect(cli).toContain("import ledger is not bound");
  });

  it("uses read-only snapshots and returns non-zero on mismatch", () => {
    expect(cli).toContain("listLegacyUserIdentitiesByBatch");
    expect(cli).toContain("admin.auth().getUsers");
    expect(cli).toContain("report.outcome !== \"match\"");
    expect(cli).not.toContain("updateUser(");
    expect(cli).not.toContain("importUsers(");
  });

  it("writes an optional owner-only report atomically", () => {
    expect(cli).toContain("mode: 0o600");
    expect(cli).toContain("fs.renameSync(temporaryPath, outputPath)");
  });
});
