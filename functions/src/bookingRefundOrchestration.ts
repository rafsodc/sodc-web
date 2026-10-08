import Stripe from "stripe";
import {
  updateBookingPlaceAllocationRefundStateFromCallable,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { bookingSettlementTotals } from "./bookingPaymentAdjustments";
import { validateUUID } from "./helpers";
import {
  planBookingAllocationRefunds,
  type BookingAllocationRefund,
} from "./bookingCheckout";
import type { HydratedBookingRow } from "./bookingQueryHydration";

export interface BookingRefundResult {
  requestedAmountMinor: number;
  completedAmountMinor: number;
  pendingAmountMinor: number;
  failedAmountMinor: number;
}

/**
 * Shared organiser/self-service refund orchestration. Stripe and the allocation
 * ledger both use deterministic keys so a callable retry cannot duplicate a
 * refund after an ambiguous response.
 */
export async function initiateBookingAllocationRefunds(args: {
  booking: HydratedBookingRow;
  financialHistory: readonly HydratedBookingRow[];
  stripeClient: InstanceType<typeof Stripe>;
}): Promise<BookingRefundResult> {
  const refunds = planBookingAllocationRefunds(args.booking, args.financialHistory);
  const result: BookingRefundResult = {
    requestedAmountMinor: 0,
    completedAmountMinor: 0,
    // Existing pending refunds are part of the outcome even when this retry
    // creates no new Stripe refund. They must prevent premature settlement.
    pendingAmountMinor: bookingSettlementTotals(args.financialHistory).pendingRefundAmountMinor,
    failedAmountMinor: 0,
  };
  for (const refund of refunds) {
    result.requestedAmountMinor += refund.amountMinor;
    await initiateOneRefund(args.booking.id, refund, args.stripeClient, result);
  }
  return result;
}

async function initiateOneRefund(
  bookingId: string,
  refund: BookingAllocationRefund,
  stripeClient: InstanceType<typeof Stripe>,
  result: BookingRefundResult
): Promise<void> {
  if (!refund.stripePaymentIntentId) {
    result.failedAmountMinor += refund.amountMinor;
    await updateBookingPlaceAllocationRefundStateFromCallable({
      id: validateUUID(refund.allocationId) as UUIDString,
      refundedAmountMinor: refund.resultingRefundedAmountMinor - refund.amountMinor,
      refundPendingAmountMinor: refund.resultingPendingAmountMinor - refund.amountMinor,
      stripeRefundId: null,
      refundFailureReason: "Paid allocation is missing its Stripe payment reference",
    });
    return;
  }

  try {
    const stripeRefund = await stripeClient.refunds.create(
      {
        payment_intent: refund.stripePaymentIntentId,
        amount: refund.amountMinor,
        metadata: {
          bookingId,
          allocationId: refund.allocationId,
          ticketOrderId: refund.ticketOrderId,
          orderId: refund.ticketOrderId,
          refundAmountMinor: String(refund.amountMinor),
          resultingRefundedAmountMinor: String(refund.resultingRefundedAmountMinor),
        },
      },
      {
        idempotencyKey: `booking-refund:${bookingId}:${refund.allocationId}:${refund.resultingRefundedAmountMinor}${refund.previousStripeRefundId ? `:retry:${refund.previousStripeRefundId}` : ""}`,
      }
    );
    const succeeded = !stripeRefund.status || stripeRefund.status === "succeeded";
    const failed = stripeRefund.status === "failed" || stripeRefund.status === "canceled";
    await updateBookingPlaceAllocationRefundStateFromCallable({
      id: validateUUID(refund.allocationId) as UUIDString,
      refundedAmountMinor: succeeded
        ? refund.resultingRefundedAmountMinor
        : refund.resultingRefundedAmountMinor - refund.amountMinor,
      refundPendingAmountMinor: succeeded || failed
        ? refund.resultingPendingAmountMinor - refund.amountMinor
        : refund.resultingPendingAmountMinor,
      stripeRefundId: stripeRefund.id,
      refundFailureReason: failed
        ? stripeRefund.failure_reason ?? `Stripe refund ${stripeRefund.status}`
        : null,
    });
    if (succeeded) result.completedAmountMinor += refund.amountMinor;
    else if (failed) result.failedAmountMinor += refund.amountMinor;
    else result.pendingAmountMinor += refund.amountMinor;
  } catch (error) {
    result.failedAmountMinor += refund.amountMinor;
    await updateBookingPlaceAllocationRefundStateFromCallable({
      id: validateUUID(refund.allocationId) as UUIDString,
      refundedAmountMinor: refund.resultingRefundedAmountMinor - refund.amountMinor,
      refundPendingAmountMinor: refund.resultingPendingAmountMinor - refund.amountMinor,
      stripeRefundId: null,
      refundFailureReason: error instanceof Error ? error.message.slice(0, 500) : "Stripe refund request failed",
    });
  }
}
