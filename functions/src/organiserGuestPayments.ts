import * as db from "@dataconnect/admin-generated";
import { validateUUID } from "./helpers";
import { requireStripe } from "./paymentConfig";
type StripeClient = ReturnType<typeof requireStripe>;
type CheckoutSession = Awaited<
  ReturnType<StripeClient["checkout"]["sessions"]["retrieve"]>
>;
async function guestById(id: string) {
  const guest = (await db.getOrganiserGuest({ id })).data.organiserGuests[0];
  if (!guest) throw new Error("Guest payment record missing");
  return guest;
}
/** Called only after the existing webhook has verified Stripe's signature. */
export async function handleOrganiserGuestStripeEvent(
  event: { type: string; data: { object: unknown } },
  stripe: StripeClient,
) {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as CheckoutSession;
    if (session.metadata?.domain !== "organiser-guest") return false;
    const guest = await guestById(validateUUID(session.metadata.guestId));
    if (session.payment_status !== "paid") return true;
    const guestPaymentId = session.metadata.guestPaymentId;
    const additionalPayment = guestPaymentId
      ? guest.payments.find((payment) => validateUUID(payment.id) === validateUUID(guestPaymentId))
      : null;
    const expectedAmountMinor = additionalPayment?.amountMinor ?? guest.priceMinor;
    if (session.amount_total !== expectedAmountMinor || session.currency !== "gbp")
      throw new Error("Guest payment evidence mismatch");
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId) throw new Error("Missing guest payment intent");
    if (additionalPayment) {
      if (additionalPayment.paidAt) {
        if (additionalPayment.stripePaymentIntentId !== paymentIntentId)
          throw new Error("Duplicate guest payment requires review");
        return true;
      }
      await db.markOrganiserGuestAdditionalPaymentPaid({
        id: additionalPayment.id,
        guestId: guest.id,
        sessionId: session.id,
        paymentIntentId,
      });
      if (guest.cancelledAt) {
        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            amount: additionalPayment.amountMinor,
            metadata: { domain: "organiser-guest", guestId: guest.id, guestPaymentId: additionalPayment.id },
          },
          { idempotencyKey: `organiser-guest-refund:${guest.id}:${additionalPayment.id}:${additionalPayment.amountMinor}` },
        );
        await handleOrganiserGuestStripeEvent({ type: "refund.created", data: { object: refund } }, stripe);
      }
    } else {
      if (guest.paidAt) {
        if (guest.stripePaymentIntentId !== paymentIntentId)
          throw new Error("Duplicate guest payment requires review");
        return true;
      }
      await db.markOrganiserGuestPaid({
        id: guest.id,
        sessionId: session.id,
        paymentIntentId,
        paidAmountMinor: expectedAmountMinor,
      });
      if (guest.cancelledAt) {
        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            amount: expectedAmountMinor,
            metadata: { domain: "organiser-guest", guestId: guest.id },
          },
          { idempotencyKey: `organiser-guest-refund:${guest.id}:original:${expectedAmountMinor}` },
        );
        await handleOrganiserGuestStripeEvent({ type: "refund.created", data: { object: refund } }, stripe);
      }
    }
    return true;
  }
  if (event.type === "checkout.session.expired")
    return (
      (event.data.object as CheckoutSession).metadata?.domain ===
      "organiser-guest"
    );
  if (
    [
      "charge.refunded",
      "refund.created",
      "refund.updated",
      "refund.failed",
    ].includes(event.type)
  ) {
    const object = event.data.object as {
      payment_intent?: string | { id: string } | null;
      metadata?: Record<string, string>;
    };
    if (object.metadata?.ticketOrderId || object.metadata?.orderIds)
      return false;
    const id =
      typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.payment_intent?.id;
    if (!id) return false;
    const intent = await stripe.paymentIntents.retrieve(id);
    if (intent.metadata.domain !== "organiser-guest") return false;
    const guest = await guestById(validateUUID(intent.metadata.guestId));
    const guestPaymentId = intent.metadata.guestPaymentId;
    const additionalPayment = guestPaymentId
      ? guest.payments.find((payment) => validateUUID(payment.id) === validateUUID(guestPaymentId))
      : null;
    if (additionalPayment) {
      if (!additionalPayment.paidAt || additionalPayment.stripePaymentIntentId !== id)
        throw new Error("Guest refund evidence mismatch");
    } else if (!guest.paidAt || guest.stripePaymentIntentId !== id) {
      throw new Error("Guest refund evidence mismatch");
    }
    // Read Stripe's current refund state, not a potentially stale webhook snapshot.
    let refundedAmountMinor = 0;
    let refundPendingMinor = 0;
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.refunds.list({
        payment_intent: id,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const refund of page.data) {
        if (refund.status === "succeeded") refundedAmountMinor += refund.amount;
        else if (
          refund.status === "pending" ||
          refund.status === "requires_action"
        )
          refundPendingMinor += refund.amount;
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    const sourceAmountMinor = additionalPayment?.amountMinor ?? guest.paidAmountMinor ?? guest.priceMinor;
    if (refundedAmountMinor + refundPendingMinor > sourceAmountMinor)
      throw new Error("Guest refund amount mismatch");
    const previousRefundedAmountMinor = additionalPayment?.refundedAmountMinor ?? guest.refundedAmountMinor;
    const previousRefundPendingMinor = additionalPayment?.refundPendingMinor ?? guest.refundPendingMinor;
    const previousRefundFailureReason = additionalPayment?.refundFailureReason ?? guest.refundFailureReason;
    const refundObject = event.data.object as { id?: string; status?: string; failure_reason?: string | null };
    const refundFailureReason = event.type === "refund.failed" || refundObject.status === "failed" || refundObject.status === "canceled"
      ? refundObject.failure_reason ?? "Stripe refund failed"
      : null;
    if (refundedAmountMinor < previousRefundedAmountMinor)
      throw new Error("Stale guest refund evidence");
    if (
      previousRefundedAmountMinor === refundedAmountMinor &&
      previousRefundPendingMinor === refundPendingMinor &&
      previousRefundFailureReason === refundFailureReason
    )
      return true;
    if (additionalPayment) {
      await db.markOrganiserGuestAdditionalPaymentRefunded({
        id: additionalPayment.id,
        paymentIntentId: id,
        refundedAmountMinor,
        refundPendingMinor,
        refundFailureReason,
        stripeRefundId: refundObject.id ?? null,
      });
    } else {
      await db.markOrganiserGuestRefunded({
        id: guest.id,
        paymentIntentId: id,
        refundedAmountMinor,
        refundPendingMinor,
        refundFailureReason,
        stripeRefundId: refundObject.id ?? null,
        version: guest.version,
      });
    }
    return true;
  }
  return false;
}
