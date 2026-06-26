import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {
  BookingStatus,
  listStaleDraftBookingsForScheduler,
  listStalePendingTicketOrdersForScheduler,
  markTicketOrderFailedFromWebhook,
  updateBookingStatusFromCallable,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { parseStagedExpiryConfig, processStagedExpiryBatch } from "./stagedExpiryEngine";

export const expireUnpaidStagedBookings = onSchedule(
  {
    schedule: "every 15 minutes",
    region: FUNCTIONS_REGION,
    timeoutSeconds: 540,
  },
  async () => {
    const config = parseStagedExpiryConfig();
    const startedAt = Date.now();

    const summary = await processStagedExpiryBatch({
      nowMs: startedAt,
      config,
      listStaleDraftBookings: async (updatedBefore, limit) => {
        const result = await listStaleDraftBookingsForScheduler({ updatedBefore, limit });
        return result.data?.bookings ?? [];
      },
      listStalePendingTicketOrders: async (createdBefore, limit) => {
        const result = await listStalePendingTicketOrdersForScheduler({ createdBefore, limit });
        return result.data?.ticketOrders ?? [];
      },
      cancelDraft: async (bookingId) =>
        updateBookingStatusFromCallable({
          id: bookingId,
          status: BookingStatus.CANCELLED,
        }),
      markFailed: async (orderId, webhookEventId) =>
        markTicketOrderFailedFromWebhook({
          id: orderId as UUIDString,
          webhookEventId,
        }),
    });

    logger.info("staged expiry job completed", {
      durationMs: Date.now() - startedAt,
      config,
      summary,
    });
  }
);
