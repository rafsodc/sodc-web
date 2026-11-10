export const deleteInactiveAccountMutation = `mutation DeleteInactiveAccount($uid: String!, $email: String!, $operationId: String!, $actorId: String!, $actorVersion: Int!, $targetVersion: Int!) @transaction {
      actor: userSecurityState_updateMany(where: {userId: {eq: $actorId}, securityVersion: {eq: $actorVersion}, adminReady: {eq: true}, accessReady: {eq: true}, syncStatus: {eq: READY}}, data: {adminReady: true}) @check(expr: "this == 1", message: "SECURITY_ACTOR_REVOKED")
      fence: userSecurityState_deleteMany(where: {userId: {eq: $uid}, operationId: {eq: $operationId}, securityVersion: {eq: $targetVersion}, syncStatus: {eq: READY}, desiredAdmin: {eq: false}, adminReady: {eq: false}, accessReady: {eq: false}}) @check(expr: "this == 1", message: "ACCOUNT_CHANGED")
      legacyUserIdentity_deleteMany(where: {userId: {eq: $uid}})
      userUserGroup_deleteMany(where: {userId: {eq: $uid}})
      sectionAnnouncementOptOut_deleteMany(where: {userId: {eq: $uid}})
      callableInvocation_deleteMany(where: {userId: {eq: $uid}})
      callableRateLimitBucket_deleteMany(where: {userId: {eq: $uid}})
      securityTransition_deleteMany(where: {userId: {eq: $uid}})
      user_deleteMany(where: {id: {eq: $uid}, email: {eq: $email}}) @check(expr: "this == 1", message: "ACCOUNT_CHANGED")
    }`;
