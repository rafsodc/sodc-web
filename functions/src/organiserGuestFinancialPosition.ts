import type * as db from "@dataconnect/admin-generated";
type Guest = db.GetOrganiserGuestData["organiserGuests"][number];
export function guestPaymentStatus(
  guest: Pick<Guest, "priceMinor" | "paidAt" | "paidAmountMinor" | "refundedAmountMinor" | "refundPendingMinor" | "refundFailureReason" | "cancelledAt" | "payments">,
) {
  const position = guestFinancialPosition(guest);
  if (position.refundFailureReason) return "REFUND_FAILED";
  if (position.refundPendingMinor > 0) return "REFUND_PENDING";
  if (position.settledAmountMinor > (guest.cancelledAt ? 0 : guest.priceMinor)) return "REFUND_REQUIRED";
  if (guest.cancelledAt && position.grossPaidMinor > 0) return "REFUNDED";
  if (position.paymentRequiredMinor > 0 && position.grossPaidMinor > 0) return "PAYMENT_REQUIRED";
  if (position.grossPaidMinor > 0)
    return position.refundedAmountMinor > 0 ? "PARTIALLY_REFUNDED" : "PAID";
  return guest.priceMinor === 0 ? "FREE" : "UNPAID";
}

export function guestFinancialPosition(
  guest: Pick<Guest, "priceMinor" | "paidAt" | "paidAmountMinor" | "refundedAmountMinor" | "refundPendingMinor" | "refundFailureReason" | "payments">
) {
  const originalPaidMinor = guest.paidAt ? (guest.paidAmountMinor ?? guest.priceMinor) : 0;
  const paidAdditional = (guest.payments ?? []).filter((payment) => payment.paidAt);
  const grossPaidMinor = originalPaidMinor + paidAdditional.reduce((total, payment) => total + payment.amountMinor, 0);
  const refundedAmountMinor = guest.refundedAmountMinor + paidAdditional.reduce((total, payment) => total + payment.refundedAmountMinor, 0);
  const refundPendingMinor = guest.refundPendingMinor + paidAdditional.reduce((total, payment) => total + payment.refundPendingMinor, 0);
  const settledAmountMinor = Math.max(0, grossPaidMinor - refundedAmountMinor - refundPendingMinor);
  return {
    grossPaidMinor,
    refundedAmountMinor,
    refundPendingMinor,
    settledAmountMinor,
    paymentRequiredMinor: Math.max(0, guest.priceMinor - settledAmountMinor),
    refundDueMinor: Math.max(0, settledAmountMinor - guest.priceMinor),
    refundFailureReason: guest.refundFailureReason ?? paidAdditional.find((payment) => payment.refundFailureReason)?.refundFailureReason ?? null,
  };
}
