#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const AUTHORIZATION_MIGRATION_ID = "current-authorization/v1";

/** One-time project/epoch receipt; normal deployment preflight still binds the exact release SHA. */
export async function verifyAuthorizationMigration(repositoryRoot, {projectId, gitSha}, isAncestor = (ancestor, descendant) => {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {cwd: repositoryRoot, stdio: "ignore"});
  return !result.error && result.status === 0;
}) {
  const target = path.join(repositoryRoot, ".firebase", "authorization-migration", `${projectId}.json`);
  let record;
  try {record = JSON.parse(await readFile(target, "utf8"));} catch { /* Reject missing/malformed attestations below. */ }
  if (record?.schemaVersion !== "sodc-authorization-migration/v1" || record.migrationId !== AUTHORIZATION_MIGRATION_ID || record.projectId !== projectId ||
      typeof record.gitSha !== "string" || !/^[a-f0-9]{40}$/.test(record.gitSha) || !isAncestor(record.gitSha, gitSha) ||
      record.backfillComplete !== true || record.strictApiReady !== true || typeof record.reviewedBy !== "string" || !record.reviewedBy.trim() ||
      typeof record.evidence !== "string" || !record.evidence.trim()) {
    throw new Error(`Current authorization migration is not attested for ${projectId} in the ancestry of ${gitSha}. Normal one-shot deployment is unsafe before backfill. Follow docs/operations/current-authorization.md.`);
  }
  return record;
}
