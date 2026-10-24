import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { planNotificationRecoveryRelease } from "../../notificationRecoveryDeferral";
import { notificationRecoveryIdentity } from "../../notificationRecoveryIdentity";
import { parseNotificationRecoveryAdminArguments, runNotificationRecoveryAdmin } from "../../notificationRecoveryAdmin";

let wire: (options: any, dependencies: any) => Promise<any>;
let parse: (args: string[], env?: Record<string, string>) => any;
let run: (args: string[], dependencies: any, env?: Record<string, string>) => Promise<any>;
const key = "booking:private@example.invalid:notify-live";
const args = ["--project", "sodc-web", "--delivery-key", key, "--actor", "reviewing-operator", "--evidence-reference", "review-ticket-42"];
beforeAll(async () => {
  const tool = await import(pathToFileURL(path.resolve(__dirname, "../../../scripts/notification-recovery-admin.mjs")).href);
  wire = tool.createNotificationRecoveryAdminDependencies;
  parse = parseNotificationRecoveryAdminArguments;
  run = runNotificationRecoveryAdmin;
});
function fixture(mode: string | null = "LIVE") {
  const before = { id: "delivery-id", channel: "EMAIL", deliveryKey: key, notificationType: "BOOKING_APPROVED", status: "FAILED", attemptCount: 3,
    lastAttemptedAt: "2026-10-20T10:00:00.123456Z", recoveryPayload: "private-payload", recipientUserId: null,
    deliveryMode: mode, recoveryDeferredAt: "2026-10-20T10:20:00.000000Z", recoveryDeferredReason: "RECOVERY_DELIVERY_MODE_UNVERIFIABLE" };
  const after = { ...before, recoveryDeferredAt: null, deliveryMode: "LIVE" };
  const dependencies = { get: vi.fn().mockResolvedValue(before), release: vi.fn().mockResolvedValue(1), dispose: vi.fn(),
    plan: vi.fn((row, input) => ({schemaVersion: "sodc-notification-recovery-release/v1", variables: { id: row.id, expectedPayload: row.recoveryPayload,
      expectedLastAttemptedAt: row.lastAttemptedAt, expectedAttemptCount: row.attemptCount, expectedMode: row.deliveryMode,
      expectedDeferredAt: row.recoveryDeferredAt, actorId: input.actorId, verifiedDeliveryMode: input.verifiedMode ?? "LIVE" },
    summary: { deliveryId: row.id, status: row.status, attemptCount: row.attemptCount, deferredAt: row.recoveryDeferredAt,
      deferredReason: row.recoveryDeferredReason, verifiedMode: input.verifiedMode ?? "LIVE", fillsMissingDeliveryMode: row.deliveryMode == null,
      actorId: input.actorId, evidenceReference: input.evidenceReference, injectedSecret: "private-payload" } })) };
  return {before, after, dependencies, factory: vi.fn(async () => dependencies)};
}
const apply = (hash: string, base = args) => [...base, "--apply", "--confirm-project", "sodc-web", "--expected-plan-hash", hash];

describe("notification recovery non-sending operator gate", () => {
  it("defaults to a one-row read-only plan with an explicit project and evidence", () => {
    expect(parse(args, {})).toMatchObject({projectId: "sodc-web", channel: "EMAIL", apply: false, actorId: "reviewing-operator"});
  });
  it.each([
    [], args.slice(2), [...args, "--all"], [...args, "--project", "sodc-web-production"],
    [...args, "--channel", "SMS"], [...args, "--verified-mode", "CURRENT"], [...args, "--apply"],
    [...args, "--confirm-project", "sodc-web"], [...args, "--expected-plan-hash", "a".repeat(64)],
    [...args, "--apply", "--apply"], [...args, "--verified-mode"],
    args.map(value => value === "sodc-web" ? "other-project" : value),
    args.map(value => value === "reviewing-operator" ? "actor\nforged-log" : value),
  ])("rejects ambiguous or incomplete arguments before dependencies are loaded: %j", async input => {
    const factory = vi.fn();
    await expect(run(input, factory, {})).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
  it.each([
    {GCLOUD_PROJECT: "sodc-web-production"}, {GOOGLE_CLOUD_PROJECT: "sodc-web-beta"},
    {FIREBASE_CONFIG: "not-json"}, {FIREBASE_CONFIG: "{}"}, {FIREBASE_CONFIG: JSON.stringify({projectId: "other"})},
    {DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9398"}, {FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099"},
  ])("rejects ambient project or transport overrides: %j", env => {
    expect(() => parse(args, env)).toThrow();
  });
  it("requires an exact project confirmation for apply", () => {
    expect(() => parse([...args, "--apply", "--confirm-project", "sodc-web-production", "--expected-plan-hash", "a".repeat(64)], {})).toThrow();
  });
});

describe("reviewed-plan release orchestration", () => {
  it("never mutates during preview and returns no key, payload, recipient or internal variables", async () => {
    const f = fixture();
    const result = await run(args, f.factory, {});
    expect(result).toMatchObject({result: "PLAN", projectId: "sodc-web", deliveryId: "delivery-id"});
    expect(result.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(f.dependencies.release).not.toHaveBeenCalled(); expect(f.dependencies.dispose).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("private"); expect(result.variables).toBeUndefined();
  });
  it("re-reads and releases exactly the reviewed snapshot, then verifies history", async () => {
    const f = fixture();
    const preview = await run(args, f.factory, {});
    f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce(f.after);
    const result = await run(apply(preview.planHash), f.factory, {});
    expect(result).toMatchObject({result: "RELEASED", planHash: preview.planHash});
    expect(f.dependencies.release).toHaveBeenCalledOnce(); expect(f.dependencies.get).toHaveBeenCalledTimes(3);
  });
  it.each(["timestamp", "attempt", "project", "evidence", "actor", "verifiedMode"])("requires a new review after %s changes", async change => {
    const f = fixture();
    const preview = await run(args, f.factory, {});
    let updatedArgs = [...args];
    if (change === "timestamp") f.before.lastAttemptedAt = "2026-10-20T10:00:00.123457Z";
    if (change === "attempt") f.before.attemptCount++;
    if (change === "project") updatedArgs = updatedArgs.map(value => value === "sodc-web" ? "sodc-web-beta" : value);
    if (change === "evidence") updatedArgs = updatedArgs.map(value => value === "review-ticket-42" ? "review-ticket-43" : value);
    if (change === "actor") updatedArgs = updatedArgs.map(value => value === "reviewing-operator" ? "other-operator" : value);
    if (change === "verifiedMode") updatedArgs.push("--verified-mode", "TEAM_TEST");
    const input = [...updatedArgs, "--apply", "--confirm-project", change === "project" ? "sodc-web-beta" : "sodc-web", "--expected-plan-hash", preview.planHash];
    await expect(run(input, f.factory, {})).rejects.toThrow("RELEASE_PLAN_CHANGED");
    expect(f.dependencies.release).not.toHaveBeenCalled();
  });
  it("loses a changed database snapshot cleanly without retrying", async () => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    f.dependencies.release.mockResolvedValue(0);
    await expect(run(apply(preview.planHash), f.factory, {})).rejects.toThrow("RELEASE_SNAPSHOT_CHANGED");
    expect(f.dependencies.release).toHaveBeenCalledOnce(); expect(f.dependencies.get).toHaveBeenCalledTimes(2);
  });
  it("does not retry an uncertain release response", async () => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    f.dependencies.release.mockRejectedValue(new Error("uncertain"));
    await expect(run(apply(preview.planHash), f.factory, {})).rejects.toThrow("uncertain");
    expect(f.dependencies.release).toHaveBeenCalledOnce(); expect(f.dependencies.dispose).toHaveBeenCalledTimes(2);
  });
  it.each(["recipient", "payload", "attempt", "marker", "mode", "subject"])("does not report success if %s changes before readback", async change => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    const after: any = {...f.after};
    if (change === "recipient") after.recipientUserId = "another-recipient";
    if (change === "payload") after.recoveryPayload = "changed";
    if (change === "attempt") after.attemptCount++;
    if (change === "marker") after.recoveryDeferredAt = f.before.recoveryDeferredAt;
    if (change === "mode") after.deliveryMode = "TEAM_TEST";
    if (change === "subject") after.booking = {id: "changed-booking"};
    f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce(after);
    await expect(run(apply(preview.planHash), f.factory, {})).rejects.toThrow(/RELEASE_READBACK/);
    expect(f.dependencies.release).toHaveBeenCalledOnce();
  });
  it("supports only the planner's explicitly verified missing-mode fill", async () => {
    const f = fixture(null); const input = [...args, "--verified-mode", "LIVE"];
    const preview = await run(input, f.factory, {});
    f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce(f.after);
    expect(await run(apply(preview.planHash, input), f.factory, {})).toMatchObject({result: "RELEASED", fillsMissingDeliveryMode: true});
  });
  it("cannot apply a missing, replaced or invalid row", async () => {
    const f = fixture(); f.dependencies.get.mockResolvedValue({...f.before, deliveryKey: "replacement"});
    await expect(run(args, f.factory, {})).rejects.toThrow("RELEASE_ROW_NOT_FOUND"); expect(f.dependencies.plan).not.toHaveBeenCalled();
  });
});


describe("operator SDK transport wiring", () => {
  it("targets the explicit project's named app and the generated api connector for both operations", async () => {
    const app = {name: "isolated-app"}; const dc = {name: "isolated-data-connect"}; const credential = {};
    const row = {id: "row"};
    const modules = { initializeApp: vi.fn(() => app), applicationDefault: vi.fn(() => credential), deleteApp: vi.fn(),
      getDataConnect: vi.fn(() => dc), sdk: {connectorConfig: {serviceId: "sodc-web-service", location: "europe-west2", connector: "api"},
        getNotificationDeliveryByChannelAndKey: vi.fn(async () => ({data: {notificationDeliveries: [row]}})),
        releaseNotificationRecoveryDeferralForClaimById: vi.fn(async () => ({data: {notificationDelivery_updateMany: 1}}))},
      helper: {planNotificationRecoveryRelease: vi.fn()} };
    const deps = await wire({projectId: "sodc-web-production"}, modules);
    expect(modules.initializeApp).toHaveBeenCalledWith({projectId: "sodc-web-production", credential}, expect.stringMatching(/^notification-recovery-admin-/));
    expect(modules.getDataConnect).toHaveBeenCalledWith({serviceId: "sodc-web-service", location: "europe-west2", connector: "api"}, app);
    expect(await deps.get({channel: "EMAIL", deliveryKey: "physical"})).toBe(row);
    expect(modules.sdk.getNotificationDeliveryByChannelAndKey).toHaveBeenCalledWith(dc, {channel: "EMAIL", deliveryKey: "physical"});
    expect(await deps.release({id: "row"})).toBe(1);
    expect(modules.sdk.releaseNotificationRecoveryDeferralForClaimById).toHaveBeenCalledWith(dc, {id: "row"});
    await deps.dispose(); expect(modules.deleteApp).toHaveBeenCalledWith(app);
  });
  it("disposes the named app if connector construction fails", async () => {
    const app = {}; const deleteApp = vi.fn();
    await expect(wire({projectId: "sodc-web"}, { initializeApp: () => app, applicationDefault: () => ({}), deleteApp,
      getDataConnect: () => {throw new Error("connector");}, sdk: {connectorConfig: {connector: "api"}}, helper: {} })).rejects.toThrow("connector");
    expect(deleteApp).toHaveBeenCalledWith(app);
  });
});


it("runs the real release planner through preview, reviewed-hash apply and history readback without a provider", async () => {
  const payload = {version: 1, kind: "BOOKING_APPROVED", bookingId: "22222222-2222-4222-8222-222222222222"} as const;
  const identity = notificationRecoveryIdentity(payload);
  const before = {id: "33333333-3333-4333-8333-333333333333", channel: "EMAIL", ...identity, status: "FAILED", attemptCount: 2,
    recoveryPayload: JSON.stringify(payload), recipientUserId: null, deliveryMode: null,
    lastAttemptedAt: "2026-10-20T10:00:00.123456Z", createdAt: "2026-10-20T10:00:00.000Z",
    recoveryDeferredAt: "2026-10-20T10:20:00.000000Z", recoveryDeferredReason: "RECOVERY_DELIVERY_MODE_UNVERIFIABLE"};
  const input = [...args.map(value => value === key ? identity.deliveryKey : value), "--verified-mode", "TEAM_TEST"];
  const dependencies = {get: vi.fn(async () => before), plan: planNotificationRecoveryRelease,
    release: vi.fn(async () => 1), dispose: vi.fn()};
  const factory = async () => dependencies;
  const preview = await run(input, factory, {});
  expect(preview).toMatchObject({result: "PLAN", verifiedMode: "TEAM_TEST", fillsMissingDeliveryMode: true});
  dependencies.get.mockResolvedValueOnce(before).mockResolvedValueOnce({...before, deliveryMode: "TEAM_TEST", recoveryDeferredAt: null} as never);
  expect(await run(apply(preview.planHash, input), factory, {})).toMatchObject({result: "RELEASED", planHash: preview.planHash});
  expect(dependencies.release).toHaveBeenCalledWith(expect.objectContaining({id: before.id, expectedDeferredAt: before.recoveryDeferredAt,
    expectedRecipientUserId: null, expectedRecipientUserIdIsNull: true, expectedRecoveryPayload: before.recoveryPayload,
    verifiedDeliveryMode: "TEAM_TEST", actorId: "reviewing-operator"}));
});
