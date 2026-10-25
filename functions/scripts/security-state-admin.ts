#!/usr/bin/env node
import * as admin from "firebase-admin";
import { getUserMembershipStatus } from "@dataconnect/admin-generated";
import { getUserSecurityState, getAdminSafetyControl, listReadyAdministrators } from "../src/securityRepository";
import { initializeUserSecurityState, transitionUserSecurity, repairUserSecurity, bootstrapAdminSafetyControl, activateAdminSafetyControl, reconcileAdminSafetyControl } from "../src/currentAuthorizationTransitions";

import { parseSecurityAdminArguments } from "../src/securityAdminArguments";

async function main() {
  const options = parseSecurityAdminArguments(process.argv.slice(2));
  admin.initializeApp({projectId: options.projectId});
  const [control, roster] = await Promise.all([getAdminSafetyControl(), listReadyAdministrators()]);
  console.log(JSON.stringify({control: control.data.adminSafetyControl, readyAdministratorIds: roster.data.userSecurityStates.map(state => state.userId), apply: options.apply}));
  if (options.mode.startsWith("control-")) {
    if (!options.all) throw new Error("Control audit requires --all");
    if (options.apply) {
      const request = {operationId: options.operationId!, actorId: options.actorId, reason: options.reason};
      if (options.mode === "control-create" || options.mode === "control-create-recovery") {
        await bootstrapAdminSafetyControl({...request, recoverObservedDrift: options.mode === "control-create-recovery"});
      } else {
        const action = options.mode === "control-activate" ? activateAdminSafetyControl : reconcileAdminSafetyControl;
        await action(request);
      }
    }
    return;
  }
  let cursor: string | undefined;
  do {
    const page = options.userId
      ? {users: [await admin.auth().getUser(options.userId)], pageToken: undefined}
      : await admin.auth().listUsers(500, cursor);
    for (const authUser of page.users) {
      const state = (await getUserSecurityState({userId: authUser.uid})).data.userSecurityState;
      const drift = !state || state.syncStatus !== "READY" || state.securityVersion !== authUser.customClaims?.securityVersion ||
        state.desiredEnabled !== authUser.customClaims?.enabled || state.desiredAdmin !== authUser.customClaims?.admin ||
        state.membershipStatus !== state.user.membershipStatus || (state.accessReady && (authUser.disabled || !authUser.emailVerified));
      // Report UID and classifications only, never emails, credentials, claims or tokens.
      console.log(JSON.stringify({userId: authUser.uid, mode: options.mode, exists: Boolean(state), drift, apply: options.apply,
        securityVersion: state?.securityVersion ?? null, syncStatus: state?.syncStatus ?? null,
        accessReady: state?.accessReady === true, adminReady: state?.adminReady === true,
        accountDisabled: authUser.disabled, verificationRequired: !authUser.emailVerified || Boolean(state?.verificationEmail)}));
      if (!options.apply) continue;
      if (options.mode === "bootstrap") {
        if (!(await getUserMembershipStatus({id: authUser.uid})).data.user) continue;
        await initializeUserSecurityState({userId: authUser.uid, actorId: options.actorId, reason: options.reason, actorKind: "OPERATOR", operationId: options.operationId! + ":" + authUser.uid, allowAdminBootstrap: options.importAdmins});
      } else if (options.mode === "repair") {
        if (state) await repairUserSecurity({userId: authUser.uid, actorId: options.actorId, actorKind: "OPERATOR", reason: options.reason, operationId: options.operationId! + ":" + authUser.uid});
      } else {
        await transitionUserSecurity({userId: authUser.uid, actorId: options.actorId, reason: options.reason, actorKind: "OPERATOR", operationId: options.operationId! + ":" + authUser.uid,
          ...(options.mode === "release-verification" ? {releaseEmailVerification: true} : {}),
          ...(options.mode === "grant-admin" ? {admin: true} : options.mode === "revoke-admin" ? {admin: false} : {}),
          ...(options.mode === "disable" ? {authDisabled: true} : options.mode === "enable" ? {authDisabled: false} : {})});
      }
    }
    cursor = page.pageToken;
  } while (cursor);
}
if (require.main === module) void main().catch(() => {console.error("Security operation incomplete; inspect durable pending state and retry the same intent"); process.exitCode = 1;});
