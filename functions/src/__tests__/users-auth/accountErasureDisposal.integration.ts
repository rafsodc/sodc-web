import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
import { startAccountErasure, completeAccountErasure } from "../../accountErasureState";
import { readAccountErasureDisposal, setAccountErasureDisposalHold, setAccountErasureDisposalPolicy } from "../../accountErasureDisposal";
import { purgeAccountErasureMutation } from "../../accountErasureDisposalDatabase";

// Real SQL only in the runner-owned fresh demo database. Auth/cloud/provider
// operations are never used; fresh Auth/horizon behavior has separate unit tests.
let app: App, dc: DataConnect, prefix: string;
let sequence = 0;
let owned: string[] = [];
const old = "2020-01-01T00:06:00.000Z";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Fixture = {uid: string; generation: string; version: number; hashes: string[]; emails: string[]};

async function fixture(overrides: {hold?: string; incomplete?: boolean; recent?: boolean} = {}): Promise<Fixture> {
  const uid = `${prefix}-${sequence}-${owned.length}`;
  owned.push(uid);
  const generation = randomUUID(), emails = [`${uid}@example.invalid`, `${uid}-old@example.invalid`], hashes = emails.map(hash);
  await dc.executeGraphql(`mutation SeedDisposalFixture($uid: String!, $generation: UUID!, $first: String!, $second: String!, $hold: String, $lastCompletion: Timestamp, $lastDeletion: Timestamp!) @transaction {
    accountErasureDisposal_insert(data: {userId: $uid, generation: $generation, version: 7, internalQuiescedAt: "2020-01-01T00:06:00Z", taskSafeAt: "2020-01-01T00:06:00Z", providerSafeAt: "2020-01-31T00:06:00Z", evidenceReference: "LOCAL_SQL_FIXTURE", holdCode: $hold})
    accountErasure_insertMany(data: [
      {userId: $uid, emailHash: $first, startedAt: "2020-01-01T00:00:00Z", profileDeletedAt: "2020-01-01T00:06:00Z", completedAt: "2020-01-01T00:06:00Z"},
      {userId: $uid, emailHash: $second, startedAt: "2020-01-01T00:00:00Z", profileDeletedAt: $lastDeletion, completedAt: $lastCompletion}
    ])
  }`, {variables: {uid, generation, first: hashes[0], second: hashes[1], hold: overrides.hold ?? null, lastCompletion: overrides.incomplete ? null : overrides.recent ? new Date().toISOString() : old, lastDeletion: overrides.recent ? new Date().toISOString() : old}});
  return {uid, generation, version: 7, hashes, emails};
}
const variables = (item: Fixture) => ({uid: item.uid, generation: item.generation, version: item.version, policyVersion: 1, hashes: item.hashes, count: item.hashes.length, completedAt: old, profileDeletedAt: old});
const purge = (item: Fixture) => dc.executeGraphql(purgeAccountErasureMutation, {variables: variables(item)});
async function state(uid: string) {
  const result = await dc.executeGraphql<any, {uid: string}>(`query DisposalFixtureState($uid: String!) {
    accountErasures(where: {userId: {eq: $uid}}) {emailHash startedAt profileDeletedAt completedAt}
    accountErasureDisposal(key: {userId: $uid}) {generation version holdCode internalQuiescedAt taskSafeAt providerSafeAt}
  }`, {variables: {uid}});
  return result.data;
}

beforeAll(async () => {
  const root = path.resolve(__dirname, "../../..");
  const {assertAdminSafetyFixture} = await import(pathToFileURL(path.join(root, "scripts/admin-safety-integration-fixture.mjs")).href);
  const context = await assertAdminSafetyFixture();
  prefix = `disposal-it-${context.runId}`;
  app = initializeApp({projectId: context.projectId});
  dc = getDataConnect({connector: "api", serviceId: "sodc-web-service", location: "europe-west2"}, app);
  const current = await dc.executeGraphql<any, Record<string, never>>("query NoDisposalFixture {accountErasureDisposals(limit: 1) {userId} accountErasureDisposalPolicies(limit: 1) {id}}");
  expect(current.data).toEqual({accountErasureDisposals: [], accountErasureDisposalPolicies: []});
});
beforeEach(async () => {sequence++; owned = []; await setAccountErasureDisposalPolicy(0, true, "LOCAL_SQL_FIXTURE");});
afterEach(async () => {
  if (!dc) return;
  expect(owned.every(uid => uid.startsWith(prefix))).toBe(true);
  await dc.executeGraphql(`mutation RemoveOnlyDisposalFixtures($uids: [String!]!) @transaction {
    notificationDelivery_deleteMany(where: {recipientUserId: {in: $uids}})
    callableInvocation_deleteMany(where: {userId: {in: $uids}})
    accountErasure_deleteMany(where: {userId: {in: $uids}})
    accountErasureDisposal_deleteMany(where: {userId: {in: $uids}})
    accountErasureDisposalPolicy_deleteMany(where: {id: {eq: "site-wide"}})
  }`, {variables: {uids: owned}});
});
afterAll(async () => {if (app) await deleteApp(app);});

describe("suppression disposal transactions", () => {
  it("executes the hosted runner's exact exported seed and cleanup against real SQL", async () => {
    const root = path.resolve(__dirname, "../../..");
    const runner = await import(pathToFileURL(path.join(root, "scripts/validate-account-erasure-disposal-cloud.mjs")).href);
    const set = runner.createAccountErasureDisposalFixtures();
    const read = async (item: any) => (await dc.executeGraphqlRead<any, {uid: string}>(`query ExactHostedRunnerSqlFixture($uid: String!) {
      profile: user(id: $uid) {id}
      markers: accountErasures(where: {userId: {eq: $uid}}, limit: 3) {userId emailHash startedAt profileDeletedAt completedAt}
      decision: accountErasureDisposal(key: {userId: $uid}) {userId generation version internalQuiescedAt taskSafeAt providerSafeAt evidenceReference holdCode reviewDueAt nextAttemptAt lastReason updatedAt}
    }`, {variables: {uid: item.uid}})).data;
    try {
      const seed = runner.accountErasureDisposalSeed(set);
      await dc.executeGraphql(seed.query, {variables: seed.variables});
      for (const item of set.fixtures) {
        const current = await read(item);
        expect(current.profile).toBeNull(); expect(current.markers).toHaveLength(2);
        expect(current.decision.version).toBe(1);
        const completed = Date.parse(current.markers[0].profileDeletedAt);
        expect(Date.parse(current.decision.providerSafeAt) - completed).toBe(30 * 24 * 60 * 60 * 1000);
        expect(Date.parse(current.decision.taskSafeAt)).toBe(completed);
        expect(current.markers.filter((row: any) => row.completedAt === null)).toHaveLength(item.role === "incomplete" ? 1 : 0);
        expect(current.decision.holdCode).toBe(item.role === "held" ? "OPERATOR_REVIEW" : null);
      }
      const eligible = set.fixtures[0], observed = await read(eligible);
      await dc.executeGraphql(purgeAccountErasureMutation, {variables: {uid: eligible.uid, generation: eligible.generation, version: 1, policyVersion: 1, hashes: eligible.hashes, count: 2, completedAt: observed.markers[0].completedAt, profileDeletedAt: observed.markers[0].profileDeletedAt}});
    } finally {
      for (const item of set.fixtures) {
        const cleanup = runner.accountErasureDisposalCleanup(set, item, await read(item));
        await dc.executeGraphql(cleanup.query, {variables: cleanup.variables});
        expect(await read(item)).toEqual({profile: null, markers: [], decision: null});
      }
    }
  });
  it("normalizes a real SQL UUID response to the exact reviewed lifecycle generation", async () => {
    const own = await fixture();
    await expect(readAccountErasureDisposal(own.uid)).resolves.toMatchObject({generation: own.generation, version: own.version, holdCode: null, reviewDueAt: null, lastReason: null});
  });
  it("begins a fresh multi-alias erasure in one fenced batch without fabricating completion evidence", async () => {
    const uid = `${prefix}-${sequence}-fresh`;
    owned.push(uid);
    const emails = [`${uid}@example.invalid`, `${uid}-former@example.invalid`];
    await startAccountErasure(uid, emails);
    const observed = await state(uid);
    expect(observed.accountErasures.map((row: any) => row.emailHash).sort()).toEqual(emails.map(hash).sort());
    expect(new Set(observed.accountErasures.map((row: any) => row.startedAt)).size).toBe(1);
    expect(observed.accountErasures.every((row: any) => row.completedAt === null && row.profileDeletedAt === null)).toBe(true);
    expect(observed.accountErasureDisposal).toMatchObject({holdCode: null, internalQuiescedAt: null, taskSafeAt: null, providerSafeAt: null});
    await expect(completeAccountErasure(uid, {communicationsQuiesced: true})).rejects.toThrow(/ERASURE_COMPLETION_NOT_READY/);
  });
  it("deletes every completed alias and its temporary UID decision atomically", async () => {
    const own = await fixture(), unrelated = await fixture();
    await purge(own);
    expect(await state(own.uid)).toEqual({accountErasures: [], accountErasureDisposal: null});
    expect((await state(unrelated.uid)).accountErasures).toHaveLength(2);
  });
  it.each([{incomplete: true}, {recent: true}, {hold: "EXTERNAL_COPY"}])("keeps the entire marker set when any alias is incomplete, recent or held: %j", async overrides => {
    const own = await fixture(overrides);
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY/);
    const retained = await state(own.uid);
    expect(retained.accountErasures).toHaveLength(2);
    expect(retained.accountErasureDisposal.version).toBe(7);
  });
  it("refuses a selected subset, changed generation, incomplete evidence and a closed global policy", async () => {
    const own = await fixture();
    await expect(dc.executeGraphql(purgeAccountErasureMutation, {variables: {...variables(own), hashes: [own.hashes[0]], count: 1}})).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY/);
    await expect(purge({...own, generation: randomUUID()})).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY|ERASURE_DISPOSAL_CONFLICT/);
    await dc.executeGraphql("mutation RemoveTaskEvidence($uid: String!) {accountErasureDisposal_updateMany(where: {userId: {eq: $uid}}, data: {taskSafeAt: null})}", {variables: {uid: own.uid}});
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY/);
    await setAccountErasureDisposalPolicy(1, false, "LOCAL_SQL_HOLD");
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY|ERASURE_DISPOSAL_CONFLICT/);
    expect((await state(own.uid)).accountErasures).toHaveLength(2);
  });
  it("refuses active owned communication/callable rows at the final database boundary", async () => {
    const own = await fixture();
    await dc.executeGraphql(`mutation ReappearedOwnedData($uid: String!) {
      callableInvocation_insert(data: {userId: $uid, functionName: "LOCAL_SQL_FIXTURE", windowStart: "2020-01-01T00:00:00Z", count: 1})
    }`, {variables: {uid: own.uid}});
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY/);
    expect((await state(own.uid)).accountErasures).toHaveLength(2);
  });
  it("serializes a concurrent new erasure through the same fence; stale Begin cannot insert after a successful purge", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const own = await fixture();
      const results = await Promise.allSettled([purge(own), startAccountErasure(own.uid, own.emails)]);
      expect(results[1].status).toBe("fulfilled");
      const retained = await state(own.uid);
      expect(retained.accountErasures.map((row: any) => row.emailHash).sort()).toEqual([...own.hashes].sort());
      expect(retained.accountErasures.every((row: any) => row.completedAt === null)).toBe(true);
      expect(retained.accountErasureDisposal.internalQuiescedAt).toBeNull();
      if (results[0].status === "fulfilled") expect(retained.accountErasureDisposal.generation.replaceAll("-", "")).not.toBe(own.generation.replaceAll("-", ""));
    }
  });
  it("serializes a concurrent explicit hold and purge: a successful hold always preserves every alias", async () => {
    const own = await fixture();
    const [disposal, hold] = await Promise.allSettled([purge(own), setAccountErasureDisposalHold(own.uid, own, "OPERATOR_REVIEW", new Date(Date.now() + 60_000).toISOString())]);
    expect([disposal, hold].filter(result => result.status === "fulfilled")).toHaveLength(1);
    const observed = await state(own.uid);
    if (hold.status === "fulfilled") {
      expect(observed.accountErasures).toHaveLength(2);
      expect(observed.accountErasureDisposal.holdCode).toBe("OPERATOR_REVIEW");
    } else expect(observed).toEqual({accountErasures: [], accountErasureDisposal: null});
  });
  it("accepts a full reviewed decision snapshot when setting a versioned hold without forwarding undeclared fields", async () => {
    const own = await fixture();
    const reviewed = await readAccountErasureDisposal(own.uid);
    await setAccountErasureDisposalHold(own.uid, reviewed!, "EXTERNAL_COPY", new Date(Date.now() + 60_000).toISOString());
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY|ERASURE_DISPOSAL_CONFLICT/);
    expect((await state(own.uid)).accountErasureDisposal).toMatchObject({version: 8, holdCode: "EXTERNAL_COPY"});
  });
  it("serializes a concurrent global replay hold with disposal using the reviewed policy version", async () => {
    const own = await fixture();
    const [disposal, hold] = await Promise.allSettled([purge(own), setAccountErasureDisposalPolicy(1, false, "LOCAL_SQL_HOLD")]);
    expect(hold.status).toBe("fulfilled");
    if (disposal.status === "fulfilled") expect((await state(own.uid)).accountErasures).toHaveLength(0);
    else expect((await state(own.uid)).accountErasures).toHaveLength(2);
  });
  it("captures task/provider quiescence only for a verified new completion", async () => {
    const own = await fixture();
    await startAccountErasure(own.uid, own.emails);
    await completeAccountErasure(own.uid, {communicationsQuiesced: true});
    const observed = await state(own.uid);
    const evidence = await readAccountErasureDisposal(own.uid);
    expect(evidence!.holdCode).toBeNull();
    expect(evidence!.internalQuiescedAt).toBe(observed.accountErasures[0].completedAt);
    expect(evidence!.taskSafeAt).toBe(evidence!.internalQuiescedAt);
    expect(Date.parse(evidence!.providerSafeAt!) - Date.parse(evidence!.internalQuiescedAt!)).toBe(30 * 24 * 60 * 60 * 1000);
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY|ERASURE_DISPOSAL_CONFLICT/);
  });
  it("keeps historical early recovery held and does not fabricate cancellation evidence", async () => {
    const own = await fixture();
    await completeAccountErasure(own.uid);
    const evidence = await readAccountErasureDisposal(own.uid);
    expect(evidence).toMatchObject({holdCode: "HISTORICAL_EVIDENCE_REQUIRED", internalQuiescedAt: null, taskSafeAt: null, providerSafeAt: null});
    await expect(purge(own)).rejects.toThrow(/ERASURE_DISPOSAL_NOT_READY|ERASURE_DISPOSAL_CONFLICT/);
  });
  it("locks completion against disposal and leaves no recreated UID decision if disposal already won", async () => {
    const own = await fixture();
    await purge(own);
    await expect(completeAccountErasure(own.uid)).rejects.toThrow("ERASURE_STATE_MISSING");
    expect(await state(own.uid)).toEqual({accountErasures: [], accountErasureDisposal: null});
  });
});
