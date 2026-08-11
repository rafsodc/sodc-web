import { toUserFacingError, type UserFacingError } from "./errorHandling";

export type AdminErrorContext =
  | "users"
  | "user-approval"
  | "admin-claims"
  | "user-groups"
  | "sections"
  | "events"
  | "tickets"
  | "guest-moderation"
  | "booking-approval"
  | "files"
  | "announcements"
  | "email-configuration"
  | "payment-reconciliation"
  | "audit-logs";

const CONTEXT_MESSAGES: Record<AdminErrorContext, string> = {
  users: "We could not complete the user operation. Please try again.",
  "user-approval": "We could not complete the approval operation. Please refresh and try again.",
  "admin-claims": "We could not update administrator access. Please refresh and try again.",
  "user-groups": "We could not complete the user group operation. Please refresh and try again.",
  sections: "We could not complete the section operation. Please refresh and try again.",
  events: "We could not complete the event operation. Please refresh and try again.",
  tickets: "We could not complete the ticket operation. Please refresh and try again.",
  "guest-moderation": "We could not review the guest request. Please refresh and try again.",
  "booking-approval": "We could not review this booking revision. Refresh to load the latest revision and try again.",
  files: "We could not complete the file operation. Please refresh and try again.",
  announcements: "We could not complete the announcement operation. Please try again.",
  "email-configuration": "We could not complete the email configuration operation. Please try again.",
  "payment-reconciliation": "We could not complete the payment reconciliation operation. Please refresh and try again.",
  "audit-logs": "We could not load the audit logs. Please try again.",
};

/** Maps an administration failure without exposing provider or server messages. */
export function toAdminUserFacingError(error: unknown, context: AdminErrorContext): UserFacingError {
  const mapped = toUserFacingError(error);
  if (mapped.category !== "unknown") return mapped;
  return {
    ...mapped,
    title: "Administration operation failed",
    message: CONTEXT_MESSAGES[context],
  };
}
