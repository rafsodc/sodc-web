const adminErasureActorFence = "actor: userSecurityState_updateMany(where: {userId: {eq: $actorId}, securityVersion: {eq: $actorVersion}, adminReady: {eq: true}, accessReady: {eq: true}, syncStatus: {eq: READY}}, data: {adminReady: true}) @check(expr: \"this == 1\", message: \"SECURITY_ACTOR_REVOKED\")";

// The signed-in member authorized this immutable intent before access was
// disabled. Completion must follow that exact SELF hold, never a disabled flag.
const selfErasureAuthorityCheck = "@check(expr: \"vars.actorId == vars.uid && response.query.selfState != null && response.query.selfState.operationId == vars.operationId && response.query.selfState.securityVersion == vars.targetVersion && response.query.selfState.syncStatus == 'READY' && !response.query.selfState.desiredEnabled && !response.query.selfState.accessReady && !response.query.selfState.desiredAdmin && !response.query.selfState.adminReady && response.query.selfState.membershipStatus == 'RESIGNED' && response.query.selfState.user.membershipStatus == 'RESIGNED' && response.query.selfIntent != null && response.query.selfIntent.userId == vars.uid && response.query.selfIntent.actorId == vars.uid && response.query.selfIntent.actorKind == 'SELF' && response.query.selfIntent.actorSecurityVersion == vars.actorVersion && response.query.selfIntent.securityVersion == vars.targetVersion && response.query.selfIntent.reason == 'ACCOUNT_DELETION' && response.query.selfIntent.authDisabled == true && response.query.selfIntent.syncStatus == 'READY' && !response.query.selfIntent.desiredEnabled && !response.query.selfIntent.desiredAdmin && response.query.selfIntent.membershipStatus == 'RESIGNED'\", message: \"SELF_ERASURE_AUTHORITY_CHANGED\")";
const selfErasureAuthoritySelection = `  selfState: userSecurityState(key: {userId: $uid}) {operationId securityVersion syncStatus desiredEnabled accessReady desiredAdmin adminReady membershipStatus user {membershipStatus}}
  selfIntent: securityTransition(key: {operationId: $operationId}) {userId actorId actorKind actorSecurityVersion securityVersion reason authDisabled syncStatus desiredEnabled desiredAdmin membershipStatus}`;

const selfErasureSnapshotLock = "selfAuthority: userSecurityState_updateMany(where: {userId: {eq: $actorId}, operationId: {eq: $operationId}, securityVersion: {eq: $targetVersion}, syncStatus: {eq: READY}, membershipStatus: {eq: RESIGNED}, desiredEnabled: {eq: false}, accessReady: {eq: false}, desiredAdmin: {eq: false}, adminReady: {eq: false}}, data: {accessReady: false}) @check(expr: \"this == 1\", message: \"SELF_ERASURE_AUTHORITY_CHANGED\")";

export const deleteInactiveAccountMutation = `mutation DeleteInactiveAccount($uid: String!, $email: String!, $operationId: String!, $actorId: String!, $actorVersion: Int!, $targetVersion: Int!, $emailHashes: [String!]!) @transaction {
      query @redact @check(expr: "response.query.suppression.size() > 0 && response.query.suppression.size() < 1001 && response.query.suppression.all(e, e.startedAt <= request.time - duration('330s')) && response.query.notifications.size() < 10001 && response.query.notifications.all(n, n.status != 'PENDING' || (n.lastAttemptedAt != null ? n.lastAttemptedAt : n.createdAt) <= request.time - duration('600s')) && response.query.announcements.size() < 10001 && response.query.announcements.all(a, !(a.status in ['sending','retrying','delivery_unknown']) || (a.processingStartedAt != null ? a.processingStartedAt : (a.deliveryStatusUpdatedAt != null ? a.deliveryStatusUpdatedAt : a.announcementSend.sentAt)) <= request.time - duration('120s')) && response.query.snapshots.size() == 0", message: "ERASURE_DRAIN_PENDING") {
        suppression: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {startedAt}
        notifications: notificationDeliveries(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]}, limit: 10001) {status lastAttemptedAt createdAt}
        announcements: announcementRecipients(where: {userId: {eq: $uid}}, limit: 10001) {status processingStartedAt deliveryStatusUpdatedAt announcementSend {sentAt}}
        snapshots: announcementSends(where: {recipientSnapshot: {contains: $uid}}, limit: 1) {id}
      }
      ${adminErasureActorFence}
      fence: userSecurityState_deleteMany(where: {userId: {eq: $uid}, operationId: {eq: $operationId}, securityVersion: {eq: $targetVersion}, syncStatus: {eq: READY}, desiredAdmin: {eq: false}, adminReady: {eq: false}, accessReady: {eq: false}}) @check(expr: "this == 1", message: "ACCOUNT_CHANGED")
      legacyUserIdentity_deleteMany(where: {userId: {eq: $uid}})
      userUserGroup_deleteMany(where: {userId: {eq: $uid}})
      sectionAnnouncementOptOut_deleteMany(where: {userId: {eq: $uid}})
      callableInvocation_deleteMany(where: {userId: {eq: $uid}})
      callableRateLimitBucket_deleteMany(where: {userId: {eq: $uid}})
      securityTransition_deleteMany(where: {userId: {eq: $uid}})
      announcementRecipient_deleteMany(where: {userId: {eq: $uid}})
      notificationDelivery_deleteMany(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]})
      notifyDeliveryReceipt_deleteMany(where: {_or: [{userId: {eq: $uid}}, {userId: {isNull: true}, recipientHash: {in: $emailHashes}}]})
      accountErasure_updateMany(where: {userId: {eq: $uid}}, data: {profileDeletedAt_expr: "request.time"}) @check(expr: "this > 0", message: "ERASURE_STATE_MISSING")
      user_deleteMany(where: {id: {eq: $uid}, email: {eq: $email}}) @check(expr: "this == 1", message: "ACCOUNT_CHANGED")
    }`;


export const redactAccountSnapshotMutation = `mutation RedactAccountSnapshot($uid: String!, $actorId: String!, $actorVersion: Int!) @transaction {
  query @redact @check(expr: "response.query.suppression.size() > 0 && response.query.suppression.size() < 1001 && response.query.suppression.all(e, e.startedAt <= request.time - duration('330s'))", message: "ERASURE_DRAIN_PENDING") {
    suppression: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {startedAt}
  }
  ${adminErasureActorFence}
}`;


export const deleteErasedCommunicationMutation = `mutation DeleteErasedCommunication($uid: String!, $actorId: String!, $actorVersion: Int!, $emailHashes: [String!]!) @transaction {
  query @redact @check(expr: "response.query.profile == null && response.query.suppression.size() > 0 && response.query.suppression.size() < 1001 && response.query.suppression.all(e, e.profileDeletedAt != null && e.startedAt <= request.time - duration('330s')) && response.query.notifications.size() < 10001 && response.query.notifications.all(n, n.status != 'PENDING' || (n.lastAttemptedAt != null ? n.lastAttemptedAt : n.createdAt) <= request.time - duration('600s')) && response.query.announcements.size() < 10001 && response.query.announcements.all(a, !(a.status in ['sending','retrying','delivery_unknown']) || (a.processingStartedAt != null ? a.processingStartedAt : (a.deliveryStatusUpdatedAt != null ? a.deliveryStatusUpdatedAt : a.announcementSend.sentAt)) <= request.time - duration('120s')) && response.query.snapshots.size() == 0", message: "ERASURE_RECOVERY_NOT_READY") {
    profile: user(id: $uid) {id}
    suppression: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {startedAt profileDeletedAt}
        notifications: notificationDeliveries(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]}, limit: 10001) {status lastAttemptedAt createdAt}
        announcements: announcementRecipients(where: {userId: {eq: $uid}}, limit: 10001) {status processingStartedAt deliveryStatusUpdatedAt announcementSend {sentAt}}
        snapshots: announcementSends(where: {recipientSnapshot: {contains: $uid}}, limit: 1) {id}
  }
  ${adminErasureActorFence}
  announcementRecipient_deleteMany(where: {userId: {eq: $uid}})
  notificationDelivery_deleteMany(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]})
  notifyDeliveryReceipt_deleteMany(where: {_or: [{userId: {eq: $uid}}, {userId: {isNull: true}, recipientHash: {in: $emailHashes}}]})
  callableInvocation_deleteMany(where: {userId: {eq: $uid}})
  callableRateLimitBucket_deleteMany(where: {userId: {eq: $uid}})
}`;


// Data Connect supports one query selection per mutation. Merge the self hold
// evidence into the existing drain query instead of adding a sibling query.
function withSelfErasureAuthority(mutation: string, lockSnapshot: boolean): string {
  return mutation
    .replace("query @redact", `query @redact ${selfErasureAuthorityCheck}`)
    .replace("suppression: accountErasures", `${selfErasureAuthoritySelection}\nsuppression: accountErasures`)
    .replace(adminErasureActorFence, lockSnapshot ? selfErasureSnapshotLock : "");
}

// Same drain, ownership, snapshot and profile fences as administrator deletion;
// only the authority is the member's exact committed deletion hold. The final
// CAS delete locks the target row; snapshots need their own no-op row lock.
export const deleteMyInactiveAccountMutation = withSelfErasureAuthority(deleteInactiveAccountMutation, false)
  .replace("mutation DeleteInactiveAccount", "mutation DeleteMyInactiveAccount");
export const redactMyAccountSnapshotMutation = withSelfErasureAuthority(redactAccountSnapshotMutation, true)
  .replace("mutation RedactAccountSnapshot($uid: String!, $actorId: String!, $actorVersion: Int!)", "mutation RedactMyAccountSnapshot($uid: String!, $actorId: String!, $actorVersion: Int!, $operationId: String!, $targetVersion: Int!)");
