import { describe, expect, it } from "vitest";
import { evaluateAuthority } from "./authorization-migration-audit.mjs";

function fixture(uid = "administrator") {
  return {
    identity: { uid, email: "private@example.invalid", disabled: false, emailVerified: true,
      customClaims: { enabled: true, admin: true, securityVersion: 7, secret: "never-output" } },
    profile: { id: uid, membershipStatus: "REGULAR", email: "private@example.invalid" },
    state: { userId: uid, securityVersion: 7, membershipStatus: "REGULAR", desiredEnabled: true, desiredAdmin: true,
      accessReady: true, adminReady: true, syncStatus: "READY", verificationEmail: null, user: { membershipStatus: "REGULAR" } },
  };
}

function input() {
  const item = fixture();
  return { identities: [item.identity], profiles: [item.profile], states: [item.state], pendingTransitions: [],
    control: { id: "site-wide", status: "READY", version: 15, readyAdminCount: 1 }, requireBackfill: true };
}

describe("pure migration authority audit", () => {
  it("validates an arbitrary initialized roster and emits only aggregate public data", () => {
    const value = input();
    const result = evaluateAuthority(value);
    expect(result).toMatchObject({ passed: true, backfillComplete: true, controlReady: true,
      counts: { identities: 1, initializedAttachedProfiles: 1, readyAdministrators: 1 } });
    const { private: protectedEvidence, ...publicReport } = result;
    expect(JSON.stringify(publicReport)).not.toMatch(/administrator|private@example|never-output|customClaims|verificationEmail/);
    expect(protectedEvidence.rosterFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(protectedEvidence.eligibleLegacyAdminUIDs).toEqual([]);
  });

  it("identifies only missing-state eligible legacy admins and requires explicit backfill later", () => {
    const value = input();
    value.states = [];
    value.control = null;
    value.requireBackfill = false;
    const planned = evaluateAuthority(value);
    expect(planned).toMatchObject({ passed: true, backfillComplete: false, controlReady: false });
    expect(planned.private.eligibleLegacyAdminUIDs).toEqual(["administrator"]);
    expect(evaluateAuthority({ ...value, requireBackfill: true })).toMatchObject({ passed: false,
      violations: { missingAttachedStates: 1, missingControl: 1 } });
  });

  it("binds latent disabled/unverified legacy roles as well as immediately eligible grants", () => {
    const value = input();
    value.states = [];
    value.control = null;
    value.requireBackfill = false;
    const latent = fixture("latent-role");
    latent.identity.disabled = true;
    latent.identity.emailVerified = false;
    value.identities.push(latent.identity);
    value.profiles.push(latent.profile);
    const before = evaluateAuthority(value);
    expect(before.private.eligibleLegacyAdminUIDs).toEqual(["administrator"]);
    expect(before.private.legacyAdminUIDs).toEqual(["administrator", "latent-role"]);
    expect(before.counts.legacyAdministratorClaims).toBe(2);
    latent.identity.customClaims.admin = false;
    const after = evaluateAuthority(value);
    expect(after.private.eligibleLegacyAdminUIDs).toEqual(before.private.eligibleLegacyAdminUIDs);
    expect(after.private.legacyAdminFingerprint).not.toBe(before.private.legacyAdminFingerprint);
    expect(after.private.rosterFingerprint).not.toBe(before.private.rosterFingerprint);
  });

  it("accepts profileless onboarding identities and preserves an uninitialized orphan", () => {
    const value = input();
    value.identities.push({ uid: "onboarding-only", disabled: false, emailVerified: true });
    value.profiles.push({ id: "missing-auth", membershipStatus: "REGULAR" });
    expect(evaluateAuthority(value)).toMatchObject({ passed: true, backfillComplete: true,
      counts: { authWithoutProfiles: 1, orphanProfiles: 1, attachedProfiles: 1, states: 1 } });
  });

  it("never turns an active profile and newly enabled Auth into a grant", () => {
    const value = input();
    const denied = fixture("deliberately-denied");
    denied.identity.customClaims.enabled = false;
    Object.assign(denied.state, { desiredEnabled: false, accessReady: false, adminReady: false });
    value.identities.push(denied.identity);
    value.profiles.push(denied.profile);
    value.states.push(denied.state);
    expect(evaluateAuthority(value)).toMatchObject({ passed: true, counts: { intentionalDenials: 1, readyAdministrators: 1 } });
  });

  it.each(["private@example.invalid", "intended-new@example.invalid"])("preserves verified identity hold %s without releasing it", address => {
    const value = input();
    const held = fixture("held");
    held.identity.customClaims.enabled = false;
    Object.assign(held.state, { desiredEnabled: false, accessReady: false, adminReady: false, verificationEmail: address });
    value.identities.push(held.identity);
    value.profiles.push(held.profile);
    value.states.push(held.state);
    expect(evaluateAuthority(value)).toMatchObject({ passed: true, counts: { verificationHolds: 1, intentionalDenials: 1 } });
  });

  it("accepts a fully denied orphan left by supported deleted-identity reconciliation", () => {
    const value = input();
    const orphan = fixture("deleted-auth");
    Object.assign(orphan.state, { desiredEnabled: false, accessReady: false, adminReady: false });
    value.profiles.push(orphan.profile);
    value.states.push(orphan.state);
    expect(evaluateAuthority(value)).toMatchObject({ passed: true, counts: { deniedOrphanStates: 1 } });
  });

  it.each([
    ["unverified", value => { value.identities[0].emailVerified = false; }, "grantWithoutUsableIdentity"],
    ["disabled", value => { value.identities[0].disabled = true; }, "grantWithoutUsableIdentity"],
    ["missing Auth", value => { value.identities = []; }, "grantWithoutUsableIdentity"],
    ["held grant", value => { value.states[0].verificationEmail = "held@example.invalid"; }, "grantWithoutUsableIdentity"],
    ["stale token mirror", value => { value.identities[0].customClaims.securityVersion = 6; }, "authMirrorMismatch"],
    ["membership drift", value => { value.profiles[0].membershipStatus = "LOST"; }, "membershipMismatch"],
    ["malformed flag", value => { value.states[0].desiredAdmin = undefined; }, "malformedFlags"],
    ["version", value => { value.states[0].securityVersion = NaN; }, "invalidVersions"],
    ["pending state", value => { value.states[0].syncStatus = "PENDING"; }, "nonReadyStates"],
    ["foreign UID", value => { value.states[0].userId = "foreign"; }, "statesWithoutProfiles"],
    ["counter drift", value => { value.control.readyAdminCount = 2; }, "controlCountMismatch"],
    ["duplicate identity", value => { value.identities.push(value.identities[0]); }, "malformedOrDuplicateRows"],
  ])("rejects %s", (_name, change, violation) => {
    const value = input();
    change(value);
    const result = evaluateAuthority(value);
    expect(result.passed).toBe(false);
    expect(result.violations[violation]).toBeGreaterThan(0);
  });

  it("requires no pending work and distinguishes BOOTSTRAP from ready activation", () => {
    const value = input();
    value.control.status = "BOOTSTRAP";
    expect(evaluateAuthority(value)).toMatchObject({ passed: true, backfillComplete: true, controlReady: false });
    value.pendingTransitions = [{ operationId: "sensitive-operation" }];
    expect(evaluateAuthority(value)).toMatchObject({ passed: false, violations: { pendingTransitions: 1 } });
    value.pendingTransitions = [];
    value.control.status = "READY";
    value.control.readyAdminCount = 0;
    expect(evaluateAuthority(value)).toMatchObject({ passed: false, violations: { readyControlWithoutAdministrator: 1 } });
  });

  it("fingerprints are stable across row/property order and change with a ready administrator version", () => {
    const value = input();
    const second = fixture("second");
    value.identities.push(second.identity);
    value.profiles.push(second.profile);
    value.states.push(second.state);
    value.control.readyAdminCount = 2;
    const before = evaluateAuthority(value).private.rosterFingerprint;
    const reordered = { ...value, identities: new Map(value.identities.toReversed().map(row => [row.uid, row])),
      states: new Map(value.states.toReversed().map(row => [row.userId, Object.fromEntries(Object.entries(row).reverse())])) };
    expect(evaluateAuthority(reordered).private.rosterFingerprint).toBe(before);
    second.state.securityVersion++;
    second.identity.customClaims.securityVersion++;
    expect(evaluateAuthority(value).private.rosterFingerprint).not.toBe(before);
  });
});
