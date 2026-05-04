import {
  PaymentReconciliationExceptionStatus,
  PaymentReconciliationExceptionType,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";

export interface TicketOrderReconciliationSnapshot {
  status: TicketOrderStatus;
  totalAmountMinor: number;
  refundedAmountMinor?: number | null;
  stripePaymentIntentId?: string | null;
  disputeStatus?: string | null;
}

export interface ReconciliationSignal {
  type: PaymentReconciliationExceptionType;
  status: PaymentReconciliationExceptionStatus;
  note: string;
}

export function evaluateReconciliationSignals(order: TicketOrderReconciliationSnapshot): ReconciliationSignal[] {
  const signals: ReconciliationSignal[] = [];

  if (order.status === TicketOrderStatus.PAID && !order.stripePaymentIntentId) {
    signals.push({
      type: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
      status: PaymentReconciliationExceptionStatus.OPEN,
      note: "Paid order is missing stripePaymentIntentId",
    });
  }

  if (order.status === TicketOrderStatus.REFUNDED) {
    if (order.refundedAmountMinor == null) {
      signals.push({
        type: PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH,
        status: PaymentReconciliationExceptionStatus.OPEN,
        note: "Refunded order is missing refundedAmountMinor",
      });
    } else if (order.refundedAmountMinor !== order.totalAmountMinor) {
      signals.push({
        type: PaymentReconciliationExceptionType.REFUND_AMOUNT_MISMATCH,
        status: PaymentReconciliationExceptionStatus.OPEN,
        note: `Refund amount ${order.refundedAmountMinor} does not match expected ${order.totalAmountMinor}`,
      });
    }
  }

  if (order.disputeStatus && order.disputeStatus.toUpperCase() !== "CLOSED") {
    signals.push({
      type: PaymentReconciliationExceptionType.ACTIVE_DISPUTE,
      status: PaymentReconciliationExceptionStatus.OPEN,
      note: `Dispute is active with status ${order.disputeStatus}`,
    });
  }

  return signals;
}
