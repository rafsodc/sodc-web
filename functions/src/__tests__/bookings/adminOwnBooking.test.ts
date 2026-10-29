import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@dataconnect/admin-generated";
import { submitEventBooking } from "../../bookings";
import { requireSectionModerator } from "../../sectionAccess";
import { getUserSecurityState } from "../../securityRepository";

const mocks = vi.hoisted(() => ({ executeMutation: vi.fn() }));
vi.mock("../../bookingServiceDataConnect", () => ({ getBookingServiceDataConnect: () => ({ executeMutation: mocks.executeMutation }) }));
vi.mock("../../sectionAccess", () => ({ requireSectionModerator: vi.fn() }));
vi.mock("../../rateLimiter", async (original) => ({ ...await original<typeof import("../../rateLimiter")>(), enforceRateLimit: vi.fn() }));
vi.mock("../../bookingEmailDispatcher", () => ({ notifyBookingConfirmationEmail: vi.fn(), notifyBookingPendingApprovalEmails: vi.fn(), notifyBookingRevisionEmail: vi.fn() }));

const eventId = "10000000-0000-4000-8000-000000000001";
const sectionId = "20000000-0000-4000-8000-000000000001";
const groupId = "30000000-0000-4000-8000-000000000001";
const memberId = "40000000-0000-4000-8000-000000000001";
const guestId = "40000000-0000-4000-8000-000000000002";
const bookingId = "50000000-0000-4000-8000-000000000001";
const placeId = "60000000-0000-4000-8000-000000000001";
const key = "70000000-0000-4000-8000-000000000001";
const eventQuery = vi.spyOn(db, "getEventByIdForCallable");
const profileQuery = vi.spyOn(db, "getUserMembershipStatus");
const groupsQuery = vi.spyOn(db, "getUserUserGroupsForAdmin");
const sectionQuery = vi.spyOn(db, "getSectionByIdForCallable");
const bookingsQuery = vi.spyOn(db, "getBookingsForBookerAndEvent");
const replayQuery = vi.spyOn(db, "getBookingReplayForBookerEventKey");
const ticketTypes = [
  { id: memberId, title: "Member", audience: "MEMBER", price: 50, userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } },
  { id: guestId, title: "Guest", audience: "GUEST", price: 25, userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } },
];
function event(start = "2020-01-01", end = "2021-01-01", maxGuests = 2) {
  return { id: eventId, section: { id: sectionId }, bookingStartDateTime: start, bookingEndDateTime: end, maxGuestsWithoutModeratorApproval: maxGuests, ticketTypes };
}
function request(overrides: Record<string, unknown> = {}, actor = "organiser", admin = false) {
  return { auth: { uid: actor, token: { enabled: true, securityVersion: 1, admin } }, data: {
    eventId, bookerId: "member", idempotencyKey: key, lines: [{ ticketTypeId: memberId, sortOrder: 0 }], ...overrides,
  } };
}
function existingBooking() {
  return {
    id: bookingId, revisionGroupId: bookingId, revisionNumber: 1, status: "CONFIRMED", approvalStatus: "NOT_REQUIRED", supersededAt: null,
    sitNextToUserIds: [], accommodationRequested: false, accommodationNote: null,
    lines: [{ id: "old-line", sortOrder: 0, dietaryNote: null, guestDisplayName: null,
      ticketType: ticketTypes[0], bookingPlace: { id: placeId, paymentAllocations: [{
        id: "allocation", ticketOrderId: "paid-order", allocatedAmountMinor: 5000, refundedAmountMinor: 0,
      }] },
    }],
  };
}
function setExisting(booking = existingBooking()) {
  bookingsQuery.mockResolvedValue({ data: { user: { bookings: [booking], ticketOrders: [{ id: "paid-order", status: "PAID" }] } } } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserSecurityState).mockResolvedValue({ data: { userSecurityState: {
    userId: "administrator", securityVersion: 1, membershipStatus: "REGULAR",
    accessReady: true, adminReady: true, syncStatus: "READY", user: { membershipStatus: "REGULAR" },
  } } } as never);
  vi.mocked(requireSectionModerator).mockResolvedValue({ canModerate: true } as never);
  mocks.executeMutation.mockResolvedValue({ data: {} });
  eventQuery.mockResolvedValue({ data: { event: event() } } as never);
  profileQuery.mockResolvedValue({ data: { user: { membershipStatus: "REGULAR", firstName: "Selected", lastName: "Member", email: "member@example.com" } } } as never);
  groupsQuery.mockResolvedValue({ data: { user: { userGroups: [] } } } as never);
  sectionQuery.mockResolvedValue({ data: { section: { purposeLinks: [{ purposes: ["ACCESS", "BOOKER"], userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } }] } } } as never);
  bookingsQuery.mockResolvedValue({ data: { user: { bookings: [], ticketOrders: [] } } } as never);
  replayQuery.mockResolvedValue({ data: { user: { bookings: [] } } } as never);
});

function ownRequest(data: Record<string, unknown> = {}) {
  return request({ bookerId: undefined, ...data }, "administrator", true);
}
function setAuthority(overrides: Record<string, unknown>) {
  vi.mocked(getUserSecurityState).mockResolvedValue({ data: { userSecurityState: {
    userId: "administrator", securityVersion: 1, membershipStatus: "REGULAR",
    accessReady: true, adminReady: true, syncStatus: "READY", user: { membershipStatus: "REGULAR" },
    ...overrides,
  } } } as never);
}

describe("administrator own-booking window parity", () => {
  it.each([["2099-01-01", "2100-01-01"], ["2020-01-01", "2021-01-01"]])(
    "creates the administrator's own eligible booking outside %s–%s", async (start, end) => {
      eventQuery.mockResolvedValue({ data: { event: event(start, end) } } as never);
      await expect(submitEventBooking.run(ownRequest() as never)).resolves.toMatchObject({ paymentReady: true });
      expect(profileQuery).toHaveBeenCalledWith({ id: "administrator" });
      expect(requireSectionModerator).not.toHaveBeenCalled();
      expect(mocks.executeMutation).toHaveBeenCalledWith("CreateCompleteBookingFromCallable", expect.objectContaining({
        bookerId: "administrator", bookingLines: [expect.objectContaining({ ticketTypeId: memberId })],
      }));
    }
  );

  it.each([["2099-01-01", "2100-01-01"], ["2020-01-01", "2021-01-01"]])("amends own-booking details outside %s without the organiser add-only restriction", async (start, end) => {
    eventQuery.mockResolvedValue({ data: { event: event(start, end) } } as never);
    setExisting();
    await expect(submitEventBooking.run(ownRequest({
      baseBookingId: bookingId, baseRevisionNumber: 1,
      lines: [{ ticketTypeId: memberId, sortOrder: 0, dietaryNote: "Changed meal" }],
    }) as never)).resolves.toMatchObject({ paymentReady: true });
    expect(mocks.executeMutation).toHaveBeenCalledWith("CreateActiveBookingRevisionFromCallable", expect.objectContaining({
      bookerId: "administrator", supersededBookingId: bookingId,
      bookingLines: [expect.objectContaining({ dietaryNote: "Changed meal" })],
    }));
  });

  it.each([[["BOOKER"], "permission-denied"], [["ACCESS"], "failed-precondition"]])("keeps own section eligibility required (%s)", async (purposes, code) => {
    sectionQuery.mockResolvedValue({ data: { section: { purposeLinks: [{ purposes, userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } }] } } } as never);
    await expect(submitEventBooking.run(ownRequest() as never)).rejects.toMatchObject({ code });
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("does not allow an administrator to bypass a non-matching BOOKER group", async () => {
    sectionQuery.mockResolvedValue({ data: { section: { purposeLinks: [
      { purposes: ["ACCESS"], userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } },
      { purposes: ["BOOKER"], userGroup: { id: guestId, membershipStatuses: ["RESERVE"] } },
    ] } } } as never);
    await expect(submitEventBooking.run(ownRequest() as never)).rejects.toMatchObject({ code: "permission-denied" });
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("keeps ticket-group eligibility required", async () => {
    eventQuery.mockResolvedValue({ data: { event: { ...event("2099-01-01", "2100-01-01"), ticketTypes: ticketTypes.map((ticket) => ({
      ...ticket, userGroup: { id: groupId, membershipStatuses: ["RESERVE"] },
    })) } } } as never);
    await expect(submitEventBooking.run(ownRequest() as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("keeps over-limit administrator guests pending approval", async () => {
    eventQuery.mockResolvedValue({ data: { event: event("2099-01-01", "2100-01-01", 0) } } as never);
    await expect(submitEventBooking.run(ownRequest({ lines: [
      { ticketTypeId: memberId, sortOrder: 0 }, { ticketTypeId: guestId, sortOrder: 1, guestDisplayName: "Guest" },
    ] }) as never)).resolves.toMatchObject({ paymentReady: false, approvalStatus: "PENDING" });
  });

  it.each([["invalid", "2100-01-01"], ["2100-01-01", "2099-01-01"]])(
    "denies malformed or reversed windows", async (start, end) => {
      eventQuery.mockResolvedValue({ data: { event: event(start, end) } } as never);
      await expect(submitEventBooking.run(ownRequest() as never)).rejects.toThrow(/published booking window/);
      expect(mocks.executeMutation).not.toHaveBeenCalled();
    }
  );

  it("denies a revoked administrator despite a still-true JWT claim", async () => {
    setAuthority({ adminReady: false });
    await expect(submitEventBooking.run(ownRequest() as never)).rejects.toThrow(/published booking window/);
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("does not trust administrator flags in the request body", async () => {
    const input = ownRequest({ isAdmin: true, verifiedAdmin: true, moderatorWindowOverride: true });
    input.auth.token.admin = false;
    await expect(submitEventBooking.run(input as never)).rejects.toThrow(/published booking window/);
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it.each([
    ["stale version", { securityVersion: 2 }, "unauthenticated"],
    ["revoked access", { accessReady: false }, "permission-denied"],
    ["synchronizing access", { syncStatus: "PENDING" }, "permission-denied"],
    ["restricted status", { membershipStatus: "SUSPENDED", user: { membershipStatus: "SUSPENDED" } }, "permission-denied"],
  ])("rejects %s before booking reads or mutations", async (_label, state, code) => {
    setAuthority(state);
    await expect(submitEventBooking.run(ownRequest() as never)).rejects.toMatchObject({ code });
    expect(eventQuery).not.toHaveBeenCalled();
    expect(replayQuery).not.toHaveBeenCalled();
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("rejects a disabled administrator claim before booking reads", async () => {
    const input = ownRequest();
    input.auth.token.enabled = false;
    await expect(submitEventBooking.run(input as never)).rejects.toMatchObject({ code: "permission-denied" });
    expect(eventQuery).not.toHaveBeenCalled();
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });
});
