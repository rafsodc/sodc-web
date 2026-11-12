import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";

it("keeps the disposal operator's no-network targeting and reviewed-write checks in CI", () => {
  const result = spawnSync(process.execPath, ["--test", path.resolve("scripts/account-erasure-disposal-admin.test.mjs")], {
    encoding: "utf8", timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});
