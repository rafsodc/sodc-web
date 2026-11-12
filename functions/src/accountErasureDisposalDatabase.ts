export const erasureDisposalSelection = "userId generation version internalQuiescedAt taskSafeAt providerSafeAt evidenceReference holdCode reviewDueAt nextAttemptAt lastReason updatedAt";

// Every lifecycle writer takes the same generation/version row lock. No writer
// may insert an alias after this checked write fails, including after disposal.
export function erasureDisposalFenceWithData(fields = ""): string {
  return `fence: accountErasureDisposal_updateMany(where: {userId: {eq: $uid}, generation: {eq: $generation}, version: {eq: $version}}, data: {version_update: {inc: 1}, updatedAt_expr: "request.time"${fields ? `, ${fields}` : ""}}) @check(expr: "this == 1", message: "ERASURE_DISPOSAL_CONFLICT")`;
}
export const erasureDisposalFence = erasureDisposalFenceWithData();

export const erasureDisposalAbsenceSelection = `
  profile: user(id: $uid) {id}
  state: userSecurityState(key: {userId: $uid}) {userId}
  intents: securityTransitions(where: {userId: {eq: $uid}}, limit: 1) {operationId}
  notifications: notificationDeliveries(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]}, limit: 1) {id}
  announcements: announcementRecipients(where: {userId: {eq: $uid}}, limit: 1) {id}
  receipts: notifyDeliveryReceipts(where: {_or: [{userId: {eq: $uid}}, {userId: {isNull: true}, recipientHash: {in: $hashes}}]}, limit: 1) {id}
  snapshots: announcementSends(where: {recipientSnapshot: {contains: $uid}}, limit: 1) {id}
  invocations: callableInvocations(where: {userId: {eq: $uid}}, limit: 1) {userId}
  buckets: callableRateLimitBuckets(where: {userId: {eq: $uid}}, limit: 1) {userId}`;
export const erasureDisposalAbsenceCheck = "response.query.profile == null && response.query.state == null && response.query.intents.size() == 0 && response.query.notifications.size() == 0 && response.query.announcements.size() == 0 && response.query.receipts.size() == 0 && response.query.snapshots.size() == 0 && response.query.invocations.size() == 0 && response.query.buckets.size() == 0";

export const purgeAccountErasureMutation = `mutation DisposeAccountErasure($uid: String!, $generation: UUID!, $version: Int!, $policyVersion: Int!, $hashes: [String!]!, $count: Int!, $completedAt: Timestamp!, $profileDeletedAt: Timestamp!) @transaction {
  query @redact @check(expr: "response.query.decision != null && response.query.decision.generation == vars.generation && response.query.decision.version == vars.version && response.query.decision.holdCode == null && response.query.decision.internalQuiescedAt != null && response.query.decision.taskSafeAt != null && response.query.decision.taskSafeAt <= request.time && response.query.decision.providerSafeAt != null && response.query.decision.providerSafeAt <= request.time && response.query.policy != null && response.query.policy.version == vars.policyVersion && response.query.policy.externalReplayReviewed && response.query.markers.size() > 0 && response.query.markers.size() < 1001 && response.query.markers.size() == vars.count && response.query.markers.all(e, e.emailHash in vars.hashes && e.completedAt != null && e.profileDeletedAt != null && e.completedAt <= vars.completedAt && e.profileDeletedAt <= vars.profileDeletedAt && e.completedAt <= response.query.decision.internalQuiescedAt && response.query.decision.providerSafeAt >= e.completedAt + duration('2592000s') && e.completedAt <= request.time - duration('2592000s') && e.profileDeletedAt <= request.time - duration('2592000s')) && ${erasureDisposalAbsenceCheck}", message: "ERASURE_DISPOSAL_NOT_READY") {
    decision: accountErasureDisposal(key: {userId: $uid}) {generation version holdCode internalQuiescedAt taskSafeAt providerSafeAt}
    policy: accountErasureDisposalPolicy(key: {id: "site-wide"}) {version externalReplayReviewed}
    markers: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {emailHash completedAt profileDeletedAt}
    ${erasureDisposalAbsenceSelection}
  }
  policyFence: accountErasureDisposalPolicy_updateMany(where: {id: {eq: "site-wide"}, version: {eq: $policyVersion}, externalReplayReviewed: {eq: true}}, data: {version: $policyVersion}) @check(expr: "this == 1", message: "ERASURE_DISPOSAL_CONFLICT")
  ${erasureDisposalFence}
  aliases: accountErasure_deleteMany(where: {userId: {eq: $uid}}) @check(expr: "this == vars.count", message: "ERASURE_DISPOSAL_CONFLICT")
  decisionDelete: accountErasureDisposal_deleteMany(where: {userId: {eq: $uid}, generation: {eq: $generation}}) @check(expr: "this == 1", message: "ERASURE_DISPOSAL_CONFLICT")
}`;
