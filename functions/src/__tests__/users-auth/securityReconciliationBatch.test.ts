import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListSecurityStatesForReconciliationData } from "../../securityRepository";

const mocks = vi.hoisted(() => ({ledgers: vi.fn(), getUsers: vi.fn()}));
vi.mock("firebase-admin", () => ({auth: () => ({getUsers: mocks.getUsers})}));
vi.mock("../../securityRepository", () => ({listSecurityTransitionsForReconciliation: mocks.ledgers}));
import { createReconciliationBatchMetrics, healthySecurityMirrorUserIds } from "../../securityReconciliationBatch";
type State = ListSecurityStatesForReconciliationData["userSecurityStates"][number];
function state(i = 0): State {
  return {userId: `member-${i}`, operationId: `operation-${i}`, securityVersion: 3, membershipStatus: "REGULAR", desiredEnabled: true,
    desiredAdmin: false, verificationEmail: null, accessReady: true, adminReady: false, syncStatus: "READY", user: {membershipStatus: "REGULAR"}};
}
function ledger(row: State) {return {...row, user: undefined, noOp: false};}
function identity(row: State) {return {uid: row.userId, disabled: false, emailVerified: true,
  customClaims: {enabled: row.desiredEnabled, admin: false, securityVersion: row.securityVersion, unrelated: "preserved"}};}
let rows: State[];
beforeEach(() => {
  vi.resetAllMocks(); rows = [state()];
  mocks.ledgers.mockImplementation(async () => ({data: {securityTransitions: rows.map(ledger)}}));
  mocks.getUsers.mockImplementation(async identifiers => ({users: identifiers.map(({uid}: {uid: string}) => identity(rows.find(row => row.userId === uid)!)).reverse(), notFound: []}));
});

describe("read-only healthy security mirror batches", () => {
  it.each([0, 1, 99, 100, 101, 499, 500])("checks %i states with bounded unordered Auth batches", async count => {
    rows = Array.from({length: count}, (_, i) => state(i));
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set(rows.map(row => row.userId)));
    expect(mocks.ledgers).toHaveBeenCalledTimes(count ? 1 : 0);
    expect(mocks.getUsers).toHaveBeenCalledTimes(Math.ceil(count / 100));
    for (const [identifiers] of mocks.getUsers.mock.calls) expect(identifiers.length).toBeLessThanOrEqual(100);
    if (count) expect(mocks.ledgers).toHaveBeenCalledWith({operationIds: rows.map(row => row.operationId), limit: count});
  });

  it("uses fresh coordinator fallback with an older connector's UID/operation-only rows", async () => {
    const legacyRows = [{userId: "member", operationId: "operation"}] as State[];
    expect(await healthySecurityMirrorUserIds(legacyRows)).toEqual(new Set());
    expect(mocks.ledgers).not.toHaveBeenCalled(); expect(mocks.getUsers).not.toHaveBeenCalled();
  });

  it("refuses an oversized page before any bulk service call", async () => {
    rows = Array.from({length: 501}, (_, i) => state(i));
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
    expect(mocks.ledgers).not.toHaveBeenCalled(); expect(mocks.getUsers).not.toHaveBeenCalled();
  });

  it("accepts disabled email-free denied identities without granting or mutating anything", async () => {
    rows[0] = {...state(), membershipStatus: "PENDING", user: {membershipStatus: "PENDING"}, desiredEnabled: false, accessReady: false};
    const account = {...identity(rows[0]), disabled: true, emailVerified: false};
    mocks.getUsers.mockResolvedValue({users: [account], notFound: []});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set([rows[0].userId]));
    expect(account.customClaims).toEqual({enabled: false, admin: false, securityVersion: 3, unrelated: "preserved"});
  });

  it.each([
    {desiredAdmin: true}, {adminReady: true}, {syncStatus: "PENDING"}, {syncStatus: "SUPERSEDED"},
    {verificationEmail: "held@example.org"}, {accessReady: false}, {securityVersion: 0}, {securityVersion: 1.2},
    {operationId: ""}, {userId: ""}, {membershipStatus: "UNKNOWN"}, {user: {membershipStatus: "RESERVE"}},
    {membershipStatus: "PENDING", user: {membershipStatus: "PENDING"}},
  ])("leaves administrators, holds, pending, drift and malformed states for the coordinator: %j", async change => {
    rows[0] = {...rows[0], ...change} as State;
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
    expect(mocks.getUsers).not.toHaveBeenCalled();
    expect(mocks.ledgers).not.toHaveBeenCalled();
  });

  it.each([
    {operationId: "foreign"}, {userId: "foreign"}, {securityVersion: 4}, {syncStatus: "PENDING"}, {syncStatus: "SUPERSEDED"},
    {membershipStatus: "RESERVE"}, {desiredEnabled: false}, {desiredAdmin: true}, {verificationEmail: "held@example.org"}, {noOp: true},
  ])("requires the current immutable ledger to match: %j", async change => {
    mocks.ledgers.mockResolvedValue({data: {securityTransitions: [{...ledger(rows[0]), ...change}]}});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
    expect(mocks.getUsers).not.toHaveBeenCalled();
  });

  it.each(["missing", "duplicate", "foreign", "failure"])("falls back on %s ledger evidence", async kind => {
    if (kind === "failure") mocks.ledgers.mockRejectedValue(new Error("unavailable"));
    else mocks.ledgers.mockResolvedValue({data: {securityTransitions: kind === "missing" ? [] : kind === "duplicate" ? [ledger(rows[0]), ledger(rows[0])] : [{...ledger(rows[0]), operationId: "foreign"}]}});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
    expect(mocks.getUsers).not.toHaveBeenCalled();
  });

  it.each(["uid", "operation"])("refuses ambiguous duplicate page %s ownership", async kind => {
    rows.push({...state(1), ...(kind === "uid" ? {userId: rows[0].userId} : {operationId: rows[0].operationId})});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
    expect(mocks.getUsers).not.toHaveBeenCalled();
  });

  it.each(["missing", "duplicate", "foreign", "overlap", "foreignNotFound", "malformedNotFound", "failure"])("rejects the whole Auth batch on %s results", async kind => {
    rows.push(state(1));
    const users = rows.map(identity);
    if (kind === "failure") mocks.getUsers.mockRejectedValue(new Error("unavailable"));
    else mocks.getUsers.mockResolvedValue({users: kind === "missing" ? users.slice(0, 1) : kind === "duplicate" ? [users[0], users[0]] : kind === "foreign" ? [users[0], {...users[1], uid: "foreign"}] : users,
      notFound: kind === "overlap" ? [{uid: rows[0].userId}] : kind === "foreignNotFound" ? [{uid: "foreign"}] : kind === "malformedNotFound" ? [{email: "foreign@example.org"}] : []});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
  });

  it("uses exact notFound coverage without suppressing present healthy members", async () => {
    rows.push(state(1));
    mocks.getUsers.mockResolvedValue({users: [identity(rows[1])], notFound: [{uid: rows[0].userId}]});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set([rows[1].userId]));
  });

  it.each([
    {disabled: true}, {emailVerified: false}, {disabled: undefined}, {emailVerified: undefined},
    {customClaims: {enabled: true, admin: false, securityVersion: 2}}, {customClaims: {enabled: false, admin: false, securityVersion: 3}},
    {customClaims: {enabled: true, admin: true, securityVersion: 3}}, {customClaims: undefined},
  ])("falls back on external identity or claim drift: %j", async change => {
    mocks.getUsers.mockResolvedValue({users: [{...identity(rows[0]), ...change}], notFound: []});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
  });

  it("continues later batches after an earlier transport failure", async () => {
    rows = Array.from({length: 101}, (_, i) => state(i));
    mocks.getUsers.mockRejectedValueOnce(new Error("unavailable"));
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set([rows[100].userId]));
    expect(mocks.getUsers).toHaveBeenCalledTimes(2);
  });

  it("accounts for a failed ledger read without making any Auth request", async () => {
    const metrics = createReconciliationBatchMetrics();
    let elapsed = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => elapsed);
    mocks.ledgers.mockImplementationOnce(async () => {elapsed += 9; throw new Error("unavailable");});
    try {
      expect(await healthySecurityMirrorUserIds(rows, metrics)).toEqual(new Set());
      expect(metrics).toEqual({ledgerReads: 1, ledgerReadDurationMs: 9, ledgerReadFailures: 1,
        authBatchReads: 0, authBatchReadDurationMs: 0, authBatchReadFailures: 0});
    } finally {clock.mockRestore();}
  });

  it("records incomplete Auth coverage as one uncertain batch, retaining later healthy batches", async () => {
    rows = Array.from({length: 101}, (_, i) => state(i));
    const metrics = createReconciliationBatchMetrics();
    mocks.getUsers.mockResolvedValueOnce({users: [], notFound: []});
    expect(await healthySecurityMirrorUserIds(rows, metrics)).toEqual(new Set([rows[100].userId]));
    expect(metrics).toMatchObject({ledgerReads: 1, ledgerReadFailures: 0, authBatchReads: 2, authBatchReadFailures: 1});
  });

  it("does not retain authority or identities between invocations", async () => {
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set([rows[0].userId]));
    mocks.getUsers.mockResolvedValue({users: [{...identity(rows[0]), disabled: true}], notFound: []});
    expect(await healthySecurityMirrorUserIds(rows)).toEqual(new Set());
    expect(mocks.ledgers).toHaveBeenCalledTimes(2); expect(mocks.getUsers).toHaveBeenCalledTimes(2);
  });
});
