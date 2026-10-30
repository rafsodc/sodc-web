import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingApprovalStatus,
  MembershipStatus,
  SectionUserGroupPurpose,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import { getUserSecurityState } from "../../securityRepository";

const mocks = vi.hoisted(() => ({
  requireStripe: vi.fn(),
  createAllocatedTicketOrder: vi.fn(),
  confirmBookingIfFullyPaid: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn().mockImplementation((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));
vi.mock("../../paymentConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../paymentConfig")>()),
  APP_BASE_URL: "https://app.example/",
  requireStripe: mocks.requireStripe,
  stripeSecret: { value: () => "sk_test" },
}));
vi.mock("../../bookingPaymentPersistence", () => ({
  createAllocatedTicketOrder: mocks.createAllocatedTicketOrder,
}));
vi.mock("../../bookingPaymentFinalization", () => ({
  confirmBookingIfFullyPaid: mocks.confirmBookingIfFullyPaid,
}));

import {
  bookingCheckoutIdempotencyKey,
  createEventBookingCheckoutSession,
  createTicketCheckoutSession,
} from "../../paymentCheckoutCallables";

const USER_ID = "user-1";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_GROUP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TICKET_TYPE_ID = "44444444-4444-4444-8444-444444444444";
const ORDER_ID = "55555555-5555-4555-8555-555555555555";
const STALE_ORDER_ID = "66666666-6666-4666-8666-666666666666";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const PLACE_A = "88888888-8888-4888-8888-888888888888";
const PLACE_B = "99999999-9999-4999-8999-999999999999";

const consumeRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const ensureRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const getUser = vi.spyOn(admin, "getUserForCheckout");
const getTicketType = vi.spyOn(admin, "getTicketTypeForCheckout");
const getSection = vi.spyOn(admin, "getSectionByIdForCallable");
const getUserGroups = vi.spyOn(admin, "getUserUserGroupsForAdmin");
const getBookings = vi.spyOn(admin, "getBookingsForBookerAndEvent");
const getOrders = vi.spyOn(admin, "getTicketOrdersForBookerAndEvent");
const markFailed = vi.spyOn(admin, "markTicketOrderFailedFromWebhook");
const updateAllocationRefund = vi.spyOn(admin, "updateBookingPlaceAllocationRefundFromCallable");

type Handler = (request: { auth?: { uid: string; token: Record<string, unknown> }; data: Record<string, unknown> }) => Promise<unknown>;
const ticketHandler = createTicketCheckoutSession as unknown as Handler;
const eventHandler = createEventBookingCheckoutSession as unknown as Handler;

function enabledRequest(data: Record<string, unknown>) {
  return { auth: { uid: USER_ID, token: { enabled: true, securityVersion: 1 } }, data };
}

function ticketType(price = 50) {
  return {
    id: TICKET_TYPE_ID,
    title: "Member ticket",
    price,
    audience: TicketAudience.MEMBER,
    userGroup: { id: GROUP_ID, membershipStatuses: null },
    event: {
      id: EVENT_ID,
      title: "Annual dinner",
      bookingStartDateTime: "2020-01-01T00:00:00.000Z",
      bookingEndDateTime: "2100-01-01T00:00:00.000Z",
      section: { id: SECTION_ID },
    },
  };
}

function booking(approvalStatus: BookingApprovalStatus, prices = [50]): any {
  return {
    id: BOOKING_ID,
    status: "SUBMITTED",
    approvalStatus,
    revisionGroupId: BOOKING_ID,
    revisionNumber: 1,
    supersededAt: null,
    lines: prices.map((price, index) => ({
      id: `line-${index}`,
      bookingPlace: {
        id: index === 0 ? PLACE_A : PLACE_B,
        paymentAllocations: [],
      },
      sortOrder: index,
      ticketType: { id: TICKET_TYPE_ID, title: "Member ticket", price, audience: TicketAudience.MEMBER },
    })),
  };
}

function stripeClient() {
  return {
    customers: { create: vi.fn(async () => ({ id: "cus_new" })) },
    refunds: { create: vi.fn(async () => ({ id: "re_test_1" })) },
    checkout: { sessions: { create: vi.fn(async () => ({ id: "cs_test_1", url: "https://checkout.stripe.test/session" })) } },
  };
}

describe("payment checkout callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserSecurityState).mockResolvedValue({ data: { userSecurityState: {
      userId: USER_ID, securityVersion: 1, membershipStatus: "REGULAR", accessReady: true,
      adminReady: true, syncStatus: "READY", user: { membershipStatus: "REGULAR" },
    } } } as never);
    ensureRateLimitBucket.mockResolvedValue({ data: {} } as never);
    consumeRateLimit.mockResolvedValue({ data: {} } as never);
    getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "member@example.com", firstName: "Sam", lastName: "Member", membershipStatus: MembershipStatus.REGULAR, stripeCustomerId: "cus_existing" } } } as never);
    getTicketType.mockResolvedValue({ data: { ticketType: ticketType() } } as never);
    getSection.mockResolvedValue({ data: { section: { id: SECTION_ID, purposeLinks: [{ purposes: [SectionUserGroupPurpose.BOOKER], userGroup: { id: GROUP_ID, membershipStatuses: null } }] } } } as never);
    getUserGroups.mockResolvedValue({ data: { user: { userGroups: [{ userGroup: { id: GROUP_ID } }] } } } as never);
    getOrders.mockResolvedValue({ data: { user: { ticketOrders: [] } } } as never);
    markFailed.mockResolvedValue({ data: {} } as never);
    updateAllocationRefund.mockResolvedValue({ data: {} } as never);
    mocks.createAllocatedTicketOrder.mockResolvedValue(ORDER_ID);
    mocks.confirmBookingIfFullyPaid.mockResolvedValue({ bookingId: BOOKING_ID, confirmed: true });
  });

  it("blocks the direct ticket callable so clients cannot bypass booking approval", async () => {
    await expect(ticketHandler(enabledRequest({ ticketTypeId: TICKET_TYPE_ID, quantity: 1 }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(getTicketType).not.toHaveBeenCalled();
    expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
    expect(mocks.requireStripe).not.toHaveBeenCalled();
  });

  it.each([BookingApprovalStatus.PENDING, BookingApprovalStatus.REJECTED])(
    "rejects a %s booking before order or Stripe creation",
    async (approvalStatus) => {
      getBookings.mockResolvedValue({ data: { user: { bookings: [booking(approvalStatus)] } } } as never);
      await expect(eventHandler(enabledRequest({ eventId: EVENT_ID }))).rejects.toMatchObject({ code: "failed-precondition" });
      expect(getOrders).not.toHaveBeenCalled();
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    }
  );

  it("creates one order with explicit allocations for same-type booking places", async () => {
    getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.APPROVED, [50, 50])] } } } as never);
    const stripe = stripeClient();
    mocks.requireStripe.mockReturnValue(stripe);

    const result = await eventHandler(enabledRequest({ eventId: EVENT_ID }));

    expect(mocks.createAllocatedTicketOrder).toHaveBeenCalledWith({
      userId: USER_ID,
      eventId: EVENT_ID,
      ticketTypeId: TICKET_TYPE_ID,
      unitAmountMinor: 5000,
      bookingPlaceIds: [PLACE_A, PLACE_B],
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [expect.objectContaining({ quantity: 2 })],
        metadata: expect.objectContaining({ orderId: ORDER_ID, orderIds: ORDER_ID }),
        payment_intent_data: {
          metadata: expect.objectContaining({ orderId: ORDER_ID, orderIds: ORDER_ID }),
        },
      }),
      { idempotencyKey: bookingCheckoutIdempotencyKey(BOOKING_ID, [ORDER_ID]) }
    );
    expect(result).toEqual({ url: "https://checkout.stripe.test/session", orderIds: [ORDER_ID], confirmed: false });
  });

  it("charges £105 for two unpaid current tickets and replaces a pending order that includes a removed guest", async () => {
    const current = booking(BookingApprovalStatus.APPROVED, [70, 35, 70, 70]);
    const guestFull = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const removedGuest = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    current.lines[2].bookingPlace.id = guestFull;
    current.lines[3].bookingPlace.id = removedGuest;
    current.lines[3].bookingPlace.attendanceRemoved = true;
    current.lines[0].bookingPlace.paymentAllocations = [{
      id: "paid-allocation", ticketOrderId: "paid-member-order", allocatedAmountMinor: 7000, refundedAmountMinor: 0,
    }];
    getBookings.mockResolvedValue({ data: { user: { bookings: [current], ticketOrders: [
      { id: "paid-member-order", status: TicketOrderStatus.PAID, stripePaymentIntentId: "pi_paid_member" },
    ] } } } as never);
    getOrders.mockResolvedValue({ data: { user: { ticketOrders: [
      { id: ORDER_ID, status: TicketOrderStatus.PENDING, quantity: 1, unitAmountMinor: 3500,
        ticketType: { id: TICKET_TYPE_ID }, paymentAllocations: [{ bookingPlace: { id: PLACE_B } }] },
      { id: STALE_ORDER_ID, status: TicketOrderStatus.PENDING, quantity: 2, unitAmountMinor: 7000,
        ticketType: { id: TICKET_TYPE_ID }, paymentAllocations: [{ bookingPlace: { id: guestFull } }, { bookingPlace: { id: removedGuest } }] },
    ] } } } as never);
    const stripe = stripeClient();
    mocks.requireStripe.mockReturnValue(stripe);
    mocks.createAllocatedTicketOrder.mockResolvedValue("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    await eventHandler(enabledRequest({ eventId: EVENT_ID }));
    expect(markFailed).toHaveBeenCalledExactlyOnceWith({ id: STALE_ORDER_ID, webhookEventId: `checkout-supersede:${STALE_ORDER_ID}` });
    expect(mocks.createAllocatedTicketOrder).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID, eventId: EVENT_ID, ticketTypeId: TICKET_TYPE_ID, unitAmountMinor: 7000, bookingPlaceIds: [guestFull],
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ line_items: [
      expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 3500 }) }),
      expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 7000 }) }),
    ] }), expect.anything());
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("allows an eligible member with a payment-ready booking to pay after closing", async () => {
    const closedTicketType = ticketType();
    closedTicketType.event.bookingEndDateTime = "2021-01-01T00:00:00.000Z";
    getTicketType.mockResolvedValue({ data: { ticketType: closedTicketType } } as never);
    getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.NOT_REQUIRED)] } } } as never);
    const stripe = stripeClient();
    mocks.requireStripe.mockReturnValue(stripe);

    await expect(eventHandler(enabledRequest({ eventId: EVENT_ID }))).resolves.toMatchObject({
      url: "https://checkout.stripe.test/session",
    });
  });

  it("allows a matching section moderator to pay before bookings open", async () => {
    const futureTicketType = ticketType();
    futureTicketType.event.bookingStartDateTime = "2101-01-01T00:00:00.000Z";
    futureTicketType.event.bookingEndDateTime = "2102-01-01T00:00:00.000Z";
    getTicketType.mockResolvedValue({ data: { ticketType: futureTicketType } } as never);
    getSection.mockResolvedValue({ data: { section: { id: SECTION_ID, purposeLinks: [
      { purposes: [SectionUserGroupPurpose.BOOKER], userGroup: { id: GROUP_ID, membershipStatuses: null } },
      { purposes: [SectionUserGroupPurpose.MODERATOR], userGroup: { id: GROUP_ID, membershipStatuses: null } },
    ] } } } as never);
    getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.NOT_REQUIRED)] } } } as never);
    const stripe = stripeClient();
    mocks.requireStripe.mockReturnValue(stripe);

    await expect(eventHandler(enabledRequest({ eventId: EVENT_ID }))).resolves.toMatchObject({
      url: "https://checkout.stripe.test/session",
    });
  });

  it("rejects checkout before opening when the moderator group belongs to another section", async () => {
    const futureTicketType = ticketType();
    futureTicketType.event.bookingStartDateTime = "2101-01-01T00:00:00.000Z";
    futureTicketType.event.bookingEndDateTime = "2102-01-01T00:00:00.000Z";
    getTicketType.mockResolvedValue({ data: { ticketType: futureTicketType } } as never);
    getSection.mockResolvedValue({ data: { section: { id: SECTION_ID, purposeLinks: [
      { purposes: [SectionUserGroupPurpose.BOOKER], userGroup: { id: GROUP_ID, membershipStatuses: null } },
      { purposes: [SectionUserGroupPurpose.MODERATOR], userGroup: { id: OTHER_GROUP_ID, membershipStatuses: null } },
    ] } } } as never);
    getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.NOT_REQUIRED)] } } } as never);

    await expect(eventHandler(enabledRequest({ eventId: EVENT_ID }))).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(mocks.requireStripe).not.toHaveBeenCalled();
  });

  it("reuses only an exactly allocated pending order and fails stale pending orders", async () => {
    const current = booking(BookingApprovalStatus.NOT_REQUIRED);
    getBookings.mockResolvedValue({ data: { user: { bookings: [current] } } } as never);
    getOrders.mockResolvedValue({ data: { user: { ticketOrders: [
      { id: ORDER_ID, status: TicketOrderStatus.PENDING, quantity: 1, unitAmountMinor: 5000, totalAmountMinor: 5000, createdAt: "2026-08-01T12:00:00Z", ticketType: { id: TICKET_TYPE_ID }, event: { id: EVENT_ID }, paymentAllocations: [{ id: "allocation", allocatedAmountMinor: 5000, bookingPlace: { id: PLACE_A } }] },
      { id: STALE_ORDER_ID, status: TicketOrderStatus.PENDING, quantity: 1, unitAmountMinor: 5000, totalAmountMinor: 5000, createdAt: "2026-08-01T11:00:00Z", ticketType: { id: TICKET_TYPE_ID }, event: { id: EVENT_ID }, paymentAllocations: [] },
    ] } } } as never);
    const stripe = stripeClient();
    mocks.requireStripe.mockReturnValue(stripe);

    await eventHandler(enabledRequest({ eventId: EVENT_ID }));

    expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith({ id: STALE_ORDER_ID, webhookEventId: `checkout-supersede:${STALE_ORDER_ID}` });
  });

  it("creates paid zero-value allocations, confirms, and never contacts Stripe", async () => {
    getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.NOT_REQUIRED, [0])] } } } as never);

    const result = await eventHandler(enabledRequest({ eventId: EVENT_ID }));

    expect(mocks.createAllocatedTicketOrder).toHaveBeenCalledWith(expect.objectContaining({
      bookingPlaceIds: [PLACE_A],
      unitAmountMinor: 0,
      status: TicketOrderStatus.PAID,
      webhookEventId: `free-checkout:${BOOKING_ID}`,
    }));
    expect(mocks.confirmBookingIfFullyPaid).toHaveBeenCalledWith({ bookerId: USER_ID, eventId: EVENT_ID });
    expect(mocks.requireStripe).not.toHaveBeenCalled();
    expect(result).toEqual({ url: null, orderIds: [], confirmed: true });
  });

  it("refunds a negative revision delta against its exact allocation idempotently", async () => {
    const initial = booking(BookingApprovalStatus.APPROVED, [40]);
    initial.lines[0]!.bookingPlace.paymentAllocations = [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      allocatedAmountMinor: 5000,
      refundedAmountMinor: 0,
      stripeRefundId: null,
      createdAt: "2026-08-01T10:00:00Z",
      ticketOrder: { id: ORDER_ID, status: TicketOrderStatus.PAID, stripePaymentIntentId: "pi_test_1" },
    }] as never;
    const refreshed = structuredClone(initial);
    refreshed.lines[0]!.bookingPlace.paymentAllocations[0]!.refundedAmountMinor = 1000;
    getBookings
      .mockResolvedValueOnce({ data: { user: { bookings: [initial] } } } as never)
      .mockResolvedValueOnce({ data: { user: { bookings: [refreshed] } } } as never);
    const stripe = stripeClient();
    mocks.requireStripe.mockReturnValue(stripe);

    const result = await eventHandler(enabledRequest({ eventId: EVENT_ID }));

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_test_1",
        amount: 1000,
        metadata: expect.objectContaining({
          ticketOrderId: ORDER_ID,
          allocationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          refundAmountMinor: "1000",
          resultingRefundedAmountMinor: "1000",
        }),
      }),
      { idempotencyKey: `booking-refund:${BOOKING_ID}:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:1000` }
    );
    expect(updateAllocationRefund).toHaveBeenCalledWith({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      refundedAmountMinor: 1000,
      stripeRefundId: "re_test_1",
    });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(result).toEqual({ url: null, orderIds: [], confirmed: true });
  });
  describe("current administrator early checkout", () => {
    function adminRequest(data: Record<string, unknown> = { eventId: EVENT_ID }) {
      const input = enabledRequest(data);
      return { ...input, auth: { ...input.auth, token: { ...input.auth.token, admin: true } } };
    }
    function setAuthority(overrides: Record<string, unknown>) {
      vi.mocked(getUserSecurityState).mockResolvedValue({ data: { userSecurityState: {
        userId: USER_ID, securityVersion: 1, membershipStatus: "REGULAR", accessReady: true,
        adminReady: true, syncStatus: "READY", user: { membershipStatus: "REGULAR" }, ...overrides,
      } } } as never);
    }
    beforeEach(() => {
      const futureTicket = ticketType();
      futureTicket.event.bookingStartDateTime = "2099-01-01";
      futureTicket.event.bookingEndDateTime = "2100-01-01";
      getTicketType.mockResolvedValue({ data: { ticketType: futureTicket } } as never);
      getSection.mockResolvedValue({ data: { section: { id: SECTION_ID, purposeLinks: [
        { purposes: [SectionUserGroupPurpose.ACCESS, SectionUserGroupPurpose.BOOKER], userGroup: { id: GROUP_ID, membershipStatuses: null } },
      ] } } } as never);
      getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.NOT_REQUIRED)] } } } as never);
      mocks.requireStripe.mockReturnValue(stripeClient());
    });

    it("allows eligible admin checkout before opening without moderator membership", async () => {
      await expect(eventHandler(adminRequest())).resolves.toMatchObject({ url: "https://checkout.stripe.test/session" });
      expect(mocks.createAllocatedTicketOrder).toHaveBeenCalledOnce();
    });

    it("allows the same admin exception for a free booking without contacting Stripe", async () => {
      getBookings.mockResolvedValue({ data: { user: { bookings: [booking(BookingApprovalStatus.NOT_REQUIRED, [0])] } } } as never);
      await expect(eventHandler(adminRequest())).resolves.toMatchObject({ confirmed: true });
      expect(mocks.createAllocatedTicketOrder).toHaveBeenCalledWith(expect.objectContaining({ status: TicketOrderStatus.PAID }));
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it("requires current section access for the newly granted administrator early exception", async () => {
      getSection.mockResolvedValue({ data: { section: { id: SECTION_ID, purposeLinks: [
        { purposes: [SectionUserGroupPurpose.BOOKER], userGroup: { id: GROUP_ID, membershipStatuses: null } },
      ] } } } as never);
      await expect(eventHandler(adminRequest())).rejects.toThrow(/not open/);
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
      expect(markFailed).not.toHaveBeenCalled();
      expect(updateAllocationRefund).not.toHaveBeenCalled();
    });

    it("preserves existing after-close checkout eligibility without adding a new section access gate", async () => {
      const closed = ticketType();
      closed.event.bookingEndDateTime = "2020-02-01";
      getTicketType.mockResolvedValue({ data: { ticketType: closed } } as never);
      getSection.mockResolvedValue({ data: { section: { id: SECTION_ID, purposeLinks: [
        { purposes: [SectionUserGroupPurpose.BOOKER], userGroup: { id: GROUP_ID, membershipStatuses: null } },
      ] } } } as never);
      await expect(eventHandler(adminRequest())).resolves.toMatchObject({ url: "https://checkout.stripe.test/session" });
    });

    it("keeps the disabled direct-ticket checkout refused for administrators", async () => {
      await expect(ticketHandler(adminRequest({ ticketTypeId: TICKET_TYPE_ID, quantity: 1 }))).rejects.toThrow(/no longer supported/);
      expect(getTicketType).not.toHaveBeenCalled();
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it.each(["booker", "ticket group"])("keeps %s eligibility required for admin checkout", async (gate) => {
      if (gate === "booker") {
        getSection.mockResolvedValue({ data: { section: { purposeLinks: [] } } } as never);
      } else {
        getUserGroups.mockResolvedValue({ data: { user: { userGroups: [] } } } as never);
        getSection.mockResolvedValue({ data: { section: { purposeLinks: [{ purposes: [SectionUserGroupPurpose.BOOKER],
          userGroup: { id: GROUP_ID, membershipStatuses: [MembershipStatus.REGULAR] },
        }] } } } as never);
      }
      await expect(eventHandler(adminRequest())).rejects.toMatchObject({ code: "permission-denied" });
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it.each([BookingApprovalStatus.PENDING, BookingApprovalStatus.REJECTED])("does not bypass %s approval", async (status) => {
      getBookings.mockResolvedValue({ data: { user: { bookings: [booking(status)] } } } as never);
      await expect(eventHandler(adminRequest())).rejects.toMatchObject({ code: "failed-precondition" });
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it.each([["invalid", "2100-01-01"], ["2100-01-01", "2099-01-01"]])("rejects invalid admin windows", async (start, end) => {
      const invalidTicket = ticketType();
      invalidTicket.event.bookingStartDateTime = start;
      invalidTicket.event.bookingEndDateTime = end;
      getTicketType.mockResolvedValue({ data: { ticketType: invalidTicket } } as never);
      await expect(eventHandler(adminRequest())).rejects.toMatchObject({ code: "failed-precondition" });
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it("denies the early exception when server admin readiness has been revoked", async () => {
      setAuthority({ adminReady: false });
      await expect(eventHandler(adminRequest())).rejects.toThrow(/not open/);
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it("ignores body administrator and override flags", async () => {
      await expect(eventHandler(enabledRequest({ eventId: EVENT_ID, isAdmin: true, verifiedAdmin: true }))).rejects.toThrow(/not open/);
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it.each([
      ["stale", { securityVersion: 2 }, "unauthenticated"],
      ["revoked", { accessReady: false }, "permission-denied"],
      ["synchronizing", { syncStatus: "PENDING" }, "permission-denied"],
      ["restricted", { membershipStatus: "SUSPENDED", user: { membershipStatus: "SUSPENDED" } }, "permission-denied"],
    ])("rejects %s current authorization on both checkout entry points", async (_label, state, code) => {
      setAuthority(state);
      await expect(eventHandler(adminRequest())).rejects.toMatchObject({ code });
      await expect(ticketHandler(adminRequest())).rejects.toMatchObject({ code });
      expect(getBookings).not.toHaveBeenCalled();
      expect(getTicketType).not.toHaveBeenCalled();
      expect(mocks.createAllocatedTicketOrder).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });

    it("rejects disabled administrator claims on both checkout entry points", async () => {
      const input = adminRequest();
      input.auth.token.enabled = false;
      await expect(eventHandler(input)).rejects.toMatchObject({ code: "permission-denied" });
      await expect(ticketHandler(input)).rejects.toMatchObject({ code: "permission-denied" });
      expect(getBookings).not.toHaveBeenCalled();
      expect(mocks.requireStripe).not.toHaveBeenCalled();
    });
  });

});
