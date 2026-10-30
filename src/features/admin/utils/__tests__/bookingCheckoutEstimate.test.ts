import { TicketOrderStatus } from "@dataconnect/generated";
import { describe, expect, it } from "vitest";
import type { EventBookingAdminRow } from "../../components/sectionEventsManagerTypes";
import { getBookingCheckoutEstimate } from "../bookingCheckoutEstimate";

type Line = EventBookingAdminRow["lines"][number];
const orders = new Map([
  ["paid", { id: "paid", status: TicketOrderStatus.PAID }],
  ["refunded", { id: "refunded", status: TicketOrderStatus.REFUNDED }],
  ["pending", { id: "pending", status: TicketOrderStatus.PENDING }],
  ["failed", { id: "failed", status: TicketOrderStatus.FAILED }],
]);
function place(id: string, price: number, allocations: Line["bookingPlace"]["paymentAllocations"] = [], removed = false): Line {
  return { id: `line-${id}`, sortOrder: 0, ticketType: { id: `ticket-${id}`, title: id, audience: "GUEST" as Line["ticketType"]["audience"], price, includesDinner: true, includesSymposium: false }, bookingPlace: { id, attendanceVersion: 0, attendanceRemoved: removed, paymentAllocations: allocations } };
}
function allocation(order: string, amount: number, refunded = 0) {
  return { id: `allocation-${order}`, ticketOrderId: order, allocatedAmountMinor: amount, refundedAmountMinor: refunded };
}

describe("booking checkout estimate", () => {
  it("does not net a downgraded place's refund against a new place's charge", () => {
    const proposed = { lines: [place("existing", 30, [allocation("paid", 5000)]), place("new", 20)] };
    expect(getBookingCheckoutEstimate(proposed, orders)).toMatchObject({ refundDueMinor: 2000, toPayMinor: 2000, unknownPaymentPlaceCount: 0 });
  });

  it("keeps mixed upgrades and downgrades attached to each place", () => {
    const proposed = { lines: [place("downgraded", 30, [allocation("paid", 5000)]), place("upgraded", 60, [allocation("paid", 4000)]), place("part-paid", 25, [allocation("paid", 1000, 500)])] };
    expect(getBookingCheckoutEstimate(proposed, orders)).toMatchObject({ refundDueMinor: 2000, toPayMinor: 4000 });
  });

  it("nets completed partial refunds on the same place across settled allocation statuses", () => {
    const proposed = { lines: [place("existing", 30, [allocation("paid", 3000, 1000), allocation("refunded", 2000, 500)])] };
    expect(getBookingCheckoutEstimate(proposed, orders)).toMatchObject({ refundDueMinor: 500, toPayMinor: 0 });
  });

  it("keeps a fully refunded current place's checkout shortfall separate from refund history", () => {
    expect(getBookingCheckoutEstimate({ lines: [place("existing", 50, [allocation("refunded", 5000, 5000)])] }, orders)).toMatchObject({ refundDueMinor: 0, toPayMinor: 5000 });
  });

  it("refunds overpayment when an existing place becomes free", () => {
    expect(getBookingCheckoutEstimate({ lines: [place("existing", 0, [allocation("paid", 5000)])] }, orders)).toMatchObject({ refundDueMinor: 5000, toPayMinor: 0 });
  });

  it("distinguishes fully settled and free known zero balances from unavailable evidence", () => {
    expect(getBookingCheckoutEstimate({ lines: [place("paid", 50, [allocation("paid", 5000)]), place("free", 0)] }, orders)).toMatchObject({ refundDueMinor: 0, toPayMinor: 0, unknownPaymentPlaceCount: 0 });
  });

  it("does not treat pending or failed orders as settled cash", () => {
    expect(getBookingCheckoutEstimate({ lines: [place("pending", 50, [allocation("pending", 5000)]), place("failed", 20, [allocation("failed", 2000)])] }, orders)).toMatchObject({ refundDueMinor: 0, toPayMinor: 7000, hasPendingPayments: true });
  });

  it("excludes removed places from automatic charges, refunds, and missing-evidence counts", () => {
    const proposed = { lines: [place("removed-paid", 20, [allocation("paid", 10000)], true), place("removed-unpaid", 50, [], true), place("removed-unknown", 20, [allocation("unknown", 5000)], true), place("current", 30)] };
    expect(getBookingCheckoutEstimate(proposed, orders)).toMatchObject({ refundDueMinor: 0, toPayMinor: 3000, unknownPaymentPlaceCount: 0 });
  });

  it("withholds both estimates when a current allocation's order status is unknown", () => {
    const proposed = { lines: [place("unknown", 50, [allocation("missing", 5000)]), place("known", 30, [allocation("paid", 5000)])] };
    expect(getBookingCheckoutEstimate(proposed, orders)).toMatchObject({ refundDueMinor: null, toPayMinor: null, unknownPaymentPlaceCount: 1 });
  });

  it.each([undefined, null, -1, Number.NaN])("withholds estimates instead of assuming a missing or invalid refunded amount %s means no refund", (refundedAmountMinor) => {
    const record = allocation("paid", 5000);
    Object.assign(record, { refundedAmountMinor });
    expect(getBookingCheckoutEstimate({ lines: [place("current", 50, [record])] }, orders)).toMatchObject({ refundDueMinor: null, toPayMinor: null, unknownPaymentPlaceCount: 1 });
  });
});
