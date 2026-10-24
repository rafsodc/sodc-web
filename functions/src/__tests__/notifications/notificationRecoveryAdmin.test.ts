import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { planNotificationRecoveryRelease } from "../../notificationRecoveryDeferral";
import { notificationRecoveryIdentity } from "../../notificationRecoveryIdentity";
import { parseNotificationRecoveryAdminArguments, runNotificationRecoveryAdmin, formatNotificationRecoveryAdminError, NotificationRecoveryAdminError } from "../../notificationRecoveryAdmin";

let cli: (args: string[], dependencies: any) => Promise<number>;
let wire: (options: any, dependencies: any) => Promise<any>;
let parse: (args: string[], env?: Record<string, string>) => any;
let run: (args: string[], dependencies: any, env?: Record<string, string>) => Promise<any>;
const key = "booking:private@example.invalid:notify-live";
const args = ["--project", "sodc-web", "--delivery-key", key, "--actor", "reviewing-operator", "--evidence-reference", "review-ticket-42"];
beforeAll(async () => {
  const tool = await import(pathToFileURL(path.resolve(__dirname, "../../../scripts/notification-recovery-admin.mjs")).href);
  wire = tool.createNotificationRecoveryAdminDependencies;
  cli = tool.runNotificationRecoveryAdminCli;
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
    await expect(run(apply(preview.planHash), f.factory, {})).rejects.toThrow("RELEASE_WRITE_OUTCOME_UNKNOWN");
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
        getNotificationDeliveryById: vi.fn(async () => ({data: {notificationDeliveries: [row]}})),
        releaseNotificationRecoveryDeferralForClaimById: vi.fn(async () => ({data: {notificationDelivery_updateMany: 1}}))},
      helper: {planNotificationRecoveryRelease: vi.fn()} };
    const deps = await wire({projectId: "sodc-web-production"}, modules);
    expect(modules.initializeApp).toHaveBeenCalledWith({projectId: "sodc-web-production", credential}, expect.stringMatching(/^notification-recovery-admin-/));
    expect(modules.getDataConnect).toHaveBeenCalledWith({serviceId: "sodc-web-service", location: "europe-west2", connector: "api"}, app);
    expect(await deps.get({channel: "EMAIL", deliveryKey: "physical"})).toBe(row);
    expect(modules.sdk.getNotificationDeliveryByChannelAndKey).toHaveBeenCalledWith(dc, {channel: "EMAIL", deliveryKey: "physical"});
    expect(await deps.get({channel: "EMAIL", deliveryId: "delivery-uuid"})).toBe(row);
    expect(modules.sdk.getNotificationDeliveryById).toHaveBeenCalledWith(dc, {id: "delivery-uuid"});
    modules.sdk.getNotificationDeliveryById.mockResolvedValueOnce({data: {notificationDeliveries: []}});
    expect(await deps.get({channel: "EMAIL", deliveryId: "missing-uuid"})).toBeNull();
    expect(modules.sdk.getNotificationDeliveryByChannelAndKey).toHaveBeenCalledOnce();
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


async function failureReport(promise: Promise<any>) {
  const failure = await promise.then(() => undefined, error => error);
  expect(failure).toBeInstanceOf(NotificationRecoveryAdminError);
  return formatNotificationRecoveryAdminError(failure);
}
const uuid = "3333aabb-cdef-4333-8333-333333333333";
const compactUuid = uuid.replace(/-/g, "");
const idArgs = args.map(value => value === "--delivery-key" ? "--delivery-id" : value === key ? uuid : value);

describe("one-row lookup by logged delivery ID", () => {
  it.each([uuid, uuid.toUpperCase(), compactUuid, compactUuid.toUpperCase()])("canonicalizes UUID selector %s without needing a private physical key", inputId => {
    expect(parse(idArgs.map(value => value === uuid ? inputId : value), {})).toMatchObject({deliveryId: compactUuid, deliveryKey: undefined, apply: false});
  });
  it.each([compactUuid.slice(1), compactUuid + "0", `{${uuid}}`, uuid.replace("-", ""), " " + compactUuid])("rejects malformed UUID %s before SDK access", async inputId => {
    const factory = vi.fn();
    expect(await failureReport(run(idArgs.map(value => value === uuid ? inputId : value), factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_DELIVERY_ID_INVALID"});
    expect(factory).not.toHaveBeenCalled();
  });
  it.each([[...args, "--delivery-id", uuid], idArgs.map(value => value === uuid ? "not-a-uuid" : value), [...idArgs, "--delivery-id", uuid]])("rejects invalid, duplicate or mixed selectors before SDK access: %j", async input => {
    const factory = vi.fn(); await expect(run(input, factory, {})).rejects.toThrow(); expect(factory).not.toHaveBeenCalled();
  });
  it.each([
    [compactUuid, compactUuid], [uuid, compactUuid], [compactUuid, uuid.toUpperCase()], [uuid.toUpperCase(), uuid],
  ])("previews and releases selector %s against row ID %s without changing the snapshot", async (inputId, rowId) => {
    const f = fixture(); f.before.id = rowId; f.after.id = rowId;
    const input = idArgs.map(value => value === uuid ? inputId : value);
    const preview = await run(input, f.factory, {});
    expect(f.dependencies.get).toHaveBeenCalledWith(expect.objectContaining({deliveryId: compactUuid, deliveryKey: undefined}));
    f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce(f.after);
    expect(await run(apply(preview.planHash, input), f.factory, {})).toMatchObject({result: "RELEASED", deliveryId: rowId});
    expect(f.dependencies.release).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id: rowId}));
    expect(JSON.stringify(preview)).not.toContain(key);
  });
  it("uses the same reviewed hash across equivalent UUID selector formats", async () => {
    const f = fixture(); f.before.id = compactUuid; f.after.id = compactUuid;
    const preview = await run(idArgs, f.factory, {});
    const equivalent = idArgs.map(value => value === uuid ? compactUuid.toUpperCase() : value);
    expect(await run(equivalent, f.factory, {})).toMatchObject({result: "PLAN", planHash: preview.planHash});
    f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce(f.after);
    expect(await run(apply(preview.planHash, equivalent), f.factory, {})).toMatchObject({result: "RELEASED", planHash: preview.planHash});
    expect(f.dependencies.release).toHaveBeenCalledOnce();
  });
  it("rejects a different well-formed UUID without planning or writing", async () => {
    const f = fixture(); f.before.id = "4333aabbcdef43338333333333333333";
    expect(await failureReport(run(idArgs, f.factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_ROW_NOT_FOUND"});
    expect(f.dependencies.plan).not.toHaveBeenCalled(); expect(f.dependencies.release).not.toHaveBeenCalled();
  });
  it("does not fall back to another row or key when the requested ID is missing", async () => {
    const f = fixture();
    expect(await failureReport(run(idArgs, f.factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_ROW_NOT_FOUND"});
    expect(f.dependencies.plan).not.toHaveBeenCalled(); expect(f.dependencies.release).not.toHaveBeenCalled();
  });
  it("binds selector choice into the plan hash even for the same physical row", async () => {
    const f = fixture(); f.before.id = uuid;
    const preview = await run(idArgs, f.factory, {});
    expect(await failureReport(run(apply(preview.planHash), f.factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_PLAN_CHANGED"});
    expect(f.dependencies.release).not.toHaveBeenCalled();
  });
});

describe("truthful release outcomes and safe command output", () => {
  it("reports a definite no-write for invalid arguments and changed snapshots", async () => {
    const factory = vi.fn();
    expect(await failureReport(run([], factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_PROJECT_REQUIRED"});
    expect(factory).not.toHaveBeenCalled();
    const f = fixture(); const preview = await run(args, f.factory, {}); f.dependencies.release.mockResolvedValue(0);
    expect(await failureReport(run(apply(preview.planHash), f.factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_SNAPSHOT_CHANGED", planHash: preview.planHash});
  });
  it.each([undefined, null, 2, -1, "1", false])("does not assume a write failed after an invalid SDK response %j", async affected => {
    const f = fixture(); const preview = await run(args, f.factory, {}); f.dependencies.release.mockResolvedValue(affected);
    expect(await failureReport(run(apply(preview.planHash), f.factory, {}))).toMatchObject({result: "WRITE_OUTCOME_UNKNOWN", code: "RELEASE_WRITE_RESPONSE_INVALID", planHash: preview.planHash});
    expect(f.dependencies.release).toHaveBeenCalledOnce(); expect(f.dependencies.get).toHaveBeenCalledTimes(2);
  });
  it("keeps uncertainty and the receipt without printing SDK secrets or retrying", async () => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    f.dependencies.release.mockRejectedValue(new Error("PRIVATE_API_KEY_SECRET private@example.invalid"));
    const report = await failureReport(run(apply(preview.planHash), f.factory, {}));
    expect(report).toMatchObject({result: "WRITE_OUTCOME_UNKNOWN", code: "RELEASE_WRITE_OUTCOME_UNKNOWN", planHash: preview.planHash});
    expect(JSON.stringify(report)).not.toContain("private"); expect(JSON.stringify(report)).not.toContain("SECRET");
    expect(f.dependencies.release).toHaveBeenCalledOnce();
  });
  it.each(["unavailable", "changed"])("preserves a confirmed write when readback is %s", async kind => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    f.dependencies.get.mockResolvedValueOnce(f.before);
    if (kind === "unavailable") f.dependencies.get.mockRejectedValueOnce(new Error("secret backend response"));
    else f.dependencies.get.mockResolvedValueOnce({...f.after, attemptCount: 4});
    expect(await failureReport(run(apply(preview.planHash), f.factory, {}))).toMatchObject({result: "APPLIED_UNVERIFIED", planHash: preview.planHash,
      code: kind === "unavailable" ? "RELEASE_READBACK_FAILED" : "RELEASE_READBACK_HISTORY_CHANGED", deliveryId: f.before.id});
    expect(f.dependencies.release).toHaveBeenCalledOnce();
  });
  it.each(["NOT_APPLIED", "WRITE_OUTCOME_UNKNOWN", "APPLIED_UNVERIFIED"])("cleanup cannot erase %s", async outcome => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    if (outcome === "NOT_APPLIED") f.dependencies.release.mockResolvedValue(0);
    if (outcome === "WRITE_OUTCOME_UNKNOWN") f.dependencies.release.mockRejectedValue(new Error("secret"));
    if (outcome === "APPLIED_UNVERIFIED") f.dependencies.get.mockResolvedValueOnce(f.before).mockRejectedValueOnce(new Error("secret"));
    f.dependencies.dispose.mockRejectedValue(new Error("cleanup secret"));
    expect(await failureReport(run(apply(preview.planHash), f.factory, {}))).toMatchObject({result: outcome, warningCode: "RELEASE_CLEANUP_FAILED", planHash: preview.planHash});
  });
  it.each([false, true])("cleanup cannot turn a verified plan/release into failure (apply=%s)", async applyWrite => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    f.dependencies.dispose.mockRejectedValue(new Error("cleanup secret"));
    if (applyWrite) f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce(f.after);
    expect(await run(applyWrite ? apply(preview.planHash) : args, f.factory, {})).toMatchObject({result: applyWrite ? "RELEASED" : "PLAN", warningCode: "RELEASE_CLEANUP_FAILED"});
  });
  it("does not interpret arbitrary unclassified exceptions as proof of no write", () => {
    expect(formatNotificationRecoveryAdminError(new Error("PRIVATE_SECRET"))).toEqual({schemaVersion: "sodc-notification-recovery-release-receipt/v1", result: "WRITE_OUTCOME_UNKNOWN", code: "RELEASE_WRITE_OUTCOME_UNKNOWN"});
  });
  it("retains fixed planner codes without exposing dynamic payload errors", async () => {
    const f = fixture(); f.dependencies.plan.mockImplementation(() => {throw new Error("NOTIFICATION_RECOVERY_RELEASE_MODE_CONFLICT");});
    expect(await failureReport(run(args, f.factory, {}))).toMatchObject({result: "NOT_APPLIED", code: "NOTIFICATION_RECOVERY_RELEASE_MODE_CONFLICT"});
    f.dependencies.plan.mockImplementation(() => {throw new Error("Unsupported recovery kind: private@example.invalid");});
    const report = await failureReport(run(args, f.factory, {}));
    expect(report).toMatchObject({result: "NOT_APPLIED", code: "RELEASE_PLAN_INVALID"}); expect(JSON.stringify(report)).not.toContain("private");
  });
  it("prints an applied-but-unverified receipt on stdout with a nonzero CLI exit", async () => {
    const f = fixture(); const preview = await run(args, f.factory, {});
    f.dependencies.get.mockResolvedValueOnce(f.before).mockResolvedValueOnce({...f.after, attemptCount: 4});
    const stdout = vi.fn(); const stderr = vi.fn();
    const core = {runNotificationRecoveryAdmin: (input: string[], deps: any) => run(input, deps, {}), formatNotificationRecoveryAdminError};
    expect(await cli(apply(preview.planHash), {core, createDependencies: f.factory, stdout, stderr})).toBe(1);
    const report = JSON.parse(stdout.mock.calls[0][0]);
    expect(report).toMatchObject({result: "APPLIED_UNVERIFIED", code: "RELEASE_READBACK_HISTORY_CHANGED", planHash: preview.planHash});
    expect(stderr).toHaveBeenCalledWith("RELEASE_READBACK_HISTORY_CHANGED: APPLIED_UNVERIFIED");
    expect(stdout.mock.calls[0][0]).not.toContain("private"); expect(f.dependencies.release).toHaveBeenCalledOnce();
  });
});


describe("read-only inspection after an incomplete release", () => {
  it.each(["FAILED", "PENDING", "SENT", "SKIPPED"])("shows safe current %s state without planning or writing", async status => {
    const f = fixture(); f.before.id = uuid; f.before.status = status; f.before.attemptCount = 6;
    const observed = {...f.before, recoveryDeferredAt: null}; f.dependencies.get.mockResolvedValue(observed);
    const result = await run([...idArgs, "--inspect"], f.factory, {});
    expect(result).toMatchObject({result: "INSPECTED", deliveryId: uuid, status, attemptCount: 6, deferredAt: null, lastAttemptedAt: f.before.lastAttemptedAt});
    expect(result.planHash).toBeUndefined(); expect(JSON.stringify(result)).not.toContain("private");
    expect(f.dependencies.plan).not.toHaveBeenCalled(); expect(f.dependencies.release).not.toHaveBeenCalled(); expect(f.dependencies.dispose).toHaveBeenCalledOnce();
  });
  it("can inspect the same row by exact key", async () => {
    const f = fixture(); expect(await run([...args, "--inspect"], f.factory, {})).toMatchObject({result: "INSPECTED", deferredAt: f.before.recoveryDeferredAt});
    expect(f.dependencies.release).not.toHaveBeenCalled();
  });
  it.each([["--apply"], ["--verified-mode", "LIVE"], ["--confirm-project", "sodc-web"], ["--expected-plan-hash", "a".repeat(64)], ["--inspect"]])("rejects inspection with write or duplicate flags %j", async extra => {
    const factory = vi.fn();
    expect(await failureReport(run([...idArgs, "--inspect", ...extra], factory, {}))).toMatchObject({result: "NOT_APPLIED"});
    expect(factory).not.toHaveBeenCalled();
  });
  it("preserves a successful read-only inspection if app cleanup fails", async () => {
    const f = fixture(); f.dependencies.dispose.mockRejectedValue(new Error("secret"));
    expect(await run([...args, "--inspect"], f.factory, {})).toMatchObject({result: "INSPECTED", warningCode: "RELEASE_CLEANUP_FAILED"});
    expect(f.dependencies.release).not.toHaveBeenCalled();
  });
});
