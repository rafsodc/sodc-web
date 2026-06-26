import {
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { runTicketOrderTransition } from "./paymentTransitionEngine";

export const DEFAULT_BOOKING_DRAFT_EXPIRY_MINUTES = 60;
export const DEFAULT_TICKET_ORDER_PENDING_EXPIRY_MINUTES = 60;
export const DEFAULT_STAGED_EXPIRY_BATCH_LIMIT = 100;
export const STAGED_EXPIRY_WEBHOOK_EVENT_PREFIX = "staged-expiry:";

export interface StagedExpiryConfig {
  bookingDraftExpiryMinutes: number;
  ticketOrderPendingExpiryMinutes: number;
  batchLimit: number;
}

export interface StagedDraftBookingRow {
  id: UUIDString;
  status: BookingStatus;
  updatedAt: string;
}

export interface StagedPendingTicketOrderRow {
  id: UUIDString;
  status: TicketOrderStatus;
  createdAt: string;
}

export type StagedExpiryItemAction = "applied" | "skipped" | "failed";

export interface ExpireDraftBookingResult {
  action: StagedExpiryItemAction;
  bookingId: UUIDString;
  reason: string;
}

export interface ExpirePendingTicketOrderResult {
  action: StagedExpiryItemAction;
  bookingId?: never;
  orderId: UUIDString;
  reason: string;
}

export interface StagedExpiryBatchSummary {
  draftBookings: {
    scanned: number;
    applied: number;
    skipped: number;
    failed: number;
  };
  pendingTicketOrders: {
    scanned: number;
    applied: number;
    skipped: number;
    failed: number;
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function parseStagedExpiryConfig(
  env: NodeJS.ProcessEnv = process.env
): StagedExpiryConfig {
  return {
    bookingDraftExpiryMinutes: parsePositiveInt(
      env.BOOKING_DRAFT_EXPIRY_MINUTES,
      DEFAULT_BOOKING_DRAFT_EXPIRY_MINUTES
    ),
    ticketOrderPendingExpiryMinutes: parsePositiveInt(
      env.TICKET_ORDER_PENDING_EXPIRY_MINUTES,
      DEFAULT_TICKET_ORDER_PENDING_EXPIRY_MINUTES
    ),
    batchLimit: parsePositiveInt(env.STAGED_EXPIRY_BATCH_LIMIT, DEFAULT_STAGED_EXPIRY_BATCH_LIMIT),
  };
}

export function computeExpiryCutoff(nowMs: number, expiryMinutes: number): Date {
  return new Date(nowMs - expiryMinutes * 60_000);
}

export function isStaleByTimestamp(timestamp: string, cutoff: Date): boolean {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return parsed < cutoff.getTime();
}

export function buildStagedExpiryWebhookEventId(orderId: UUIDString): string {
  return `${STAGED_EXPIRY_WEBHOOK_EVENT_PREFIX}${orderId}`;
}

export function shouldExpireDraftBooking(
  booking: StagedDraftBookingRow,
  cutoff: Date
): { expire: boolean; reason: string } {
  if (booking.status !== BookingStatus.DRAFT) {
    return { expire: false, reason: "not_draft" };
  }
  if (!isStaleByTimestamp(booking.updatedAt, cutoff)) {
    return { expire: false, reason: "not_stale" };
  }
  return { expire: true, reason: "stale_draft" };
}

export function shouldExpirePendingTicketOrder(
  order: StagedPendingTicketOrderRow,
  cutoff: Date
): { expire: boolean; reason: string } {
  if (order.status !== TicketOrderStatus.PENDING) {
    return { expire: false, reason: "not_pending" };
  }
  if (!isStaleByTimestamp(order.createdAt, cutoff)) {
    return { expire: false, reason: "not_stale" };
  }
  return { expire: true, reason: "stale_pending_order" };
}

export async function expireStaleDraftBooking(args: {
  booking: StagedDraftBookingRow;
  cutoff: Date;
  cancelDraft: (bookingId: UUIDString) => Promise<unknown>;
}): Promise<ExpireDraftBookingResult> {
  const decision = shouldExpireDraftBooking(args.booking, args.cutoff);
  if (!decision.expire) {
    return {
      action: "skipped",
      bookingId: args.booking.id,
      reason: decision.reason,
    };
  }

  try {
    await args.cancelDraft(args.booking.id);
    return {
      action: "applied",
      bookingId: args.booking.id,
      reason: decision.reason,
    };
  } catch {
    return {
      action: "failed",
      bookingId: args.booking.id,
      reason: "cancel_mutation_failed",
    };
  }
}

export async function expireStalePendingTicketOrder(args: {
  order: StagedPendingTicketOrderRow;
  cutoff: Date;
  markFailed: (orderId: UUIDString, webhookEventId: string) => Promise<unknown>;
}): Promise<ExpirePendingTicketOrderResult> {
  const decision = shouldExpirePendingTicketOrder(args.order, args.cutoff);
  if (!decision.expire) {
    return {
      action: "skipped",
      orderId: args.order.id,
      reason: decision.reason,
    };
  }

  try {
    const transition = await runTicketOrderTransition(
      {
        orderId: args.order.id,
        currentStatus: args.order.status,
        intent: "MARK_FAILED",
        webhookEventId: buildStagedExpiryWebhookEventId(args.order.id),
      },
      {
        markPaid: async () => undefined,
        markFailed: async ({ id, webhookEventId }) => args.markFailed(id, webhookEventId),
        markRefunded: async () => undefined,
      }
    );
    if (transition.action === "applied") {
      return {
        action: "applied",
        orderId: args.order.id,
        reason: decision.reason,
      };
    }
    return {
      action: "skipped",
      orderId: args.order.id,
      reason: transition.reason,
    };
  } catch {
    return {
      action: "failed",
      orderId: args.order.id,
      reason: "mark_failed_mutation_failed",
    };
  }
}

function summarizeResults<T extends { action: StagedExpiryItemAction }>(
  results: T[]
): { scanned: number; applied: number; skipped: number; failed: number } {
  return {
    scanned: results.length,
    applied: results.filter((result) => result.action === "applied").length,
    skipped: results.filter((result) => result.action === "skipped").length,
    failed: results.filter((result) => result.action === "failed").length,
  };
}

export async function processStagedExpiryBatch(args: {
  nowMs: number;
  config: StagedExpiryConfig;
  listStaleDraftBookings: (updatedBefore: string, limit: number) => Promise<StagedDraftBookingRow[]>;
  listStalePendingTicketOrders: (createdBefore: string, limit: number) => Promise<StagedPendingTicketOrderRow[]>;
  cancelDraft: (bookingId: UUIDString) => Promise<unknown>;
  markFailed: (orderId: UUIDString, webhookEventId: string) => Promise<unknown>;
}): Promise<StagedExpiryBatchSummary> {
  const draftCutoff = computeExpiryCutoff(args.nowMs, args.config.bookingDraftExpiryMinutes);
  const orderCutoff = computeExpiryCutoff(args.nowMs, args.config.ticketOrderPendingExpiryMinutes);

  const [draftBookings, pendingTicketOrders] = await Promise.all([
    args.listStaleDraftBookings(draftCutoff.toISOString(), args.config.batchLimit),
    args.listStalePendingTicketOrders(orderCutoff.toISOString(), args.config.batchLimit),
  ]);

  const draftResults = await Promise.all(
    draftBookings.map((booking) =>
      expireStaleDraftBooking({
        booking,
        cutoff: draftCutoff,
        cancelDraft: args.cancelDraft,
      })
    )
  );

  const orderResults = await Promise.all(
    pendingTicketOrders.map((order) =>
      expireStalePendingTicketOrder({
        order,
        cutoff: orderCutoff,
        markFailed: args.markFailed,
      })
    )
  );

  return {
    draftBookings: summarizeResults(draftResults),
    pendingTicketOrders: summarizeResults(orderResults),
  };
}
