export const deleteInactiveAccountMutation = `mutation DeleteInactiveAccount($uid: String!, $email: String!, $operationId: String!, $actorId: String!, $actorVersion: Int!, $targetVersion: Int!, $emailHashes: [String!]!) @transaction {
      query @redact @check(expr: "response.query.suppression.size() > 0 && response.query.suppression.size() < 1001 && response.query.suppression.all(e, e.startedAt <= request.time - duration('330s')) && response.query.notifications.size() < 10001 && response.query.notifications.all(n, n.status != 'PENDING' || (n.lastAttemptedAt != null ? n.lastAttemptedAt : n.createdAt) <= request.time - duration('600s')) && response.query.announcements.size() < 10001 && response.query.announcements.all(a, !(a.status in ['sending','retrying','delivery_unknown']) || (a.processingStartedAt != null ? a.processingStartedAt : (a.deliveryStatusUpdatedAt != null ? a.deliveryStatusUpdatedAt : a.announcementSend.sentAt)) <= request.time - duration('120s')) && response.query.snapshots.size() == 0", message: "ERASURE_DRAIN_PENDING") {
        suppression: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {startedAt}
        notifications: notificationDeliveries(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]}, limit: 10001) {status lastAttemptedAt createdAt}
        announcements: announcementRecipients(where: {userId: {eq: $uid}}, limit: 10001) {status processingStartedAt deliveryStatusUpdatedAt announcementSend {sentAt}}
        snapshots: announcementSends(where: {recipientSnapshot: {contains: $uid}}, limit: 1) {id}
      }
      actor: userSecurityState_updateMany(where: {userId: {eq: $actorId}, securityVersion: {eq: $actorVersion}, adminReady: {eq: true}, accessReady: {eq: true}, syncStatus: {eq: READY}}, data: {adminReady: true}) @check(expr: "this == 1", message: "SECURITY_ACTOR_REVOKED")
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
  actor: userSecurityState_updateMany(where: {userId: {eq: $actorId}, securityVersion: {eq: $actorVersion}, adminReady: {eq: true}, accessReady: {eq: true}, syncStatus: {eq: READY}}, data: {adminReady: true}) @check(expr: "this == 1", message: "SECURITY_ACTOR_REVOKED")
}`;


export const deleteErasedCommunicationMutation = `mutation DeleteErasedCommunication($uid: String!, $actorId: String!, $actorVersion: Int!, $emailHashes: [String!]!) @transaction {
  query @redact @check(expr: "response.query.profile == null && response.query.suppression.size() > 0 && response.query.suppression.size() < 1001 && response.query.suppression.all(e, e.profileDeletedAt != null && e.startedAt <= request.time - duration('330s')) && response.query.notifications.size() < 10001 && response.query.notifications.all(n, n.status != 'PENDING' || (n.lastAttemptedAt != null ? n.lastAttemptedAt : n.createdAt) <= request.time - duration('600s')) && response.query.announcements.size() < 10001 && response.query.announcements.all(a, !(a.status in ['sending','retrying','delivery_unknown']) || (a.processingStartedAt != null ? a.processingStartedAt : (a.deliveryStatusUpdatedAt != null ? a.deliveryStatusUpdatedAt : a.announcementSend.sentAt)) <= request.time - duration('120s')) && response.query.snapshots.size() == 0", message: "ERASURE_RECOVERY_NOT_READY") {
    profile: user(id: $uid) {id}
    suppression: accountErasures(where: {userId: {eq: $uid}}, limit: 1001) {startedAt profileDeletedAt}
        notifications: notificationDeliveries(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]}, limit: 10001) {status lastAttemptedAt createdAt}
        announcements: announcementRecipients(where: {userId: {eq: $uid}}, limit: 10001) {status processingStartedAt deliveryStatusUpdatedAt announcementSend {sentAt}}
        snapshots: announcementSends(where: {recipientSnapshot: {contains: $uid}}, limit: 1) {id}
  }
  actor: userSecurityState_updateMany(where: {userId: {eq: $actorId}, securityVersion: {eq: $actorVersion}, adminReady: {eq: true}, accessReady: {eq: true}, syncStatus: {eq: READY}}, data: {adminReady: true}) @check(expr: "this == 1", message: "SECURITY_ACTOR_REVOKED")
  announcementRecipient_deleteMany(where: {userId: {eq: $uid}})
  notificationDelivery_deleteMany(where: {_or: [{userId: {eq: $uid}}, {recipientUserId: {eq: $uid}}]})
  notifyDeliveryReceipt_deleteMany(where: {_or: [{userId: {eq: $uid}}, {userId: {isNull: true}, recipientHash: {in: $emailHashes}}]})
  callableInvocation_deleteMany(where: {userId: {eq: $uid}})
  callableRateLimitBucket_deleteMany(where: {userId: {eq: $uid}})
}`;
