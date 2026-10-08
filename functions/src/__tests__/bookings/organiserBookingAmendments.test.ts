import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@dataconnect/admin-generated";
const stripe = vi.hoisted(() => ({ refunds: { create: vi.fn() } }));
vi.mock("../../paymentConfig", () => ({ stripeSecret: { value: () => "secret" }, requireStripe: () => stripe }));
vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("../../sectionAccess", () => ({ requireSectionModerator: vi.fn() }));
vi.mock("../../bookingEmailDispatcher", () => ({ notifyBookingRevisionEmail: vi.fn() }));
import { amendEventBookingAsOrganiser, retryOrganiserBookingRefund } from "../../organiserBookingAmendments";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let rows: any[];
let orders: any[];
const settle = vi.spyOn(db, "settleBookingPaymentAdjustmentsFromCallable");
beforeEach(() => {
  vi.resetAllMocks();
  const allocation = { id: id(20), ticketOrderId: id(30), allocatedAmountMinor: 5000, refundedAmountMinor: 2000, refundPendingAmountMinor: 0, stripeRefundId: "re_old", createdAt: "2026-10-01" };
  const line = (priceMinor: number, allocationList: any[]) => ({priceMinor, ticketType: {id: id(40), price: priceMinor/100}, bookingPlace: {id: id(priceMinor), paymentAllocations: allocationList} });
  rows = [
    { id: id(1), revisionGroupId: id(50), revisionNumber: 1, status: "CONFIRMED", supersededAt: "2026-10-02", lines: [line(5000,[allocation])] },
    { id: id(2), revisionGroupId: id(50), revisionNumber: 2, status: "CONFIRMED", supersededAt: "2026-10-03", clientSubmissionKey: id(60), supersedesBooking: {id: id(1)}, lines: [line(3000,[])] },
    { id: id(3), revisionGroupId: id(50), revisionNumber: 3, status: "CONFIRMED", supersededAt: null, lines: [line(7000,[{...allocation,id:id(21),ticketOrderId:id(31),allocatedAmountMinor:4000,refundedAmountMinor:0,stripeRefundId:null,createdAt:"2026-10-03"}])] },
  ];
  orders = [{ id:id(30),status:"PAID",stripePaymentIntentId:"pi_original" },{ id:id(31),status:"PAID",stripePaymentIntentId:"pi_topup" }];
  vi.spyOn(db,"getBookingRevisionForApprovalFromCallable").mockResolvedValue({data:{booking:{...rows[0],event:{id:id(70),section:{id:id(80)}},booker:{id:"payer"}}}} as never);
  vi.spyOn(db,"getEventByIdForCallable").mockResolvedValue({data:{event:{id:id(70)}}} as never);
  vi.spyOn(db,"getBookingsForBookerAndEvent").mockImplementation(async () => ({data:{user:{bookings:rows,ticketOrders:orders}}}) as never);
  vi.spyOn(db,"updateBookingPlaceAllocationRefundStateFromCallable").mockResolvedValue({} as never);
  settle.mockResolvedValue({} as never);
  stripe.refunds.create.mockResolvedValue({id:"re_wrong",status:"succeeded"});
});
const request = (data: any) => ({auth:{uid:"organiser",token:{enabled:true,admin:true}},data}) as any;
describe("organiser booking amendment recovery", () => {
  it("replaying a superseded amendment preserves the current bookings payment", async () => {
    await amendEventBookingAsOrganiser.run(request({bookingId:id(1),expectedRevisionNumber:1,idempotencyKey:id(60),lines:[],confirm:true}));
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  it("explicit retry rejects a superseded booking", async () => {
    await expect(retryOrganiserBookingRefund.run(request({bookingId:id(2)}))).rejects.toMatchObject({code:"aborted"});
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  it("keeps an existing pending refund unsettled on retry", async () => {
    rows = rows.slice(0,2);
    rows[0].lines[0].bookingPlace.paymentAllocations[0].refundedAmountMinor = 0;
    rows[0].lines[0].bookingPlace.paymentAllocations[0].refundPendingAmountMinor = 2000;
    rows[1].supersededAt = null;
    await retryOrganiserBookingRefund.run(request({bookingId:id(2)}));
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });
});


it("retains a pre-existing pending refund when another refund on that allocation succeeds", async () => {
  rows = rows.slice(0, 2);
  rows[0].lines[0].bookingPlace.paymentAllocations[0].refundedAmountMinor = 0;
  rows[0].lines[0].bookingPlace.paymentAllocations[0].refundPendingAmountMinor = 1000;
  rows[1].supersededAt = null;
  await retryOrganiserBookingRefund.run(request({ bookingId: id(2) }));
  expect(stripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000 }), expect.anything());
  expect(db.updateBookingPlaceAllocationRefundStateFromCallable).toHaveBeenCalledWith(expect.objectContaining({ refundedAmountMinor: 1000, refundPendingAmountMinor: 1000 }));
  expect(settle).not.toHaveBeenCalled();
});

it("settles a current refund after it completes", async () => {
  rows = rows.slice(0, 2);
  rows[0].lines[0].bookingPlace.paymentAllocations[0].refundedAmountMinor = 0;
  rows[1].supersededAt = null;
  await retryOrganiserBookingRefund.run(request({ bookingId: id(2) }));
  expect(stripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000 }), expect.anything());
  expect(settle).toHaveBeenCalledWith({ revisionBookingId: id(2), status: "SETTLED" });
});

it("cannot settle an outstanding charge through the refund retry endpoint", async () => {
  rows[2].lines[0].priceMinor = 9000;
  await retryOrganiserBookingRefund.run(request({ bookingId: id(3) }));
  expect(stripe.refunds.create).not.toHaveBeenCalled();
  expect(settle).not.toHaveBeenCalled();
});
