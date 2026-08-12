import {
  BookingPaymentAdjustmentStatus,
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import {
  GOV_NOTIFY_DELIVERY_MODES,
  type GovNotifyDeliveryMode,
} from "./govNotifyDeliveryMode";
import {
  NON_RESTRICTED_STATUSES,
  RESTRICTED_STATUSES,
  type MembershipStatus,
} from "./validation";

export const NOTIFICATION_RECOVERY_PAYLOAD_VERSION = 1 as const;
const MAX_RECOVERY_PAYLOAD_LENGTH = 8_000;

interface VersionedRecoveryPayload {
  version: typeof NOTIFICATION_RECOVERY_PAYLOAD_VERSION;
  deliveryMode?: GovNotifyDeliveryMode;
}

export type NotificationRecoveryPayload =
  | (VersionedRecoveryPayload & {
      kind: "BOOKING_CONFIRMATION";
      bookingId: UUIDString;
      idempotencyKey: string;
    })
  | (VersionedRecoveryPayload & {
      kind: "BOOKING_REVISION";
      bookingId: UUIDString;
      idempotencyKey: string;
      paymentDelta: {
        previousTotalMinor: number;
        revisedTotalMinor: number;
        deltaAmountMinor: number;
        paymentRemainingMinor: number;
        status: BookingPaymentAdjustmentStatus;
      };
    })
  | (VersionedRecoveryPayload & {
      kind: "BOOKING_PENDING_MEMBER";
      bookingId: UUIDString;
      idempotencyKey: string;
    })
  | (VersionedRecoveryPayload & {
      kind: "BOOKING_PENDING_MODERATOR";
      bookingId: UUIDString;
      recipientEmail: string;
    })
  | (VersionedRecoveryPayload & {
      kind: "BOOKING_CHANGES_REQUESTED";
      bookingId: UUIDString;
    })
  | (VersionedRecoveryPayload & {
      kind: "BOOKING_APPROVED";
      bookingId: UUIDString;
    })
  | (VersionedRecoveryPayload & {
      kind: "MEMBERSHIP_STATUS";
      userId: string;
      previousStatus: MembershipStatus | null;
      newStatus: MembershipStatus;
    })
  | (VersionedRecoveryPayload & {
      kind: "USER_PENDING_APPROVAL";
      userId: string;
      emailVerified: boolean;
      recipientEmail: string;
    })
  | (VersionedRecoveryPayload & {
      kind: "PAYMENT_LIFECYCLE";
      type: "PAYMENT_PAID" | "PAYMENT_FAILED" | "PAYMENT_REFUNDED";
      orderId: UUIDString;
      eventId: string | null;
      stripeEventId: string;
      status: TicketOrderStatus | null;
      occurredAt: string;
      userId: string | null;
    })
  | (VersionedRecoveryPayload & {
      kind: "PAYMENT_RECONCILIATION_OPS";
      orderId: UUIDString;
      exceptionType: PaymentReconciliationExceptionType;
      exceptionNote: string;
      stripeEventId: string;
      recipientEmail: string;
    })
  | (VersionedRecoveryPayload & {
      kind: "PAYMENT_DISPUTE_OPS";
      orderId: UUIDString;
      stripeEventId: string;
      stripeEventType: string;
      disputeStripeStatus: string;
      disputeReason: string;
      disputeLocalState: string;
      stripeDisputeId: string;
      recipientEmail: string;
    });

export class NotificationRecoveryPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationRecoveryPayloadError";
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NotificationRecoveryPayloadError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new NotificationRecoveryPayloadError(`${field} must be a non-empty string`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new NotificationRecoveryPayloadError(`${field} must be a string`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : string(value, field);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NotificationRecoveryPayloadError(`${field} must be a finite number`);
  }
  return value;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new NotificationRecoveryPayloadError(`${field} must be a boolean`);
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new NotificationRecoveryPayloadError(`${field} is invalid`);
  }
  return value as T;
}

const MEMBERSHIP_STATUSES = [
  ...NON_RESTRICTED_STATUSES,
  ...RESTRICTED_STATUSES,
] as MembershipStatus[];
const PAYMENT_LIFECYCLE_TYPES = [
  "PAYMENT_PAID",
  "PAYMENT_FAILED",
  "PAYMENT_REFUNDED",
] as const;

export function serializeNotificationRecoveryPayload(
  payload: NotificationRecoveryPayload
): string {
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_RECOVERY_PAYLOAD_LENGTH) {
    throw new NotificationRecoveryPayloadError(
      `Recovery payload exceeds ${MAX_RECOVERY_PAYLOAD_LENGTH} characters`
    );
  }
  return serialized;
}

export function parseNotificationRecoveryPayload(
  serialized: string
): NotificationRecoveryPayload {
  if (serialized.length > MAX_RECOVERY_PAYLOAD_LENGTH) {
    throw new NotificationRecoveryPayloadError("Recovery payload is too large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new NotificationRecoveryPayloadError("Recovery payload is not valid JSON");
  }

  const payload = record(parsed, "recovery payload");
  if (payload.version !== NOTIFICATION_RECOVERY_PAYLOAD_VERSION) {
    throw new NotificationRecoveryPayloadError("Recovery payload version is unsupported");
  }
  const base = {
    version: NOTIFICATION_RECOVERY_PAYLOAD_VERSION,
    deliveryMode: payload.deliveryMode === undefined
      ? undefined
      : enumValue(payload.deliveryMode, GOV_NOTIFY_DELIVERY_MODES, "deliveryMode"),
  };
  const kind = string(payload.kind, "kind");

  switch (kind) {
    case "BOOKING_CONFIRMATION":
      return {
        ...base,
        kind,
        bookingId: string(payload.bookingId, "bookingId") as UUIDString,
        idempotencyKey: string(payload.idempotencyKey, "idempotencyKey"),
      };
    case "BOOKING_REVISION": {
      const paymentDelta = record(payload.paymentDelta, "paymentDelta");
      return {
        ...base,
        kind,
        bookingId: string(payload.bookingId, "bookingId") as UUIDString,
        idempotencyKey: string(payload.idempotencyKey, "idempotencyKey"),
        paymentDelta: {
          previousTotalMinor: finiteNumber(paymentDelta.previousTotalMinor, "previousTotalMinor"),
          revisedTotalMinor: finiteNumber(paymentDelta.revisedTotalMinor, "revisedTotalMinor"),
          deltaAmountMinor: finiteNumber(paymentDelta.deltaAmountMinor, "deltaAmountMinor"),
          paymentRemainingMinor: finiteNumber(paymentDelta.paymentRemainingMinor, "paymentRemainingMinor"),
          status: enumValue(
            paymentDelta.status,
            Object.values(BookingPaymentAdjustmentStatus),
            "paymentDelta.status"
          ),
        },
      };
    }
    case "BOOKING_PENDING_MEMBER":
      return {
        ...base,
        kind,
        bookingId: string(payload.bookingId, "bookingId") as UUIDString,
        idempotencyKey: string(payload.idempotencyKey, "idempotencyKey"),
      };
    case "BOOKING_PENDING_MODERATOR":
      return {
        ...base,
        kind,
        bookingId: string(payload.bookingId, "bookingId") as UUIDString,
        recipientEmail: string(payload.recipientEmail, "recipientEmail"),
      };
    case "BOOKING_CHANGES_REQUESTED":
      return {
        ...base,
        kind,
        bookingId: string(payload.bookingId, "bookingId") as UUIDString,
      };
    case "BOOKING_APPROVED":
      return {
        ...base,
        kind,
        bookingId: string(payload.bookingId, "bookingId") as UUIDString,
      };
    case "MEMBERSHIP_STATUS":
      return {
        ...base,
        kind,
        userId: string(payload.userId, "userId"),
        previousStatus:
          payload.previousStatus === null
            ? null
            : enumValue(payload.previousStatus, MEMBERSHIP_STATUSES, "previousStatus"),
        newStatus: enumValue(payload.newStatus, MEMBERSHIP_STATUSES, "newStatus"),
      };
    case "USER_PENDING_APPROVAL":
      return {
        ...base,
        kind,
        userId: string(payload.userId, "userId"),
        emailVerified: boolean(payload.emailVerified, "emailVerified"),
        recipientEmail: string(payload.recipientEmail, "recipientEmail"),
      };
    case "PAYMENT_LIFECYCLE":
      return {
        ...base,
        kind,
        type: enumValue(payload.type, PAYMENT_LIFECYCLE_TYPES, "type"),
        orderId: string(payload.orderId, "orderId") as UUIDString,
        eventId: nullableString(payload.eventId, "eventId"),
        stripeEventId: string(payload.stripeEventId, "stripeEventId"),
        status:
          payload.status === null
            ? null
            : enumValue(payload.status, Object.values(TicketOrderStatus), "status"),
        occurredAt: string(payload.occurredAt, "occurredAt"),
        userId: nullableString(payload.userId, "userId"),
      };
    case "PAYMENT_RECONCILIATION_OPS":
      return {
        ...base,
        kind,
        orderId: string(payload.orderId, "orderId") as UUIDString,
        exceptionType: enumValue(
          payload.exceptionType,
          Object.values(PaymentReconciliationExceptionType),
          "exceptionType"
        ),
        exceptionNote: text(payload.exceptionNote, "exceptionNote"),
        stripeEventId: string(payload.stripeEventId, "stripeEventId"),
        recipientEmail: string(payload.recipientEmail, "recipientEmail"),
      };
    case "PAYMENT_DISPUTE_OPS":
      return {
        ...base,
        kind,
        orderId: string(payload.orderId, "orderId") as UUIDString,
        stripeEventId: string(payload.stripeEventId, "stripeEventId"),
        stripeEventType: string(payload.stripeEventType, "stripeEventType"),
        disputeStripeStatus: string(payload.disputeStripeStatus, "disputeStripeStatus"),
        disputeReason: text(payload.disputeReason, "disputeReason"),
        disputeLocalState: text(payload.disputeLocalState, "disputeLocalState"),
        stripeDisputeId: string(payload.stripeDisputeId, "stripeDisputeId"),
        recipientEmail: string(payload.recipientEmail, "recipientEmail"),
      };
    default:
      throw new NotificationRecoveryPayloadError(`Unsupported recovery kind: ${kind}`);
  }
}
