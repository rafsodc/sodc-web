/**
 * Application route definitions
 */

export const ROUTES = {
  HOME: "home",
  ACCOUNT: "account",
  PROFILE: "profile",
  PERMISSIONS: "permissions",
  MANAGE_USERS: "manageUsers",
  APPROVE_USERS: "approveUsers",
  ACCESS_GROUPS: "accessGroups",
  AUDIT_LOGS: "auditLogs",
  SECTIONS: "sections",
  REGISTER: "register",
  PROFILE_COMPLETION: "profileCompletion",
} as const;

/**
 * Route type
 */
export type Route = typeof ROUTES[keyof typeof ROUTES];

