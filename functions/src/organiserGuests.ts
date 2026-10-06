import { handleOrganiserGuestStripeEvent } from "./organiserGuestPayments";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import * as db from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireEnabled, requireString, validateUUID } from "./helpers";
import { requireSectionModerator } from "./sectionAccess";
import { enforceRateLimit } from "./rateLimiter";
import { APP_BASE_URL, requireStripe, stripeSecret } from "./paymentConfig";

type Guest = db.GetOrganiserGuestData["organiserGuests"][number];
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function text(
  value: unknown,
  label: string,
  max: number,
  required = true,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new HttpsError("invalid-argument", `Invalid ${label}`);
  return value.trim();
}
function version(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpsError("invalid-argument", "Invalid version");
  return Number(value);
}
function details(data: Record<string, unknown>) {
  const email = text(data.email ?? "", "email", 254, false).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpsError("invalid-argument", "Invalid email");
  return {
    firstName: text(data.firstName, "first name", 100),
    lastName: text(data.lastName, "last name", 100),
    email: email || null,
    dietaryRequirements: text(
      data.dietaryRequirements ?? "",
      "dietary requirements",
      2000,
      false,
    ),
  };
}
async function moderate(request: CallableRequest, eventId: string) {
  requireEnabled(request);
  const { data } = await db.getOrganiserGuestEvent({ eventId });
  if (!data.event) throw new HttpsError("not-found", "Event not found");
  await requireSectionModerator(
    data.event.section.id,
    request.auth!.uid,
    request.auth!.token.admin === true,
  );
  return data.event;
}
export async function loadOrganiserGuestTypes(eventId: string) {
  const rows: db.ListOrganiserGuestTypesData["ticketTypes"] = [];
  for (let offset = 0; ; offset += 500) {
    const { data } = await db.listOrganiserGuestTypes({ eventId, offset });
    rows.push(...data.ticketTypes);
    if (data.ticketTypes.length < 500)
      return rows
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
        .map((ticket) => ({
          id: ticket.id,
          title: ticket.title,
          priceMinor: Math.round(ticket.price * 100),
          includesSymposium: ticket.includesSymposium,
          includesDinner: ticket.includesDinner,
        }));
  }
}
export function guestPaymentStatus(
  guest: Pick<Guest, "priceMinor" | "paidAt" | "paidAmountMinor" | "refundedAmountMinor" | "refundPendingMinor" | "refundFailureReason" | "cancelledAt" | "payments">,
) {
  const position = guestFinancialPosition(guest);
  if (position.refundFailureReason) return "REFUND_FAILED";
  if (position.refundPendingMinor > 0) return "REFUND_PENDING";
  if (guest.cancelledAt && position.settledAmountMinor > 0) return "REFUND_REQUIRED";
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
function project(guest: Omit<Guest, "tokenHash">) {
  const ticketType = guest.standardTicketType ?? guest.ticketType;
  if (!ticketType) throw new Error("Guest ticket type missing");
  const financial = guestFinancialPosition(guest);
  return {
    id: guest.id,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email ?? null,
    dietaryRequirements: guest.dietaryRequirements,
    ticketTypeId: ticketType.id,
    ticketTitle: ticketType.title,
    includesSymposium: guest.includesSymposium,
    includesDinner: guest.includesDinner,
    priceMinor: guest.priceMinor,
    version: guest.version,
    cancelled: Boolean(guest.cancelledAt),
    paymentStatus: guestPaymentStatus(guest),
    paidAmountMinor: financial.grossPaidMinor,
    settledAmountMinor: financial.settledAmountMinor,
    paymentRequiredMinor: financial.paymentRequiredMinor,
    refundedAmountMinor: financial.refundedAmountMinor,
    refundPendingMinor: financial.refundPendingMinor,
    refundFailureReason: financial.refundFailureReason,
  };
}
async function organiserTicketType(id: string, eventId: string) {
  const ticket = (await db.getOrganiserGuestType({ id, eventId })).data
    .ticketTypes[0];
  if (!ticket)
    throw new HttpsError(
      "failed-precondition",
      "Choose an organiser/club guest ticket for this event",
    );
  const priceMinor = Math.round(ticket.price * 100);
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0)
    throw new HttpsError("failed-precondition", "Ticket price is invalid");
  return { ...ticket, priceMinor };
}
async function guestById(id: string) {
  const { data } = await db.getOrganiserGuest({ id });
  const guest = data.organiserGuests[0];
  if (!guest)
    throw new HttpsError("not-found", "Guest not found");
  return guest;
}
export async function guestByToken(raw: unknown) {
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw))
    throw new HttpsError("not-found", "This guest link is not valid");
  const { data } = await db.getOrganiserGuestByToken({ tokenHash: hash(raw) });
  const guest = data.organiserGuests[0];
  if (!guest) throw new HttpsError("not-found", "This guest link is not valid");
  return guest;
}
function link(token: string) {
  return `${APP_BASE_URL.replace(/\/$/, "")}/guest-ticket#${token}`;
}
function failure(error: unknown): never {
  if (String(error).includes("GUEST_CONFLICT"))
    throw new HttpsError(
      "failed-precondition",
      "The guest or ticket changed. Refresh and try again.",
    );
  if (error instanceof HttpsError) throw error;
  throw new HttpsError(
    "internal",
    "Unable to complete the guest operation. Refresh and try again.",
  );
}
async function expireOpenCheckout(guest: Guest) {
  if (!guest.stripeSessionId) return;
  const stripe = requireStripe(stripeSecret.value());
  const session = await stripe.checkout.sessions.retrieve(
    guest.stripeSessionId,
  );
  if (session.status === "open")
    await stripe.checkout.sessions.expire(session.id);
  else if (session.status === "complete")
    await handleOrganiserGuestStripeEvent(
      { type: "checkout.session.completed", data: { object: session } },
      stripe,
    );
}

async function initiateOutstandingGuestRefund(guest: Guest): Promise<void> {
  const targetPriceMinor = guest.cancelledAt ? 0 : guest.priceMinor;
  let amountRemainingMinor = Math.max(0, guestFinancialPosition(guest).settledAmountMinor - targetPriceMinor);
  if (amountRemainingMinor === 0) return;
  const stripe = requireStripe(stripeSecret.value());
  const sources = [
    ...(guest.payments ?? []).filter((payment) => payment.paidAt && payment.stripePaymentIntentId).reverse().map((payment) => ({
      id: payment.id,
      paymentIntentId: payment.stripePaymentIntentId!,
      amountMinor: payment.amountMinor,
      refundedAmountMinor: payment.refundedAmountMinor,
      refundPendingMinor: payment.refundPendingMinor,
      stripeRefundId: payment.stripeRefundId,
    })),
    ...(guest.paidAt && guest.stripePaymentIntentId ? [{
      id: null,
      paymentIntentId: guest.stripePaymentIntentId,
      amountMinor: guest.paidAmountMinor ?? guest.priceMinor,
      refundedAmountMinor: guest.refundedAmountMinor,
      refundPendingMinor: guest.refundPendingMinor,
      stripeRefundId: guest.stripeRefundId,
    }] : []),
  ];
  for (const source of sources) {
    if (amountRemainingMinor === 0) break;
    const refundableMinor = Math.max(0, source.amountMinor - source.refundedAmountMinor - source.refundPendingMinor);
    const amountMinor = Math.min(amountRemainingMinor, refundableMinor);
    if (amountMinor === 0) continue;
    const targetRefundedMinor = source.refundedAmountMinor + source.refundPendingMinor + amountMinor;
    const refund = await stripe.refunds.create(
      {
        payment_intent: source.paymentIntentId,
        amount: amountMinor,
        metadata: {
          domain: "organiser-guest",
          guestId: guest.id,
          ...(source.id ? { guestPaymentId: source.id } : {}),
        },
      },
      { idempotencyKey: `organiser-guest-refund:${guest.id}:${source.id ?? "original"}:${targetRefundedMinor}${source.stripeRefundId ? `:retry:${source.stripeRefundId}` : ""}` },
    );
    await handleOrganiserGuestStripeEvent(
      { type: "refund.created", data: { object: refund } },
      stripe,
    );
    amountRemainingMinor -= amountMinor;
  }
}

export const getOrganiserGuestList = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      requireEnabled(request);
      await enforceRateLimit("getOrganiserGuestList", request.auth!.uid);
      const eventId = validateUUID(
        requireString(request.data?.eventId, "eventId"),
      );
      const event = await moderate(request, eventId);
      const ticketTypes = await loadOrganiserGuestTypes(eventId);
      const guests = [];
      for (let offset = 0; ; offset += 500) {
        const { data } = await db.listOrganiserGuests({ eventId, offset });
        guests.push(...data.organiserGuests.map(project));
        if (data.organiserGuests.length < 500) break;
      }
      return {
        event: {
          id: event.id,
          title: event.title,
          bookingEndDateTime: event.bookingEndDateTime,
        },
        ticketTypes,
        guests,
      };
    } catch (error) {
      failure(error);
    }
  },
);

export const manageOrganiserGuest = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    try {
      requireEnabled(request);
      await enforceRateLimit("manageOrganiserGuest", request.auth!.uid);
      const eventId = validateUUID(
        requireString(request.data?.eventId, "eventId"),
      );
      await moderate(request, eventId);
      const id = validateUUID(requireString(request.data?.id, "id"));
      const actor = request.auth!.uid;
      if (request.data.action === "create") {
        const existing = (await db.getOrganiserGuest({ id })).data
          .organiserGuests[0];
        if (existing) {
          if (
            validateUUID(existing.event.id) !== eventId ||
            existing.createdBy !== actor
          )
            throw new HttpsError(
              "already-exists",
              "Guest reference already used",
            );
          return { guest: project(existing), link: null }; // Retry never creates a second reservation.
        }
        const ticketTypeId = validateUUID(
          requireString(request.data.ticketTypeId, "ticketTypeId"),
        );
        const ticket = await organiserTicketType(ticketTypeId, eventId);
        const token = randomBytes(32).toString("hex");
        await db.createOrganiserGuest({
          id,
          eventId,
          ticketTypeId,
          ...details(request.data),
          priceMinor: ticket.priceMinor,
          includesSymposium: ticket.includesSymposium,
          includesDinner: ticket.includesDinner,
          tokenHash: hash(token),
          checkoutKey: randomUUID(),
          actor,
        });
        return { guest: project(await guestById(id)), link: link(token) };
      }
      const guest = await guestById(id);
      if (validateUUID(guest.event.id) !== eventId)
        throw new HttpsError("not-found", "Guest not found");
      const expectedVersion = version(request.data.version);
      if (request.data.action === "cancel" && guest.cancelledAt) {
        await expireOpenCheckout(guest);
        await initiateOutstandingGuestRefund(guest);
        return { guest: project(await guestById(id)), link: null };
      }
      if (request.data.action === "edit") {
        const input = { id, version: expectedVersion, ...details(request.data), actor };
        const currentTicketType = guest.standardTicketType ?? guest.ticketType;
        const requestedTicketTypeId = request.data.ticketTypeId
          ? validateUUID(
              requireString(request.data.ticketTypeId, "ticketTypeId"),
            )
          : null;
        if (
          requestedTicketTypeId &&
          requestedTicketTypeId !==
            (currentTicketType ? validateUUID(currentTicketType.id) : null)
        ) {
          const ticketTypeId = requestedTicketTypeId;
          const ticket = await organiserTicketType(ticketTypeId, eventId);
          if (Number(request.data.expectedTicketPriceMinor) !== ticket.priceMinor) {
            throw new HttpsError(
              "aborted",
              "The ticket price changed. Refresh and review the amendment again.",
            );
          }
          await expireOpenCheckout(guest);
          await db.reassignOrganiserGuestTicket({
            ...input,
            ticketTypeId,
            priceMinor: ticket.priceMinor,
            paidAmountMinor: guest.paidAt ? (guest.paidAmountMinor ?? guest.priceMinor) : null,
            includesSymposium: ticket.includesSymposium,
            includesDinner: ticket.includesDinner,
            checkoutKey: randomUUID(),
          });
          await initiateOutstandingGuestRefund(await guestById(id));
        } else await db.updateOrganiserGuestDetails(input);
      } else if (request.data.action === "replace-link") {
        const token = randomBytes(32).toString("hex");
        await expireOpenCheckout(guest);
        await db.rotateOrganiserGuestLink({
          id,
          version: expectedVersion,
          tokenHash: hash(token),
          checkoutKey: randomUUID(),
          actor,
        });
        return { guest: project(await guestById(id)), link: link(token) };
      } else if (request.data.action === "cancel") {
        await db.cancelOrganiserGuest({ id, version: expectedVersion, actor });
        await expireOpenCheckout(guest);
        await initiateOutstandingGuestRefund(await guestById(id));
      } else throw new HttpsError("invalid-argument", "Unknown guest action");
      return { guest: project(await guestById(id)), link: null };
    } catch (error) {
      failure(error);
    }
  },
);

export const getOrganiserGuestTicket = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const guest = await guestByToken(request.data?.token);
      await enforceRateLimit("getOrganiserGuestTicket", `guest:${guest.id}`);
      const ticketType = guest.standardTicketType ?? guest.ticketType;
      if (!ticketType) throw new Error("Guest ticket type missing");
      return {
        firstName: guest.firstName,
        lastName: guest.lastName,
        eventTitle: guest.event.title,
        ticketTitle: ticketType.title,
        priceMinor: guest.priceMinor,
        includesDinner: guest.includesDinner,
        includesSymposium: guest.includesSymposium,
        dietaryRequirements: guest.dietaryRequirements,
        dietaryEditable:
          !guest.cancelledAt &&
          Date.now() < Date.parse(guest.event.bookingEndDateTime),
        paymentDueAt: guest.event.bookingEndDateTime,
        paymentStatus: guestPaymentStatus(guest),
        paymentRequiredMinor: guestFinancialPosition(guest).paymentRequiredMinor,
        cancelled: Boolean(guest.cancelledAt),
        version: guest.version,
      };
    } catch (error) {
      failure(error);
    }
  },
);
export const updateOrganiserGuestDietary = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const guest = await guestByToken(request.data?.token);
      await enforceRateLimit(
        "updateOrganiserGuestDietary",
        `guest:${guest.id}`,
      );
      if (
        guest.cancelledAt ||
        Date.now() >= Date.parse(guest.event.bookingEndDateTime)
      )
        throw new HttpsError(
          "failed-precondition",
          "Dietary updates are closed",
        );
      await db.updateOrganiserGuestDietary({
        id: guest.id,
        version: version(request.data.version),
        tokenHash: guest.tokenHash,
        dietaryRequirements: text(
          request.data.dietaryRequirements,
          "dietary requirements",
          2000,
          false,
        ),
      });
      return { success: true };
    } catch (error) {
      failure(error);
    }
  },
);

export const createOrganiserGuestCheckout = onCall(
  { region: FUNCTIONS_REGION, secrets: [stripeSecret] },
  async (request) => {
    try {
      let guest = await guestByToken(request.data?.token);
      await enforceRateLimit(
        "createOrganiserGuestCheckout",
        `guest:${guest.id}`,
      );
      const position = guestFinancialPosition(guest);
      if (guest.cancelledAt || position.paymentRequiredMinor === 0)
        throw new HttpsError(
          "failed-precondition",
          "This ticket does not require payment",
        );
      const stripe = requireStripe(stripeSecret.value());
      if (guest.stripeSessionId) {
        const previous = await stripe.checkout.sessions.retrieve(
          guest.stripeSessionId,
        );
        if (previous.status === "open" && previous.url) {
          const current = await guestByToken(request.data.token);
          if (
            current.cancelledAt ||
            current.paidAt ||
            current.checkoutKey !== guest.checkoutKey
          )
            throw new HttpsError(
              "failed-precondition",
              "This ticket changed. Refresh and try again.",
            );
          return { url: previous.url };
        }
        if (previous.status === "complete") {
          await handleOrganiserGuestStripeEvent(
            { type: "checkout.session.completed", data: { object: previous } },
            stripe,
          );
          throw new HttpsError(
            "failed-precondition",
            "Payment has been submitted. Refresh your ticket status.",
          );
        }
        await db.resetOrganiserGuestCheckout({
          id: guest.id,
          version: guest.version,
          checkoutKey: randomUUID(),
        });
        guest = await guestByToken(request.data.token);
      }
      const additionalPayment = position.grossPaidMinor > 0;
      const paymentId = additionalPayment ? randomUUID() : null;
      const metadata = {
        domain: "organiser-guest",
        guestId: guest.id,
        checkoutKey: guest.checkoutKey,
        ...(paymentId ? { guestPaymentId: paymentId } : {}),
      };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: position.paymentRequiredMinor,
                product_data: { name: "Event guest ticket" },
              },
            },
          ],
          metadata,
          payment_intent_data: { metadata },
          success_url: link(request.data.token),
          cancel_url: link(request.data.token),
        },
        { idempotencyKey: `organiser-guest:${guest.id}:${guest.checkoutKey}` },
      );
      const attached = paymentId
        ? await db.attachOrganiserGuestAdditionalCheckout({
            id: paymentId,
            guestId: guest.id,
            checkoutKey: guest.checkoutKey,
            sessionId: session.id,
            amountMinor: position.paymentRequiredMinor,
          })
        : await db.attachOrganiserGuestCheckout({
            id: guest.id,
            checkoutKey: guest.checkoutKey,
            tokenHash: guest.tokenHash,
            sessionId: session.id,
          });
      const attachedCount = paymentId
        ? attached.data.organiserGuest_updateMany
        : attached.data.organiserGuest_updateMany;
      if (attachedCount !== 1) {
        if (session.status === "open")
          await stripe.checkout.sessions.expire(session.id);
        throw new HttpsError(
          "failed-precondition",
          "This ticket or link changed. Open the latest guest link.",
        );
      }
      if (!session.url)
        throw new HttpsError("internal", "Checkout is not available");
      return { url: session.url };
    } catch (error) {
      failure(error);
    }
  },
);
