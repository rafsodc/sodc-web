import { describe, expect, it, vi } from "vitest";
import {
  BookingStatus,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import {
  buildStagedExpiryWebhookEventId,
  computeExpiryCutoff,
  DEFAULT_BOOKING_DRAFT_EXPIRY_MINUTES,
  DEFAULT_STAGED_EXPIRY_BATCH_LIMIT,
  DEFAULT_TICKET_ORDER_PENDING_EXPIRY_MINUTES,
  expireStaleDraftBooking,
  expireStalePendingTicketOrder,
  isStaleByTimestamp,
  parseStagedExpiryConfig,
  processStagedExpiryBatch,
  shouldExpireDraftBooking,
  shouldExpirePendingTicketOrder,
  STAGED_EXPIRY_WEBHOOK_EVENT_PREFIX,
} from "../stagedExpiryEngine";

const NOW = Date.parse("2026-06-03T12:00:00.000Z");
const BOOKING_ID = "00000000-0000-0000-0000-000000000001" as const;
const ORDER_ID = "00000000-0000-0000-0000-000000000002" as const;

describe("stagedExpiryEngine config", () => {
  it("uses defaults when env is unset", () => {
    expect(parseStagedExpiryConfig({})).toEqual({
      bookingDraftExpiryMinutes: DEFAULT_BOOKING_DRAFT_EXPIRY_MINUTES,
      ticketOrderPendingExpiryMinutes: DEFAULT_TICKET_ORDER_PENDING_EXPIRY_MINUTES,
      batchLimit: DEFAULT_STAGED_EXPIRY_BATCH_LIMIT,
    });
  });

  it("parses positive integer env overrides", () => {
    expect(
      parseStagedExpiryConfig({
        BOOKING_DRAFT_EXPIRY_MINUTES: "90",
        TICKET_ORDER_PENDING_EXPIRY_MINUTES: "45",
        STAGED_EXPIRY_BATCH_LIMIT: "25",
      })
    ).toEqual({
      bookingDraftExpiryMinutes: 90,
      ticketOrderPendingExpiryMinutes: 45,
      batchLimit: 25,
    });
  });

  it("falls back when env values are invalid", () => {
    expect(
      parseStagedExpiryConfig({
        BOOKING_DRAFT_EXPIRY_MINUTES: "0",
        TICKET_ORDER_PENDING_EXPIRY_MINUTES: "abc",
        STAGED_EXPIRY_BATCH_LIMIT: "-1",
      })
    ).toEqual({
      bookingDraftExpiryMinutes: DEFAULT_BOOKING_DRAFT_EXPIRY_MINUTES,
      ticketOrderPendingExpiryMinutes: DEFAULT_TICKET_ORDER_PENDING_EXPIRY_MINUTES,
      batchLimit: DEFAULT_STAGED_EXPIRY_BATCH_LIMIT,
    });
  });
});

describe("stagedExpiryEngine cutoff helpers", () => {
  it("computes cutoff from frozen clock", () => {
    const cutoff = computeExpiryCutoff(NOW, 60);
    expect(cutoff.toISOString()).toBe("2026-06-03T11:00:00.000Z");
  });

  it("treats timestamps older than cutoff as stale", () => {
    const cutoff = computeExpiryCutoff(NOW, 60);
    expect(isStaleByTimestamp("2026-06-03T10:59:59.999Z", cutoff)).toBe(true);
    expect(isStaleByTimestamp("2026-06-03T11:00:00.000Z", cutoff)).toBe(false);
  });

  it("builds deterministic staged-expiry webhook ids", () => {
    expect(buildStagedExpiryWebhookEventId(ORDER_ID)).toBe(`${STAGED_EXPIRY_WEBHOOK_EVENT_PREFIX}${ORDER_ID}`);
  });
});

describe("stagedExpiryEngine eligibility", () => {
  const draftCutoff = computeExpiryCutoff(NOW, 60);
  const orderCutoff = computeExpiryCutoff(NOW, 60);

  it("requires draft status and stale updatedAt", () => {
    expect(
      shouldExpireDraftBooking(
        {
          id: BOOKING_ID,
          status: BookingStatus.DRAFT,
          updatedAt: "2026-06-03T10:00:00.000Z",
        },
        draftCutoff
      )
    ).toEqual({ expire: true, reason: "stale_draft" });

    expect(
      shouldExpireDraftBooking(
        {
          id: BOOKING_ID,
          status: BookingStatus.SUBMITTED,
          updatedAt: "2026-06-03T10:00:00.000Z",
        },
        draftCutoff
      )
    ).toEqual({ expire: false, reason: "not_draft" });
  });

  it("requires pending status and stale createdAt", () => {
    expect(
      shouldExpirePendingTicketOrder(
        {
          id: ORDER_ID,
          status: TicketOrderStatus.PENDING,
          createdAt: "2026-06-03T10:00:00.000Z",
        },
        orderCutoff
      )
    ).toEqual({ expire: true, reason: "stale_pending_order" });

    expect(
      shouldExpirePendingTicketOrder(
        {
          id: ORDER_ID,
          status: TicketOrderStatus.PAID,
          createdAt: "2026-06-03T10:00:00.000Z",
        },
        orderCutoff
      )
    ).toEqual({ expire: false, reason: "not_pending" });
  });
});

describe("stagedExpiryEngine item handlers", () => {
  const draftCutoff = computeExpiryCutoff(NOW, 60);
  const orderCutoff = computeExpiryCutoff(NOW, 60);

  it("cancels stale draft bookings", async () => {
    const cancelDraft = vi.fn(async () => undefined);
    const result = await expireStaleDraftBooking({
      booking: {
        id: BOOKING_ID,
        status: BookingStatus.DRAFT,
        updatedAt: "2026-06-03T10:00:00.000Z",
      },
      cutoff: draftCutoff,
      cancelDraft,
    });

    expect(result.action).toBe("applied");
    expect(cancelDraft).toHaveBeenCalledWith(BOOKING_ID);
  });

  it("marks stale pending ticket orders failed via transition engine", async () => {
    const markFailed = vi.fn(async () => undefined);
    const result = await expireStalePendingTicketOrder({
      order: {
        id: ORDER_ID,
        status: TicketOrderStatus.PENDING,
        createdAt: "2026-06-03T10:00:00.000Z",
      },
      cutoff: orderCutoff,
      markFailed,
    });

    expect(result.action).toBe("applied");
    expect(markFailed).toHaveBeenCalledWith(ORDER_ID, `${STAGED_EXPIRY_WEBHOOK_EVENT_PREFIX}${ORDER_ID}`);
  });

  it("skips replay when pending order is already failed", async () => {
    const markFailed = vi.fn(async () => undefined);
    const result = await expireStalePendingTicketOrder({
      order: {
        id: ORDER_ID,
        status: TicketOrderStatus.FAILED,
        createdAt: "2026-06-03T10:00:00.000Z",
      },
      cutoff: orderCutoff,
      markFailed,
    });

    expect(result.action).toBe("skipped");
    expect(result.reason).toBe("not_pending");
    expect(markFailed).not.toHaveBeenCalled();
  });
});

describe("processStagedExpiryBatch", () => {
  it("processes listed drafts and pending orders idempotently", async () => {
    const cancelDraft = vi.fn(async () => undefined);
    const markFailed = vi.fn(async () => undefined);

    const summary = await processStagedExpiryBatch({
      nowMs: NOW,
      config: parseStagedExpiryConfig({ BOOKING_DRAFT_EXPIRY_MINUTES: "60", TICKET_ORDER_PENDING_EXPIRY_MINUTES: "60" }),
      listStaleDraftBookings: async () => [
        {
          id: BOOKING_ID,
          status: BookingStatus.DRAFT,
          updatedAt: "2026-06-03T10:00:00.000Z",
        },
      ],
      listStalePendingTicketOrders: async () => [
        {
          id: ORDER_ID,
          status: TicketOrderStatus.PENDING,
          createdAt: "2026-06-03T10:00:00.000Z",
        },
      ],
      cancelDraft,
      markFailed,
    });

    expect(summary).toEqual({
      draftBookings: { scanned: 1, applied: 1, skipped: 0, failed: 0 },
      pendingTicketOrders: { scanned: 1, applied: 1, skipped: 0, failed: 0 },
    });
    expect(cancelDraft).toHaveBeenCalledOnce();
    expect(markFailed).toHaveBeenCalledOnce();
  });
});
