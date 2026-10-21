#!/usr/bin/env node
import * as admin from "firebase-admin";
import { getUserMembershipStatus } from "@dataconnect/admin-generated";
import { getUserSecurityState } from "../src/securityRepository";
import { initializeUserSecurityState, transitionUserSecurity, synchronizeUserSecurity } from "../src/currentAuthorizationTransitions";

import { parseSecurityAdminArguments } from "../src/securityAdminArguments";

async function main() {
  const options = parseSecurityAdminArguments(process.argv.slice(2));
  admin.initializeApp({projectId: options.projectId});
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
        await initializeUserSecurityState({userId: authUser.uid, actorId: options.actorId, reason: options.reason, allowAdminBootstrap: options.importAdmins});
      } else if (options.mode === "repair") {
        if (state) await synchronizeUserSecurity(state.operationId);
      } else {
        await transitionUserSecurity({userId: authUser.uid, actorId: options.actorId, reason: options.reason,
          ...(options.mode === "disable" ? {authDisabled: true} : options.mode === "enable" ? {authDisabled: false} : {})});
      }
    }
    cursor = page.pageToken;
  } while (cursor);
}
if (require.main === module) void main().catch(() => {console.error("Security operation incomplete; inspect durable pending state and retry the same intent"); process.exitCode = 1;});
