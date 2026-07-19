import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MembershipStatus,
  SectionUserGroupPurpose,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";

const paymentConfigMocks = vi.hoisted(() => ({
  requireStripe: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn().mockImplementation((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("../paymentConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../paymentConfig")>()),
  APP_BASE_URL: "https://app.example/",
  requireStripe: paymentConfigMocks.requireStripe,
  stripeSecret: { value: () => "sk_test" },
}));

import {
  createEventBookingCheckoutSession,
  createTicketCheckoutSession,
} from "../paymentCheckoutCallables";

const USER_ID = "user-1";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const TICKET_TYPE_ID = "44444444-4444-4444-8444-444444444444";
const ORDER_ID = "55555555-5555-4555-8555-555555555555";
const STALE_ORDER_ID = "66666666-6666-4666-8666-666666666666";

const consumeRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const ensureRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const getUser = vi.spyOn(admin, "getUserForCheckout");
const getTicketType = vi.spyOn(admin, "getTicketTypeForCheckout");
const getSection = vi.spyOn(admin, "getSectionByIdForCallable");
const getUserGroups = vi.spyOn(admin, "getUserUserGroupsForAdmin");
const createOrder = vi.spyOn(admin, "createTicketOrderForCheckout");
const updateCustomer = vi.spyOn(admin, "updateUserStripeCustomerId");
const getBookings = vi.spyOn(admin, "getBookingsForBookerAndEvent");
const getOrders = vi.spyOn(admin, "getTicketOrdersForBookerAndEvent");
const markFailed = vi.spyOn(admin, "markTicketOrderFailedFromWebhook");

type Handler = (request: {
  auth?: { uid: string; token: Record<string, unknown> };
  data: Record<string, unknown>;
}) => Promise<unknown>;

const ticketHandler = createTicketCheckoutSession as unknown as Handler;
const eventHandler = createEventBookingCheckoutSession as unknown as Handler;

function ticketType() {
  return {
    id: TICKET_TYPE_ID,
    title: "Member ticket",
    price: 50,
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

function stripeClient() {
  return {
    customers: {
      create: vi.fn(async () => ({ id: "cus_new" })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: "cs_test_1",
          url: "https://checkout.stripe.test/session",
        })),
      },
    },
  };
}

function enabledRequest(data: Record<string, unknown>) {
  return {
    auth: { uid: USER_ID, token: { enabled: true } },
    data,
  };
}

describe("payment checkout callables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureRateLimitBucket.mockResolvedValue({ data: {} } as never);
    consumeRateLimit.mockResolvedValue({ data: {} } as never);
    getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "member@example.com",
          firstName: "Sam",
          lastName: "Member",
          membershipStatus: MembershipStatus.REGULAR,
          stripeCustomerId: "cus_existing",
        },
      },
    } as never);
    getTicketType.mockResolvedValue({
      data: { ticketType: ticketType() },
    } as never);
    getSection.mockResolvedValue({
      data: {
        section: {
          id: SECTION_ID,
          purposeLinks: [
            {
              purposes: [SectionUserGroupPurpose.BOOKER],
              userGroup: { id: GROUP_ID, membershipStatuses: null },
            },
          ],
        },
      },
    } as never);
    getUserGroups.mockResolvedValue({
      data: {
        user: {
          userGroups: [{ userGroup: { id: GROUP_ID } }],
        },
      },
    } as never);
    createOrder.mockResolvedValue({
      data: { ticketOrder_insert: { id: ORDER_ID } },
    } as never);
    updateCustomer.mockResolvedValue({ data: {} } as never);
    markFailed.mockResolvedValue({ data: {} } as never);
  });

  it("creates the order before the Stripe session and returns stable metadata", async () => {
    const stripe = stripeClient();
    paymentConfigMocks.requireStripe.mockReturnValue(stripe);

    const result = await ticketHandler(
      enabledRequest({ ticketTypeId: TICKET_TYPE_ID, quantity: 2 })
    );

    expect(createOrder).toHaveBeenCalledWith({
      userId: USER_ID,
      eventId: EVENT_ID,
      ticketTypeId: TICKET_TYPE_ID,
      quantity: 2,
      unitAmountMinor: 5000,
      totalAmountMinor: 10000,
      currency: "gbp",
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        metadata: expect.objectContaining({
          firebaseUid: USER_ID,
          orderId: ORDER_ID,
          orderIds: ORDER_ID,
        }),
      })
    );
    expect(createOrder.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.checkout.sessions.create.mock.invocationCallOrder[0]
    );
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(result).toEqual({
      url: "https://checkout.stripe.test/session",
      orderId: ORDER_ID,
    });
  });

  it("creates and persists a Stripe customer before creating an order", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "member@example.com",
          firstName: "Sam",
          lastName: "Member",
          membershipStatus: MembershipStatus.REGULAR,
          stripeCustomerId: null,
        },
      },
    } as never);
    const stripe = stripeClient();
    paymentConfigMocks.requireStripe.mockReturnValue(stripe);

    await ticketHandler(
      enabledRequest({ ticketTypeId: TICKET_TYPE_ID, quantity: 1 })
    );

    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: "member@example.com",
      name: "Sam Member",
      metadata: { firebaseUid: USER_ID },
    });
    expect(updateCustomer).toHaveBeenCalledWith({
      userId: USER_ID,
      stripeCustomerId: "cus_new",
    });
    expect(updateCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      createOrder.mock.invocationCallOrder[0]
    );
  });

  it("rejects invalid quantities before reading checkout data or calling Stripe", async () => {
    const stripe = stripeClient();
    paymentConfigMocks.requireStripe.mockReturnValue(stripe);

    await expect(
      ticketHandler(enabledRequest({ ticketTypeId: TICKET_TYPE_ID, quantity: 0 }))
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(getUser).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(paymentConfigMocks.requireStripe).not.toHaveBeenCalled();
  });

  it("propagates Stripe session failures after preserving the pending order", async () => {
    const stripe = stripeClient();
    stripe.checkout.sessions.create.mockRejectedValueOnce(
      new Error("Stripe unavailable")
    );
    paymentConfigMocks.requireStripe.mockReturnValue(stripe);

    await expect(
      ticketHandler(enabledRequest({ ticketTypeId: TICKET_TYPE_ID, quantity: 1 }))
    ).rejects.toThrow("Stripe unavailable");

    expect(createOrder).toHaveBeenCalledOnce();
    expect(createOrder.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.checkout.sessions.create.mock.invocationCallOrder[0]
    );
  });

  it("reuses the newest matching order and expires stale pending orders before Stripe", async () => {
    getBookings.mockResolvedValue({
      data: {
        user: {
          bookings: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              status: "SUBMITTED",
              revisionNumber: 1,
              supersededAt: null,
              lines: [
                {
                  id: "88888888-8888-4888-8888-888888888888",
                  ticketType: {
                    id: TICKET_TYPE_ID,
                    title: "Member ticket",
                    price: 50,
                    audience: TicketAudience.MEMBER,
                  },
                },
              ],
              guestTicketRequests: [],
            },
          ],
        },
      },
    } as never);
    getOrders.mockResolvedValue({
      data: {
        user: {
          ticketOrders: [
            {
              id: ORDER_ID,
              status: TicketOrderStatus.PENDING,
              quantity: 1,
              createdAt: "2026-07-17T12:00:00.000Z",
              ticketType: { id: TICKET_TYPE_ID },
              event: { id: EVENT_ID },
            },
            {
              id: STALE_ORDER_ID,
              status: TicketOrderStatus.PENDING,
              quantity: 1,
              createdAt: "2026-07-17T11:00:00.000Z",
              ticketType: { id: TICKET_TYPE_ID },
              event: { id: EVENT_ID },
            },
          ],
        },
      },
    } as never);
    const stripe = stripeClient();
    paymentConfigMocks.requireStripe.mockReturnValue(stripe);

    const result = await eventHandler(enabledRequest({ eventId: EVENT_ID }));

    expect(markFailed).toHaveBeenCalledWith({
      id: STALE_ORDER_ID,
      webhookEventId: `checkout-supersede:${STALE_ORDER_ID}`,
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(markFailed.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.checkout.sessions.create.mock.invocationCallOrder[0]
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          orderId: ORDER_ID,
          orderIds: ORDER_ID,
        }),
      })
    );
    expect(result).toEqual({
      url: "https://checkout.stripe.test/session",
      orderIds: [ORDER_ID],
    });
  });

  it("rejects missing active bookings before resolving Stripe", async () => {
    getBookings.mockResolvedValue({ data: { user: { bookings: [] } } } as never);
    const stripe = stripeClient();
    paymentConfigMocks.requireStripe.mockReturnValue(stripe);

    await expect(eventHandler(enabledRequest({ eventId: EVENT_ID }))).rejects.toMatchObject({
      code: "failed-precondition",
    });

    expect(getOrders).not.toHaveBeenCalled();
    expect(paymentConfigMocks.requireStripe).not.toHaveBeenCalled();
  });
});
