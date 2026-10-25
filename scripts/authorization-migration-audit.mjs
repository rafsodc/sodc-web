import { stableHash } from "./authorization-migration-sources.mjs";

const ACTIVE = new Set(["REGULAR", "RETIRED", "RESERVE", "INDUSTRY", "CIVIL_SERVICE"]);
const MEMBERSHIPS = new Set([...ACTIVE, "PENDING", "RESIGNED", "LOST", "DECEASED"]);
const CONTROL_STATUSES = new Set(["BOOTSTRAP", "READY", "RECOVERY_REQUIRED"]);

function rows(value) {
  if (value instanceof Map) return [...value.values()];
  return Array.isArray(value) ? value : [];
}

function indexed(value, key, violations) {
  const result = new Map();
  for (const row of rows(value)) {
    if (!row || typeof row[key] !== "string" || !row[key].trim() || result.has(row[key])) {
      violations.malformedOrDuplicateRows++;
      continue;
    }
    result.set(row[key], row);
  }
  if (!(value instanceof Map) && !Array.isArray(value)) violations.malformedOrDuplicateRows++;
  return result;
}

/** Pure aggregate assessment. The `private` field must stay in the operator's protected plan. */
export function evaluateAuthority({ identities, profiles, states, pendingTransitions, control = null, requireBackfill = false }) {
  const violations = {
    malformedOrDuplicateRows: 0, statesWithoutProfiles: 0, missingAttachedStates: 0,
    invalidVersions: 0, invalidMemberships: 0, membershipMismatch: 0,
    nonReadyStates: 0, malformedFlags: 0, invalidVerificationHolds: 0,
    readyFlagMismatch: 0, grantWithoutUsableIdentity: 0, authMirrorMismatch: 0,
    pendingTransitions: 0, missingControl: 0, invalidControl: 0, controlCountMismatch: 0,
    readyControlWithoutAdministrator: 0, rosterOverAuditBound: 0,
  };
  const auth = indexed(identities, "uid", violations);
  const members = indexed(profiles, "id", violations);
  const authority = indexed(states, "userId", violations);
  const pending = typeof pendingTransitions === "number" ? pendingTransitions : rows(pendingTransitions).length;
  if ((!Array.isArray(pendingTransitions) && !(pendingTransitions instanceof Map) && typeof pendingTransitions !== "number") ||
      !Number.isSafeInteger(pending) || pending < 0) violations.malformedOrDuplicateRows++;
  else violations.pendingTransitions = pending;
  const counts = {
    identities: auth.size, profiles: members.size, states: authority.size,
    attachedProfiles: 0, initializedAttachedProfiles: 0, authWithoutProfiles: 0,
    orphanProfiles: 0, deniedOrphanStates: 0, readyAccess: 0, readyAdministrators: 0,
    intentionalDenials: 0, verificationHolds: 0, legacyAdministratorClaims: 0, eligibleLegacyAdministrators: 0,
    pendingTransitions: Number.isSafeInteger(pending) && pending >= 0 ? pending : 0,
  };
  const eligibleLegacyAdminUIDs = [];
  const legacyAdminUIDs = [];
  const legacyAdminIntents = [];
  for (const [uid, member] of members) {
    const identity = auth.get(uid);
    const state = authority.get(uid);
    if (!MEMBERSHIPS.has(member.membershipStatus)) violations.invalidMemberships++;
    if (!identity) counts.orphanProfiles++;
    else {
      counts.attachedProfiles++;
      if (state) counts.initializedAttachedProfiles++;
      else {
        if (requireBackfill) violations.missingAttachedStates++;
        if (identity.customClaims?.admin === true) {
          legacyAdminUIDs.push(uid);
          legacyAdminIntents.push({ userId: uid, membershipStatus: MEMBERSHIPS.has(member.membershipStatus) ? member.membershipStatus : null,
            disabled: typeof identity.disabled === "boolean" ? identity.disabled : null,
            emailVerified: typeof identity.emailVerified === "boolean" ? identity.emailVerified : null });
          if (ACTIVE.has(member.membershipStatus) && identity.disabled === false && identity.emailVerified === true) eligibleLegacyAdminUIDs.push(uid);
        }
      }
    }
  }
  for (const uid of auth.keys()) if (!members.has(uid)) counts.authWithoutProfiles++;
  const roster = [];
  for (const [uid, state] of authority) {
    const identity = auth.get(uid);
    const member = members.get(uid);
    if (!member) violations.statesWithoutProfiles++;
    if (!Number.isSafeInteger(state.securityVersion) || state.securityVersion < 1) violations.invalidVersions++;
    if (!MEMBERSHIPS.has(state.membershipStatus)) violations.invalidMemberships++;
    if (member && (state.membershipStatus !== member.membershipStatus ||
        (state.user?.membershipStatus !== undefined && state.user.membershipStatus !== member.membershipStatus) ||
        (state.user?.id !== undefined && state.user.id !== uid))) violations.membershipMismatch++;
    if (state.syncStatus !== "READY") violations.nonReadyStates++;
    const flags = [state.desiredEnabled, state.desiredAdmin, state.accessReady, state.adminReady];
    if (flags.some(flag => typeof flag !== "boolean")) violations.malformedFlags++;
    const hold = state.verificationEmail;
    const held = hold !== null && hold !== undefined;
    if (held) {
      counts.verificationHolds++;
      if (typeof hold !== "string" || !hold.trim() || hold !== hold.trim().toLowerCase()) violations.invalidVerificationHolds++;
    }
    if (state.accessReady !== state.desiredEnabled || state.adminReady !== (state.desiredEnabled === true && state.desiredAdmin === true)) violations.readyFlagMismatch++;
    const usable = Boolean(identity && member && ACTIVE.has(member.membershipStatus) && state.membershipStatus === member.membershipStatus &&
      identity.disabled === false && identity.emailVerified === true && !held);
    if ((state.desiredEnabled === true || state.accessReady === true || state.adminReady === true) && !usable) violations.grantWithoutUsableIdentity++;
    if (identity && (identity.customClaims?.securityVersion !== state.securityVersion || identity.customClaims?.enabled !== state.desiredEnabled || identity.customClaims?.admin !== state.desiredAdmin)) violations.authMirrorMismatch++;
    if (state.accessReady === true) counts.readyAccess++;
    if (state.adminReady === true) {
      counts.readyAdministrators++;
      roster.push({ userId: uid, securityVersion: Number.isSafeInteger(state.securityVersion) ? state.securityVersion : null,
        membershipStatus: MEMBERSHIPS.has(state.membershipStatus) ? state.membershipStatus : null,
        desiredEnabled: typeof state.desiredEnabled === "boolean" ? state.desiredEnabled : null,
        desiredAdmin: typeof state.desiredAdmin === "boolean" ? state.desiredAdmin : null,
        accessReady: typeof state.accessReady === "boolean" ? state.accessReady : null,
        adminReady: state.adminReady, syncStatus: state.syncStatus === "READY" ? "READY" : null,
        usable, mirrorCurrent: Boolean(identity && identity.customClaims?.securityVersion === state.securityVersion && identity.customClaims?.enabled === true && identity.customClaims?.admin === true) });
    }
    if (state.desiredEnabled === false && state.accessReady === false && state.adminReady === false) {
      counts.intentionalDenials++;
      if (!identity && member) counts.deniedOrphanStates++;
    }
  }
  if (counts.readyAdministrators > 1000) violations.rosterOverAuditBound++;
  if (!control) {
    if (requireBackfill) violations.missingControl++;
  } else {
    if ((control.id !== undefined && control.id !== "site-wide") || !CONTROL_STATUSES.has(control.status) ||
        !Number.isSafeInteger(control.version) || control.version < 1 ||
        !Number.isSafeInteger(control.readyAdminCount) || control.readyAdminCount < 0) violations.invalidControl++;
    if (control.readyAdminCount !== counts.readyAdministrators) violations.controlCountMismatch++;
    if (control.status === "READY" && control.readyAdminCount === 0) violations.readyControlWithoutAdministrator++;
  }
  eligibleLegacyAdminUIDs.sort();
  legacyAdminUIDs.sort();
  legacyAdminIntents.sort((left, right) => left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0);
  counts.legacyAdministratorClaims = legacyAdminUIDs.length;
  counts.eligibleLegacyAdministrators = eligibleLegacyAdminUIDs.length;
  roster.sort((left, right) => left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0);
  const passed = Object.values(violations).every(count => count === 0);
  return {
    passed, counts, violations,
    control: control ? { status: CONTROL_STATUSES.has(control.status) ? control.status : null,
      version: Number.isSafeInteger(control.version) ? control.version : null,
      readyAdminCount: Number.isSafeInteger(control.readyAdminCount) ? control.readyAdminCount : null } : null,
    backfillComplete: passed && counts.initializedAttachedProfiles === counts.attachedProfiles,
    controlReady: passed && control?.status === "READY" && counts.readyAdministrators > 0,
    private: { eligibleLegacyAdminUIDs, legacyAdminUIDs, legacyAdminFingerprint: stableHash(legacyAdminIntents),
      rosterFingerprint: stableHash({ roster, legacyAdminIntents }) },
  };
}
