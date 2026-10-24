import { isNonRestrictedStatus, isRestrictedStatus, type MembershipStatus } from "./validation";
import type { PaymentLifecycleNotification } from "./paymentNotifications";

export type MembershipStatusEmailKind = "activation" | "restricted";

export function bookingConfirmationDeliveryKey(bookingId: string, idempotencyKey: string): string {
  return `booking-confirm:${bookingId}:${idempotencyKey}`;
}

export function bookingRevisionDeliveryKey(bookingId: string, idempotencyKey: string): string {
  return `booking-revision:${bookingId}:${idempotencyKey}`;
}

export function bookingPendingMemberDeliveryKey(bookingId: string, idempotencyKey: string): string {
  return `booking-pending-member:${bookingId}:${idempotencyKey}`;
}

export function bookingPendingModeratorDeliveryKey(bookingId: string, moderatorEmail: string): string {
  return `booking-pending-mod:${bookingId}:${moderatorEmail.trim().toLowerCase()}`;
}

export function bookingPendingModeratorUidDeliveryKey(bookingId: string, recipientUserId: string): string {
  return `booking-pending-mod-v2:${bookingId}:${encodeURIComponent(recipientUserId)}`;
}

export function bookingChangesRequestedDeliveryKey(bookingId: string): string {
  return `booking-changes-requested:${bookingId}`;
}

export function bookingApprovedDeliveryKey(bookingId: string): string {
  return `booking-approved:${bookingId}`;
}


export function pendingApprovalDeliveryKey(userId: string, adminEmail: string): string {
  return `pending-approval:${userId}:${adminEmail}`;
}

export function pendingApprovalUidDeliveryKey(userId: string, recipientUserId: string): string {
  return `pending-approval-v2:${encodeURIComponent(userId)}:${encodeURIComponent(recipientUserId)}`;
}


export function paymentReconciliationOpsDeliveryKey(args: {
  orderId: string;
  exceptionType: string;
  stripeEventId: string;
  recipientEmail: string;
}): string {
  return `reconciliation-ops:${args.orderId}:${args.exceptionType}:${args.stripeEventId}:${args.recipientEmail}`;
}

export function paymentDisputeOpsDeliveryKey(args: {
  orderId: string;
  stripeEventId: string;
  recipientEmail: string;
}): string {
  return `dispute-ops:${args.orderId}:${args.stripeEventId}:${args.recipientEmail}`;
}


export function paymentLifecycleDeliveryKey(notification: PaymentLifecycleNotification): string {
  return `payment:${notification.orderId}:${notification.type}:${notification.stripeEventId}`;
}


/**
 * Determines whether a successful status update should trigger a user-facing email.
 */
export function classifyMembershipStatusEmailTransition(
  previousStatus: MembershipStatus | null,
  newStatus: MembershipStatus
): MembershipStatusEmailKind | null {
  if (previousStatus === newStatus) {
    return null;
  }
  const wasRestricted = previousStatus === null || isRestrictedStatus(previousStatus);
  const wasNonRestricted = previousStatus !== null && isNonRestrictedStatus(previousStatus);

  if (wasRestricted && isNonRestrictedStatus(newStatus)) {
    return "activation";
  }
  if (wasNonRestricted && isRestrictedStatus(newStatus)) {
    return "restricted";
  }
  return null;
}

export function membershipStatusDeliveryKey(args: {
  userId: string;
  kind: MembershipStatusEmailKind;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
}): string {
  const from = args.previousStatus ?? "UNKNOWN";
  return `membership-${args.kind}:${args.userId}:${from}:${args.newStatus}`;
}
