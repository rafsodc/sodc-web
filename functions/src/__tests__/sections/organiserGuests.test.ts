import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import * as db from "@dataconnect/admin-generated";
import { requireSectionModerator } from "../../sectionAccess";
import {
  createOrganiserGuestCheckout,
  getOrganiserGuestList,
  getOrganiserGuestTicket,
  guestPaymentStatus,
  manageOrganiserGuest,
  updateOrganiserGuestDietary,
} from "../../organiserGuests";
import { handleOrganiserGuestStripeEvent } from "../../organiserGuestPayments";
const stripe = vi.hoisted(() => ({
  checkout: {
    sessions: { create: vi.fn(), retrieve: vi.fn(), expire: vi.fn() },
  },
  refunds: { list: vi.fn() },
  paymentIntents: { retrieve: vi.fn() },
}));
vi.mock("../../paymentConfig", () => ({
  APP_BASE_URL: "https://example.test",
  stripeSecret: { value: () => "secret" },
  requireStripe: () => stripe,
}));
vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("../../sectionAccess", () => ({ requireSectionModerator: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const token = "a".repeat(64);
const tokenHash = createHash("sha256").update(token).digest("hex");
const base = {
  id,
  firstName: "First",
  lastName: "Last",
  email: "guest@example.test",
  dietaryRequirements: "None",
  priceMinor: 1000,
  includesDinner: true,
  includesSymposium: false,
  version: 1,
  checkoutKey: "attempt",
  stripeSessionId: null,
  stripePaymentIntentId: null,
  paidAt: null,
  refundedAmountMinor: 0,
  refundPendingMinor: 0,
  cancelledAt: null,
  createdBy: "organiser",
  updatedBy: "organiser",
  tokenHash,
  ticketType: { id, title: "Dinner" },
  event: {
    id,
    title: "Event",
    bookingEndDateTime: "2099-01-01T00:00:00Z",
    section: { id },
  },
};
let guest: typeof base;
const getByToken = vi.spyOn(db, "getOrganiserGuestByToken");
const getById = vi.spyOn(db, "getOrganiserGuest");
const dietary = vi.spyOn(db, "updateOrganiserGuestDietary");
const cancel = vi.spyOn(db, "cancelOrganiserGuest");
const rotate = vi.spyOn(db, "rotateOrganiserGuestLink");
const attach = vi.spyOn(db, "attachOrganiserGuestCheckout");
const paid = vi.spyOn(db, "markOrganiserGuestPaid");
const refund = vi.spyOn(db, "markOrganiserGuestRefunded");
const create = vi.spyOn(db, "createOrganiserGuest");
const typeQuery = vi.spyOn(db, "getOrganiserGuestType");
function request(data: Record<string, unknown>, authenticated = false) {
  return {
    data,
    ...(authenticated
      ? { auth: { uid: "organiser", token: { enabled: true } } }
      : {}),
  } as Parameters<typeof manageOrganiserGuest.run>[0];
}
const event = (type: string, object: unknown) => ({ type, data: { object } });
const session = {
  id: "cs_guest",
  metadata: { domain: "organiser-guest", guestId: id, checkoutKey: "attempt" },
  payment_status: "paid",
  payment_intent: "pi_guest",
  amount_total: 1000,
  currency: "gbp",
};
const webhook = (type: string, object: unknown) =>
  handleOrganiserGuestStripeEvent(event(type, object), stripe as never);
beforeEach(() => {
  vi.resetAllMocks();
  guest = structuredClone(base);
  getByToken.mockImplementation(
    async () => ({ data: { organiserGuests: [guest] } }) as never,
  );
  getById.mockImplementation(
    async () => ({ data: { organiserGuest: guest } }) as never,
  );
  vi.spyOn(db, "getOrganiserGuestEvent").mockResolvedValue({
    data: { event: base.event },
  });
  vi.spyOn(db, "listOrganiserGuests").mockResolvedValue({
    data: { organiserGuests: [base] },
  } as never);
  vi.spyOn(db, "listOrganiserGuestTypes").mockResolvedValue({
    data: { ticketTypes: [] },
  });
  typeQuery.mockResolvedValue({
    data: {
      ticketType: {
        ...base.ticketType,
        event: { id },
        audience: db.TicketAudience.ORGANISER_GUEST,
        price: 10,
        includesDinner: true,
        includesSymposium: false,
      },
    },
  });
  dietary.mockResolvedValue({} as never);
  cancel.mockResolvedValue({} as never);
  rotate.mockResolvedValue({} as never);
  paid.mockResolvedValue({} as never);
  refund.mockResolvedValue({} as never);
  create.mockResolvedValue({} as never);
  attach.mockResolvedValue({ data: { organiserGuest_updateMany: 1 } });
  stripe.checkout.sessions.create.mockResolvedValue({
    id: "cs_guest",
    status: "open",
    url: "https://checkout.stripe.test/session",
  });
});
describe("organiser guest capability and permissions", () => {
  it("allows a guest without an account, withholding email and internal references", async () => {
    const result = await getOrganiserGuestTicket.run(request({ token }));
    expect(result).toMatchObject({
      firstName: "First",
      dietaryEditable: true,
      paymentStatus: "UNPAID",
    });
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("tokenHash");
    expect(result).not.toHaveProperty("id");
    expect(getByToken).toHaveBeenCalledWith({ tokenHash });
  });
  it.each(["bad", "", null])(
    "rejects malformed tokens before querying (%s)",
    async (token) => {
      await expect(
        getOrganiserGuestTicket.run(request({ token })),
      ).rejects.toMatchObject({ code: "not-found" });
      expect(getByToken).not.toHaveBeenCalled();
    },
  );
  it("rejects a replaced token", async () => {
    getByToken.mockResolvedValue({ data: { organiserGuests: [] } });
    await expect(
      getOrganiserGuestTicket.run(request({ token })),
    ).rejects.toMatchObject({ code: "not-found" });
  });
  it("requires enabled authentication and section moderation for management", async () => {
    await expect(
      getOrganiserGuestList.run(request({ eventId: id })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    vi.mocked(requireSectionModerator).mockRejectedValue(new Error("denied"));
    await expect(
      getOrganiserGuestList.run(request({ eventId: id }, true)),
    ).rejects.toThrow();
    expect(db.listOrganiserGuests).not.toHaveBeenCalled();
  });
  it("checks the event section and strips capability/payment internals from the organiser list", async () => {
    const result = await getOrganiserGuestList.run(
      request({ eventId: id }, true),
    );
    expect(requireSectionModerator).toHaveBeenCalledWith(
      id,
      "organiser",
      false,
    );
    expect(result!.guests[0]).not.toHaveProperty("tokenHash");
    expect(result!.guests[0]).not.toHaveProperty("checkoutKey");
  });
  it("enforces the dietary deadline while the link remains readable", async () => {
    guest.event.bookingEndDateTime = "2020-01-01T00:00:00Z";
    expect(await getOrganiserGuestTicket.run(request({ token }))).toMatchObject(
      { dietaryEditable: false },
    );
    await expect(
      updateOrganiserGuestDietary.run(
        request({ token, version: 1, dietaryRequirements: "Vegan" }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(dietary).not.toHaveBeenCalled();
  });
  it("writes only dietary details, guarded by token hash and version", async () => {
    await updateOrganiserGuestDietary.run(
      request({
        token,
        version: 1,
        dietaryRequirements: "Vegan",
        email: "changed",
        firstName: "changed",
      }),
    );
    expect(dietary).toHaveBeenCalledWith({
      id,
      tokenHash,
      version: 1,
      dietaryRequirements: "Vegan",
    });
  });
  it("rejects cross-event guest changes", async () => {
    await expect(
      manageOrganiserGuest.run(
        request({ id, eventId: other, version: 1, action: "cancel" }, true),
      ),
    ).rejects.toMatchObject({ code: "not-found" });
    expect(cancel).not.toHaveBeenCalled();
  });
  it("treats repeated creation as one reservation and never discloses an existing link", async () => {
    expect(
      await manageOrganiserGuest.run(
        request({ id, eventId: id, action: "create" }, true),
      ),
    ).toMatchObject({ link: null });
    expect(create).not.toHaveBeenCalled();
  });
  it("snapshots guest-only ticket pricing and stores only a hash of the returned token", async () => {
    getById.mockResolvedValueOnce({ data: { organiserGuest: null } });
    const result = await manageOrganiserGuest.run(
      request(
        { ...base, eventId: id, ticketTypeId: id, action: "create" },
        true,
      ),
    );
    const returnedToken = result!.link!.split("#")[1];
    expect(returnedToken).toMatch(/^[a-f0-9]{64}$/);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        priceMinor: 1000,
        tokenHash: createHash("sha256").update(returnedToken).digest("hex"),
      }),
    );
  });
  it("rejects another event's guest ticket", async () => {
    getById.mockResolvedValueOnce({ data: { organiserGuest: null } });
    typeQuery.mockResolvedValue({
      data: {
        ticketType: {
          event: { id: other },
          audience: db.TicketAudience.ORGANISER_GUEST,
        },
      },
    } as never);
    await expect(
      manageOrganiserGuest.run(
        request(
          { ...base, eventId: id, ticketTypeId: id, action: "create" },
          true,
        ),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(create).not.toHaveBeenCalled();
  });
  it("replaces the link and checkout attempt while preserving reservation identity", async () => {
    await manageOrganiserGuest.run(
      request({ id, eventId: id, version: 1, action: "replace-link" }, true),
    );
    expect(rotate).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        version: 1,
        tokenHash: expect.not.stringMatching(tokenHash),
        checkoutKey: expect.any(String),
      }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
  it("rejects a standard member ticket for organiser allocation", async () => {
    getById.mockResolvedValueOnce({ data: { organiserGuest: null } });
    typeQuery.mockResolvedValue({
      data: {
        ticketType: {
          event: { id },
          audience: db.TicketAudience.MEMBER,
          price: 10,
        },
      },
    } as never);
    await expect(
      manageOrganiserGuest.run(
        request({ ...base, eventId: id, ticketTypeId: id, action: "create" }, true),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(create).not.toHaveBeenCalled();
  });
});
describe("organiser ticket reassignment", () => {
  it("reassigns an unpaid guest atomically while preserving their link and reservation identity", async () => {
    const reassign = vi.spyOn(db, "reassignOrganiserGuestTicket").mockResolvedValue({} as never);
    await manageOrganiserGuest.run(request({ ...base, eventId: id, ticketTypeId: other, action: "edit" }, true));
    expect(reassign).toHaveBeenCalledWith(expect.objectContaining({ id, version: 1, ticketTypeId: other, priceMinor: 1000, checkoutKey: expect.any(String) }));
    expect(reassign.mock.calls[0][0]).not.toHaveProperty("tokenHash");
    expect(cancel).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });
  it("rejects reassignment once a ticket is paid", async () => {
    Object.assign(guest, { paidAt: "2026-01-01", stripePaymentIntentId: "pi_guest" });
    const reassign = vi.spyOn(db, "reassignOrganiserGuestTicket");
    await expect(manageOrganiserGuest.run(request({ ...base, eventId: id, ticketTypeId: other, action: "edit" }, true))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(reassign).not.toHaveBeenCalled();
  });
});
describe("guest payments and cancellation", () => {
  it("allows payment after booking closes using the allocated price and a stable idempotency key", async () => {
    guest.event.bookingEndDateTime = "2020-01-01T00:00:00Z";
    await createOrganiserGuestCheckout.run(request({ token, amount: 1 }));
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 1000 }),
          }),
        ],
      }),
      { idempotencyKey: `organiser-guest:${id}:attempt` },
    );
  });
  it.each([
    { cancelledAt: "2026-01-01" },
    { paidAt: "2026-01-01" },
    { priceMinor: 0 },
  ])(
    "prevents checkout for cancelled, paid, or free tickets (%j)",
    async (state) => {
      Object.assign(guest, state);
      await expect(
        createOrganiserGuestCheckout.run(request({ token })),
      ).rejects.toMatchObject({ code: "failed-precondition" });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );
  it("expires checkout if cancellation or rotation wins the attach race", async () => {
    attach.mockResolvedValue({ data: { organiserGuest_updateMany: 0 } });
    await expect(
      createOrganiserGuestCheckout.run(request({ token })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_guest");
  });
  it("preserves late payment after cancellation and reports refund required", async () => {
    Object.assign(guest, { cancelledAt: "2026-01-01" });
    expect(await webhook("checkout.session.completed", session)).toBe(true);
    expect(paid).toHaveBeenCalledWith({
      id,
      sessionId: "cs_guest",
      paymentIntentId: "pi_guest",
    });
    expect(guestPaymentStatus({ ...guest, paidAt: "2026-01-01" })).toBe(
      "REFUND_REQUIRED",
    );
  });
  it("makes paid webhook replays a no-op and rejects conflicting payments", async () => {
    Object.assign(guest, {
      paidAt: "2026-01-01",
      stripePaymentIntentId: "pi_guest",
    });
    await webhook("checkout.session.completed", session);
    expect(paid).not.toHaveBeenCalled();
    await expect(
      webhook("checkout.session.completed", {
        ...session,
        payment_intent: "pi_other",
      }),
    ).rejects.toThrow("Duplicate");
  });
  it("rejects mismatched amounts", async () => {
    await expect(
      webhook("checkout.session.completed", { ...session, amount_total: 1 }),
    ).rejects.toThrow("mismatch");
    expect(paid).not.toHaveBeenCalled();
  });
  it("retains the reservation when Stripe checkout expires", async () => {
    expect(await webhook("checkout.session.expired", session)).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
  });
  it("records cumulative refunds monotonically and handles replay", async () => {
    Object.assign(guest, {
      paidAt: "2026-01-01",
      stripePaymentIntentId: "pi_guest",
    });
    stripe.paymentIntents.retrieve.mockResolvedValue({
      metadata: { domain: "organiser-guest", guestId: id },
    });
    stripe.refunds.list.mockResolvedValue({
      data: [{ status: "succeeded", amount: 500 }],
      has_more: false,
    });
    await webhook("charge.refunded", {
      payment_intent: "pi_guest",
      amount_refunded: 500,
    });
    expect(refund).toHaveBeenCalledWith({
      id,
      paymentIntentId: "pi_guest",
      refundedAmountMinor: 500,
      refundPendingMinor: 0,
      version: 1,
    });
    refund.mockClear();
    guest.refundedAmountMinor = 500;
    await webhook("charge.refunded", {
      payment_intent: "pi_guest",
      amount_refunded: 300,
    });
    expect(refund).not.toHaveBeenCalled();
  });
  it("shows pending refunds without calling them completed", async () => {
    Object.assign(guest, {
      paidAt: "2026-01-01",
      stripePaymentIntentId: "pi_guest",
      cancelledAt: "2026-01-02",
    });
    stripe.paymentIntents.retrieve.mockResolvedValue({
      metadata: { domain: "organiser-guest", guestId: id },
    });
    stripe.refunds.list.mockResolvedValue({
      data: [{ status: "pending", amount: 1000 }],
      has_more: false,
    });
    await webhook("refund.created", { payment_intent: "pi_guest" });
    expect(refund).toHaveBeenCalledWith({
      id,
      paymentIntentId: "pi_guest",
      refundedAmountMinor: 0,
      refundPendingMinor: 1000,
      version: 1,
    });
    expect(guestPaymentStatus({ ...guest, refundPendingMinor: 1000 })).toBe(
      "REFUND_PENDING",
    );
    stripe.refunds.list.mockResolvedValue({
      data: [{ status: "failed", amount: 1000 }],
      has_more: false,
    });
    guest.refundPendingMinor = 1000;
    await webhook("refund.failed", { payment_intent: "pi_guest" });
    expect(refund).toHaveBeenLastCalledWith({
      id,
      paymentIntentId: "pi_guest",
      refundedAmountMinor: 0,
      refundPendingMinor: 0,
      version: 1,
    });
  });
  it("retries expired checkout with a new key without releasing a reservation", async () => {
    Object.assign(guest, { stripeSessionId: "cs_expired" });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_expired",
      status: "expired",
    });
    const reset = vi
      .spyOn(db, "resetOrganiserGuestCheckout")
      .mockImplementation(async () => {
        Object.assign(guest, {
          stripeSessionId: null,
          checkoutKey: "next-attempt",
          version: 2,
        });
        return {} as never;
      });
    await createOrganiserGuestCheckout.run(request({ token }));
    expect(reset).toHaveBeenCalledWith({
      id,
      version: 1,
      checkoutKey: expect.any(String),
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.anything(),
      { idempotencyKey: `organiser-guest:${id}:next-attempt` },
    );
    expect(cancel).not.toHaveBeenCalled();
  });
  it.each([0, 1000])(
    "rejects dietary edits exactly at closing time for price %s",
    async (priceMinor) => {
      const now = Date.parse("2026-09-28T20:00:00Z");
      const clock = vi.spyOn(Date, "now").mockReturnValue(now);
      guest.priceMinor = priceMinor;
      guest.event.bookingEndDateTime = new Date(now).toISOString();
      try {
        await expect(
          updateOrganiserGuestDietary.run(
            request({ token, version: 1, dietaryRequirements: "Vegan" }),
          ),
        ).rejects.toMatchObject({ code: "failed-precondition" });
      } finally {
        clock.mockRestore();
      }
    },
  );
  it("maps concurrent mutation conflicts to refresh guidance", async () => {
    dietary.mockRejectedValue(new Error("GUEST_CONFLICT"));
    await expect(
      updateOrganiserGuestDietary.run(
        request({ token, version: 1, dietaryRequirements: "Vegan" }),
      ),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: expect.stringContaining("Refresh"),
    });
  });
  it("leaves member payment events to the existing handler", async () => {
    expect(
      await webhook("checkout.session.completed", {
        metadata: { orderIds: id },
      }),
    ).toBe(false);
  });
});
