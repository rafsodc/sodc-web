/**
 * Application route definitions
 */

export const ROUTES = {
  HOME: "/",
  ACCOUNT: "/account",
  ACCOUNT_SETTINGS: "/account/settings",
  PROFILE: "/profile",
  PERMISSIONS: "/admin/permissions",
  MANAGE_USERS: "/admin/users",
  APPROVE_USERS: "/admin/users/approvals",
  USER_GROUPS: "/admin/user-groups",
  AUDIT_LOGS: "/admin/audit-logs",
  PAYMENT_RECONCILIATION: "/admin/payments/reconciliation",
  MY_PAYMENTS: "/payments",
  MY_BOOKINGS: "/bookings",
  SECTIONS: "/sections",
  SECTION_DETAIL: "/sections/:sectionId",
  MANAGE_SECTIONS: "/admin/sections",
  EMAIL_TEMPLATES: "/admin/email-templates",
  REGISTER: "/register",
  PROFILE_COMPLETION: "/profile-completion",
} as const;

/**
 * Route type
 */
export type Route = typeof ROUTES[keyof typeof ROUTES];

