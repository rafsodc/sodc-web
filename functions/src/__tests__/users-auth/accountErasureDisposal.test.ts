import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({read: vi.fn(), write: vi.fn(), auth: vi.fn(), horizon: vi.fn()}));
vi.mock("firebase-admin/data-connect", () => ({getDataConnect: () => ({executeGraphqlRead: mocks.read, executeGraphql: mocks.write})}));
vi.mock("firebase-admin/auth", () => ({getAuth: () => ({getUser: mocks.auth})}));
import { ACCOUNT_ERASURE_RETENTION_MS, accountErasureDisposalEligibility, adoptHistoricalAccountErasureDisposal, disposeCompletedAccountErasures, ensureAccountErasureDisposal, readAccountErasureDisposal, setAccountErasureDisposalHold, setAccountErasureDisposalPolicy, withAccountErasureDisposalFence } from "../../accountErasureDisposal";
import type { AccountErasureDisposalDecision } from "../../accountErasureDisposal";

const completedAt = "2026-01-01T00:06:00.000Z", start = "2026-01-01T00:00:00.000Z";
const due = Date.parse(completedAt) + ACCOUNT_ERASURE_RETENTION_MS;
const generation = "10000000-0000-4000-8000-000000000001";
const policy = {version: 3, externalReplayReviewed: true, reviewReference: "case/external-review"};
const markers = ["a", "b"].map(char => ({emailHash: char.repeat(64), startedAt: start, completedAt, profileDeletedAt: completedAt}));
function decision(overrides: Partial<AccountErasureDisposalDecision> = {}): AccountErasureDisposalDecision {
  return {userId: "disposal-fixture", generation, version: 4, internalQuiescedAt: completedAt, taskSafeAt: completedAt, providerSafeAt: new Date(due).toISOString(), evidenceReference: "INTERNAL_COMPLETION", holdCode: null, reviewDueAt: null, nextAttemptAt: new Date(due).toISOString(), lastReason: null, updatedAt: completedAt, ...overrides};
}
function context() {return {projectId: "sodc-web", inspectRetentionHorizon: mocks.horizon, now: () => due};}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockImplementation(async (query: string) => {
    if (query.includes("query ErasureDisposalPolicy")) return {data: {accountErasureDisposalPolicy: policy}};
    if (query.includes("query DueErasureDisposals")) return {data: {accountErasureDisposals: [decision()]}};
    if (query.includes("query DisposalMarkers")) return {data: {accountErasures: markers}};
    if (query.includes("query AccountErasureDisposalState")) return {data: {accountErasureDisposal: decision()}};
    throw new Error("unexpected read");
  });
  mocks.auth.mockRejectedValue({code: "auth/user-not-found"});
  mocks.horizon.mockResolvedValue({safe: true, reason: "RESTORE_HORIZON_CLEAR"});
  mocks.write.mockResolvedValue({data: {aliases: 2, decisionDelete: 1}});
});
afterEach(() => vi.useRealTimers());

describe("all-alias suppression retention", () => {
  it("waits the full30 days for every alias, including exact boundary", () => {
    expect(accountErasureDisposalEligibility({decision: decision(), markers}, policy, due - 1)).toMatchObject({eligible: false, reason: "RETENTION_PENDING"});
    expect(accountErasureDisposalEligibility({decision: decision(), markers}, policy, due)).toMatchObject({eligible: true, hashes: markers.map(row => row.emailHash)});
    const recent = {...markers[1], completedAt: new Date(Date.parse(completedAt) + 1).toISOString()};
    expect(accountErasureDisposalEligibility({decision: decision(), markers: [markers[0], recent]}, policy, due)).toMatchObject({eligible: false});
  });
  it.each([
    {holdCode: "OPERATOR_REVIEW"}, {internalQuiescedAt: null}, {taskSafeAt: null}, {providerSafeAt: null},
    {internalQuiescedAt: start}, {providerSafeAt: completedAt}, {taskSafeAt: new Date(due + 1).toISOString()},
  ])("retains suppression when evidence is missing, stale or held: %j", overrides => {
    expect(accountErasureDisposalEligibility({decision: decision(overrides), markers}, policy, due).eligible).toBe(false);
  });
  it.each([
    [], [{...markers[0], completedAt: null}], [{...markers[0], profileDeletedAt: null}],
    [{...markers[0], completedAt: "bad"}], [{...markers[0], startedAt: new Date(due).toISOString()}], [markers[0], markers[0]], Array(1001).fill(markers[0]),
  ])("refuses incomplete, malformed, duplicated or truncated aliases", rows => {
    expect(accountErasureDisposalEligibility({decision: decision(), markers: rows as any}, policy, due).eligible).toBe(false);
  });
  it("does not interpret absent external review as approval", () => {
    expect(accountErasureDisposalEligibility({decision: decision(), markers}, {...policy, externalReplayReviewed: false}, due)).toMatchObject({eligible: false, reason: "EXTERNAL_REVIEW_REQUIRED"});
  });
});

describe("bounded automatic disposal", () => {
  it("checks fresh Auth and backup horizon, then submits all aliases in one version-fenced transaction", async () => {
    await expect(disposeCompletedAccountErasures(context())).resolves.toEqual({examined: 1, disposed: 1, deferred: 0, failed: 0});
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.horizon).toHaveBeenCalledWith({projectId: "sodc-web", profileDeletedAt: completedAt, completedAt, now: new Date(due).toISOString()});
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.write.mock.calls[0][1].variables).toEqual({uid: "disposal-fixture", generation, version: 4, policyVersion: 3, hashes: markers.map(row => row.emailHash), count: 2, completedAt, profileDeletedAt: completedAt});
  });
  it("normalizes compact UUIDs in candidate pages before the final version-fenced transaction", async () => {
    mocks.read.mockResolvedValueOnce({data: {accountErasureDisposalPolicy: policy}}).mockResolvedValueOnce({data: {accountErasureDisposals: [decision({generation: generation.replaceAll("-", "")})]}});
    await expect(disposeCompletedAccountErasures(context())).resolves.toMatchObject({disposed: 1});
    expect(mocks.write.mock.calls[0][1].variables.generation).toBe(generation);
  });
  it.each([{}, {code: "auth/permission-denied"}, {code: "auth/internal-error"}])("retains records if Auth exists or cannot be checked: %j", async error => {
    if (Object.keys(error).length) mocks.auth.mockRejectedValue(error); else mocks.auth.mockResolvedValue({uid: "disposal-fixture"});
    await expect(disposeCompletedAccountErasures(context())).resolves.toMatchObject({disposed: 0, failed: 1});
    expect(mocks.horizon).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.every(call => !call[0].includes("mutation DisposeAccountErasure"))).toBe(true);
  });
  it("checks Auth again after cloud evidence so a restoration during the lookup blocks disposal", async () => {
    mocks.auth.mockRejectedValueOnce({code: "auth/user-not-found"}).mockResolvedValueOnce({uid: "disposal-fixture"});
    await expect(disposeCompletedAccountErasures(context())).resolves.toMatchObject({disposed: 0, failed: 1});
    expect(mocks.write.mock.calls.every(call => !call[0].includes("mutation DisposeAccountErasure"))).toBe(true);
  });
  it.each([null, {}, {safe: false, reason: "BACKUP_PRESENT"}, {safe: "true"}])("defers missing/unsafe backup evidence: %j", async horizon => {
    mocks.horizon.mockResolvedValue(horizon);
    await expect(disposeCompletedAccountErasures(context())).resolves.toMatchObject({disposed: 0, deferred: 1});
    expect(mocks.write.mock.calls[0][1].variables).toMatchObject({reason: "RESTORE_HORIZON_PENDING", version: 4});
  });
  it("does no candidate read or Auth lookup without reviewed external replay policy", async () => {
    mocks.read.mockResolvedValue({data: {accountErasureDisposalPolicy: {...policy, externalReplayReviewed: false}}});
    await expect(disposeCompletedAccountErasures(context())).resolves.toEqual({examined: 0, disposed: 0, deferred: 0, failed: 0});
    expect(mocks.read).toHaveBeenCalledOnce(); expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("probes runtime metadata using only a non-personal epoch when no candidate is due", async () => {
    mocks.read.mockResolvedValueOnce({data: {accountErasureDisposalPolicy: policy}}).mockResolvedValueOnce({data: {accountErasureDisposals: []}});
    await expect(disposeCompletedAccountErasures(context())).resolves.toMatchObject({examined: 0, retentionProbe: "RESTORE_HORIZON_CLEAR"});
    expect(mocks.horizon).toHaveBeenCalledWith({projectId: "sodc-web", profileDeletedAt: "1970-01-01T00:00:00.000Z", completedAt: "1970-01-01T00:00:00.000Z", now: new Date(due).toISOString()});
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects a truncated/malformed candidate page and never attempts deletion", async () => {
    mocks.read.mockResolvedValueOnce({data: {accountErasureDisposalPolicy: policy}}).mockResolvedValueOnce({data: {accountErasureDisposals: Array(11).fill(decision())}});
    await expect(disposeCompletedAccountErasures(context())).rejects.toThrow("UNAVAILABLE");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("respects the deadline even when a cloud evidence call never settles", async () => {
    vi.useFakeTimers(); vi.setSystemTime(due);
    mocks.horizon.mockImplementation(() => new Promise(() => undefined));
    const run = disposeCompletedAccountErasures({...context(), now: Date.now});
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(run).resolves.toEqual({examined: 1, disposed: 0, deferred: 0, failed: 1});
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("performs no access for unapproved projects or an already-exhausted scheduler budget", async () => {
    await disposeCompletedAccountErasures({...context(), projectId: "arbitrary"});
    await disposeCompletedAccountErasures({...context(), deadline: due});
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("does not retry a conflicting/unknown purge; later lifecycle work owns the marker set", async () => {
    mocks.write.mockRejectedValue(new Error("ERASURE_DISPOSAL_CONFLICT"));
    await expect(disposeCompletedAccountErasures(context())).resolves.toMatchObject({disposed: 0, failed: 1});
    expect(mocks.write.mock.calls.filter(call => call[0].includes("mutation DisposeAccountErasure"))).toHaveLength(1);
  });
});

describe("restricted evidence and lifecycle updates", () => {
  it("normalizes only valid compact UUID transport values and preserves required/null validation", async () => {
    mocks.read.mockResolvedValue({data: {accountErasureDisposal: decision({generation: generation.replaceAll("-", "")})}});
    await expect(readAccountErasureDisposal("disposal-fixture")).resolves.toMatchObject({generation});
    for (const overrides of [{generation: "-".repeat(36)}, {generation: "g".repeat(32)}, {holdCode: undefined}, {version: undefined}, {updatedAt: "invalid"}]) {
      mocks.read.mockResolvedValue({data: {accountErasureDisposal: decision(overrides)}});
      await expect(readAccountErasureDisposal("disposal-fixture")).rejects.toThrow("UNAVAILABLE");
    }
  });
  it("preserves an existing decision rather than overwriting a hold on retry", async () => {
    mocks.read.mockResolvedValue({data: {accountErasureDisposal: decision({holdCode: "EXTERNAL_COPY"})}});
    await expect(ensureAccountErasureDisposal("disposal-fixture", false)).resolves.toMatchObject({holdCode: "EXTERNAL_COPY"});
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("historical insert-only initialization defaults to HOLD", async () => {
    mocks.read.mockResolvedValueOnce({data: {accountErasureDisposal: null}}).mockResolvedValueOnce({data: {accountErasureDisposal: decision({holdCode: "HISTORICAL_EVIDENCE_REQUIRED"})}});
    await ensureAccountErasureDisposal("disposal-fixture", true);
    expect(mocks.write.mock.calls[0][1].variables.hold).toBe("HISTORICAL_EVIDENCE_REQUIRED");
  });
  it("re-reads generation after a stale zero-row lifecycle CAS and stops after bounded conflicts", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("ERASURE_DISPOSAL_CONFLICT")).mockResolvedValueOnce("ok");
    await expect(withAccountErasureDisposalFence("disposal-fixture", false, write)).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(2);
    write.mockRejectedValue(new Error("ERASURE_DISPOSAL_CONFLICT"));
    await expect(withAccountErasureDisposalFence("disposal-fixture", false, write)).rejects.toThrow("CONFLICT");
    expect(write).toHaveBeenCalledTimes(5);
  });
  it("requires dated, versioned historical queue/provider evidence and fresh Auth absence", async () => {
    const expected = {generation, version: 4};
    await expect(adoptHistoricalAccountErasureDisposal("disposal-fixture", expected, markers, {taskSafeAt: completedAt, providerSafeAt: completedAt, reviewReference: "case/review"})).rejects.toThrow("EVIDENCE_INVALID");
    expect(mocks.write).not.toHaveBeenCalled();
    await adoptHistoricalAccountErasureDisposal("disposal-fixture", expected, markers, {taskSafeAt: completedAt, providerSafeAt: new Date(due).toISOString(), reviewReference: "case/review"});
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.write.mock.calls[0][1].variables).toMatchObject({generation, version: 4, count: 2, hashes: markers.map(row => row.emailHash), reference: "case/review"});
  });
  it("requires bounded hold review dates and finite static hold codes", async () => {
    vi.useFakeTimers(); vi.setSystemTime(due);
    await expect(setAccountErasureDisposalHold("disposal-fixture", {generation, version: 4}, "OPERATOR_REVIEW", new Date(due + ACCOUNT_ERASURE_RETENTION_MS + 1).toISOString())).rejects.toThrow("HOLD_INVALID");
    await expect(setAccountErasureDisposalHold("disposal-fixture", {generation, version: 4}, "member@example.invalid", new Date(due + 1000).toISOString())).rejects.toThrow("HOLD_INVALID");
    await setAccountErasureDisposalHold("disposal-fixture", decision(), "OPERATOR_REVIEW", new Date(due + 1000).toISOString());
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(Object.keys(mocks.write.mock.calls[0][1].variables).sort()).toEqual(["generation", "holdCode", "reviewDueAt", "uid", "version"]);
  });
  it("changes the global policy through a reviewed version and bounded non-personal reference", async () => {
    await expect(setAccountErasureDisposalPolicy(3, true, "member@example.invalid")).rejects.toThrow("REFERENCE_INVALID");
    await setAccountErasureDisposalPolicy(3, false, "case/replay-hold");
    expect(mocks.write.mock.calls[0][1].variables).toEqual({version: 3, reviewed: false, reference: "case/replay-hold"});
  });
});
