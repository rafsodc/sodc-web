import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({request: vi.fn(), getClient: vi.fn()}));
vi.mock("google-auth-library", () => ({GoogleAuth: class {getClient = mocks.getClient;}}));
import { evaluateAccountErasureBackupHorizon, inspectAccountErasureBackupHorizon } from "../../accountErasureBackupHorizon";

const input = {projectId: "sodc-web-production", profileDeletedAt: "2026-01-01T12:00:00Z", completedAt: "2026-01-01T12:01:00Z", now: "2026-02-01T12:00:00Z"};
const fixture = () => ({
  configuration: {name: "sodc-web-instance", region: "europe-west2", state: "RUNNABLE", settings: {backupConfiguration: {backupTier: "STANDARD", pointInTimeRecoveryEnabled: true}}},
  recovery: {earliestRecoveryTime: "2026-01-25T12:00:00Z", latestRecoveryTime: "2026-02-01T11:59:00Z"},
  backups: [{type: "AUTOMATED", status: "SUCCESSFUL", startTime: "2026-01-25T12:00:00Z"}] as Array<Record<string, unknown>>,
});
beforeEach(() => {vi.resetAllMocks(); mocks.getClient.mockResolvedValue({request: mocks.request});});

it("requires an observed clear recovery horizon and a complete clear backup inventory", () => {
  expect(evaluateAccountErasureBackupHorizon(input, fixture())).toEqual({safe: true, reason: "RESTORE_HORIZON_CLEAR"});
});
it.each(["SUCCESSFUL", "ENQUEUED", "RUNNING", "OVERDUE", "DELETION_PENDING", "DELETION_FAILED"])("retains suppression for an old %s backup, including manual snapshots", status => {
  const evidence = fixture(); evidence.backups.push({type: "ON_DEMAND", status, startTime: input.profileDeletedAt});
  expect(evaluateAccountErasureBackupHorizon(input, evidence)).toEqual({safe: false, reason: "PRE_ERASURE_BACKUP_AVAILABLE"});
});
it.each(["FAILED", "SKIPPED", "DELETED"])("ignores a known non-restorable %s run", status => {
  const evidence = fixture(); evidence.backups.push({type: "ON_DEMAND", status, startTime: "2025-01-01T00:00:00Z"});
  expect(evaluateAccountErasureBackupHorizon(input, evidence).safe).toBe(true);
});
it.each(["2026-01-01T11:59:59Z", input.profileDeletedAt])("blocks recovery at or before deletion: %s", earliestRecoveryTime => {
  const evidence = fixture(); evidence.recovery.earliestRecoveryTime = earliestRecoveryTime;
  expect(evaluateAccountErasureBackupHorizon(input, evidence).reason).toBe("PRE_ERASURE_RECOVERY_AVAILABLE");
});
it("refuses disabled PITR or an unsupported backup tier rather than inferring expiry", () => {
  const evidence = fixture(); evidence.configuration.settings.backupConfiguration.pointInTimeRecoveryEnabled = false;
  expect(evaluateAccountErasureBackupHorizon(input, evidence).safe).toBe(false);
  evidence.configuration.settings.backupConfiguration.pointInTimeRecoveryEnabled = true;
  evidence.configuration.settings.backupConfiguration.backupTier = "ENHANCED";
  expect(evaluateAccountErasureBackupHorizon(input, evidence).safe).toBe(false);
});
it.each([[], [{}], [{status: "UNKNOWN"}], [{status: "SUCCESSFUL", type: "ON_DEMAND", startTime: "invalid"}], [{status: "SUCCESSFUL", type: "UNKNOWN", startTime: input.now}]])("refuses missing or ambiguous backup evidence %#", backups => {
  expect(evaluateAccountErasureBackupHorizon(input, {...fixture(), backups}).safe).toBe(false);
});
it.each([{projectId: "other-project"}, {profileDeletedAt: "bad"}, {completedAt: "2025-01-01T00:00:00Z"}, {now: "2025-01-01T00:00:00Z"}])("rejects invalid scope or timestamps before consulting provider evidence %#", override => {
  expect(evaluateAccountErasureBackupHorizon({...input, ...override}, fixture()).reason).toBe("INVALID_RETENTION_INPUT");
});
it("rejects missing, inverted and future recovery horizons", () => {
  for (const recovery of [{}, {earliestRecoveryTime: input.now, latestRecoveryTime: input.profileDeletedAt}, {earliestRecoveryTime: input.now, latestRecoveryTime: "2027-01-01T00:00:00Z"}]) {
    expect(evaluateAccountErasureBackupHorizon(input, {...fixture(), recovery}).safe).toBe(false);
  }
});
it("refuses project overrides before credential access", async () => {
  expect((await inspectAccountErasureBackupHorizon({...input, projectId: "foreign"})).safe).toBe(false);
  expect(mocks.getClient).not.toHaveBeenCalled();
});
it("follows all backup pages so an old manual snapshot on a later page blocks disposal", async () => {
  const evidence = fixture();
  mocks.request.mockImplementation(async ({url}) => ({data: url.endsWith("getLatestRecoveryTime") ? evidence.recovery : url.includes("pageToken=later") ? {kind: "sql#backupRunsList", items: [{type: "ON_DEMAND", status: "SUCCESSFUL", startTime: input.profileDeletedAt}]} : url.includes("backupRuns") ? {kind: "sql#backupRunsList", items: evidence.backups, nextPageToken: "later"} : evidence.configuration}));
  expect((await inspectAccountErasureBackupHorizon(input)).reason).toBe("PRE_ERASURE_BACKUP_AVAILABLE");
  expect(mocks.request.mock.calls).toHaveLength(4);
  for (const [request] of mocks.request.mock.calls) {
    expect(request).toMatchObject({method: "GET", timeout: 4000, retry: false, maxRedirects: 0});
    expect(request.url).toMatch(/^https:\/\/sqladmin.googleapis.com\/v1\/projects\/sodc-web-production\/instances\/sodc-web-instance/);
  }
});
it("fails closed on permission errors, repeated pagination and incomplete pages", async () => {
  mocks.getClient.mockRejectedValueOnce(new Error("denied"));
  expect((await inspectAccountErasureBackupHorizon(input)).reason).toBe("BACKUP_EVIDENCE_UNAVAILABLE");
  const evidence = fixture();
  mocks.request.mockImplementation(async ({url}) => ({data: url.endsWith("getLatestRecoveryTime") ? evidence.recovery : url.includes("backupRuns") ? {kind: "sql#backupRunsList", items: evidence.backups, nextPageToken: "repeated"} : evidence.configuration}));
  expect((await inspectAccountErasureBackupHorizon(input)).reason).toBe("BACKUP_INVENTORY_UNAVAILABLE");
  mocks.request.mockResolvedValue({data: {kind: "sql#backupRunsList"}});
  expect((await inspectAccountErasureBackupHorizon(input)).safe).toBe(false);
});
it("bounds credential discovery by the shared wall deadline", async () => {
  vi.useFakeTimers();
  try {
    mocks.getClient.mockReturnValue(new Promise(() => {}));
    const pending = inspectAccountErasureBackupHorizon(input);
    await vi.advanceTimersByTimeAsync(10000);
    expect(await pending).toEqual({safe: false, reason: "BACKUP_EVIDENCE_UNAVAILABLE"});
    expect(mocks.request).not.toHaveBeenCalled();
  } finally {vi.useRealTimers();}
});
it("never accepts a truncated ten-page inventory", async () => {
  const evidence = fixture(); let page = 0;
  mocks.request.mockImplementation(async ({url}) => ({data: url.endsWith("getLatestRecoveryTime") ? evidence.recovery : url.includes("backupRuns") ? {kind: "sql#backupRunsList", items: evidence.backups, nextPageToken: `page-${++page}`} : evidence.configuration}));
  expect((await inspectAccountErasureBackupHorizon(input)).reason).toBe("BACKUP_INVENTORY_TRUNCATED");
});
