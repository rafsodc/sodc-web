import { GoogleAuth } from "google-auth-library";

const projects = new Set(["sodc-web", "sodc-web-beta", "sodc-web-production"]);
const instance = "sodc-web-instance";
const restorableStatuses = new Set(["SUCCESSFUL", "ENQUEUED", "RUNNING", "OVERDUE", "DELETION_PENDING", "DELETION_FAILED"]);
const nonRestorableStatuses = new Set(["FAILED", "SKIPPED", "DELETED"]);

export interface AccountErasureBackupInput {projectId: string; profileDeletedAt: string; completedAt: string; now: string}
export interface AccountErasureBackupResult {safe: boolean; reason: string}
export interface AccountErasureBackupEvidence {configuration: unknown; recovery: unknown; backups: unknown[]}

function timestamp(value: unknown): number {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) ? Date.parse(value) : NaN;
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
const blocked = (reason: string): AccountErasureBackupResult => ({safe: false, reason});

/** Provider metadata is evidence of recoverability, never proof inferred from a
 * configured retention duration. Unknown tiers and incomplete lists fail closed. */
export function evaluateAccountErasureBackupHorizon(input: AccountErasureBackupInput, evidence: AccountErasureBackupEvidence): AccountErasureBackupResult {
  const deleted = timestamp(input.profileDeletedAt), completed = timestamp(input.completedAt), now = timestamp(input.now);
  if (!projects.has(input.projectId) || !Number.isFinite(deleted) || !Number.isFinite(completed) || !Number.isFinite(now) || deleted > completed || completed > now) return blocked("INVALID_RETENTION_INPUT");
  const configuration = object(evidence.configuration), recovery = object(evidence.recovery);
  const settings = object(configuration?.settings), backupConfiguration = object(settings?.backupConfiguration);
  if (configuration?.name !== instance || configuration?.region !== "europe-west2" || configuration?.state !== "RUNNABLE" ||
      backupConfiguration?.backupTier !== "STANDARD" || backupConfiguration?.pointInTimeRecoveryEnabled !== true) return blocked("BACKUP_CONFIGURATION_UNSUPPORTED");
  const earliest = timestamp(recovery?.earliestRecoveryTime), latest = timestamp(recovery?.latestRecoveryTime);
  if (!Number.isFinite(earliest) || !Number.isFinite(latest) || earliest > latest || latest > now + 60000) return blocked("RECOVERY_HORIZON_UNAVAILABLE");
  if (earliest <= deleted) return blocked("PRE_ERASURE_RECOVERY_AVAILABLE");
  if (!Array.isArray(evidence.backups) || !evidence.backups.length) return blocked("BACKUP_INVENTORY_UNAVAILABLE");
  for (const value of evidence.backups) {
    const backup = object(value);
    if (!backup || typeof backup.status !== "string") return blocked("BACKUP_INVENTORY_UNAVAILABLE");
    if (nonRestorableStatuses.has(backup.status)) continue;
    if (!restorableStatuses.has(backup.status) || typeof backup.type !== "string" || !["AUTOMATED", "ON_DEMAND"].includes(backup.type)) return blocked("BACKUP_INVENTORY_UNAVAILABLE");
    const start = timestamp(backup.startTime);
    if (!Number.isFinite(start) || start > now + 60000 || (backup.instance !== undefined && backup.instance !== instance)) return blocked("BACKUP_INVENTORY_UNAVAILABLE");
    if (start <= deleted) return blocked("PRE_ERASURE_BACKUP_AVAILABLE");
  }
  return {safe: true, reason: "RESTORE_HORIZON_CLEAR"};
}

/** Fixed project/instance, GET-only provider reads; no credentials or response
 * payloads are logged. A permission error keeps the erasure ledger in place. */
export async function inspectAccountErasureBackupHorizon(input: AccountErasureBackupInput): Promise<AccountErasureBackupResult> {
  if (!projects.has(input.projectId)) return blocked("INVALID_RETENTION_INPUT");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<AccountErasureBackupResult>(resolve => {
    timer = setTimeout(() => {controller.abort(); resolve(blocked("BACKUP_EVIDENCE_UNAVAILABLE"));}, 10000);
    timer.unref();
  });
  const inspect = async (): Promise<AccountErasureBackupResult> => {
    try {
      const client = await new GoogleAuth({scopes: ["https://www.googleapis.com/auth/sqlservice.admin"]}).getClient();
      if (controller.signal.aborted) return blocked("BACKUP_EVIDENCE_UNAVAILABLE");
      const base = `https://sqladmin.googleapis.com/v1/projects/${input.projectId}/instances/${instance}`;
      const read = async (url: string) => {
        if (controller.signal.aborted) throw new Error("RETENTION_METADATA_DEADLINE");
        return (await client.request({url, method: "GET", timeout: 4000, retry: false, maxRedirects: 0, responseType: "json", signal: controller.signal})).data;
      };
      const [configuration, recovery] = await Promise.all([read(base), read(`${base}/getLatestRecoveryTime`)]);
      const backups: unknown[] = [];
      const tokens = new Set<string>();
      let pageToken = "";
      for (let page = 0; page < 10; page++) {
        const url = new URL(`${base}/backupRuns`);
        url.searchParams.set("maxResults", "1000");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const response = object(await read(url.toString()));
        if (!response || response.kind !== "sql#backupRunsList" || !Array.isArray(response.items) || response.items.length > 1000) return blocked("BACKUP_INVENTORY_UNAVAILABLE");
        backups.push(...response.items);
        if (response.nextPageToken === undefined || response.nextPageToken === "") return evaluateAccountErasureBackupHorizon(input, {configuration, recovery, backups});
        if (typeof response.nextPageToken !== "string" || response.nextPageToken.length > 4096 || tokens.has(response.nextPageToken)) return blocked("BACKUP_INVENTORY_UNAVAILABLE");
        tokens.add(response.nextPageToken);
        pageToken = response.nextPageToken;
      }
      return blocked("BACKUP_INVENTORY_TRUNCATED");
    } catch {
      return blocked("BACKUP_EVIDENCE_UNAVAILABLE");
    }
  };
  try {return await Promise.race([inspect(), deadline]);}
  finally {clearTimeout(timer!);}
}
