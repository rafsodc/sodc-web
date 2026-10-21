import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@dataconnect/admin-generated";
import { HttpsError } from "firebase-functions/v2/https";
import { submitEventBooking } from "../../bookings";
import { getManagedBookingContext } from "../../organiserBookings";
import { requireSectionModerator } from "../../sectionAccess";

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
const addGuest = () => ({ baseBookingId: bookingId, baseRevisionNumber: 1,
  lines: [{ ticketTypeId: memberId, sortOrder: 0 }, { ticketTypeId: guestId, sortOrder: 1, guestDisplayName: "Alex Guest" }],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSectionModerator).mockResolvedValue({ canModerate: true } as never);
  mocks.executeMutation.mockResolvedValue({ data: {} });
  eventQuery.mockResolvedValue({ data: { event: event() } } as never);
  profileQuery.mockResolvedValue({ data: { user: { membershipStatus: "REGULAR", firstName: "Selected", lastName: "Member", email: "member@example.com" } } } as never);
  groupsQuery.mockResolvedValue({ data: { user: { userGroups: [] } } } as never);
  sectionQuery.mockResolvedValue({ data: { section: { purposeLinks: [{ purposes: ["ACCESS", "BOOKER"], userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } }] } } } as never);
  bookingsQuery.mockResolvedValue({ data: { user: { bookings: [], ticketOrders: [] } } } as never);
  replayQuery.mockResolvedValue({ data: { user: { bookings: [] } } } as never);
});

describe("organiser booking submission", () => {
  it.each([false, true])("creates a member-owned booking and records the actor (admin=%s)", async (admin) => {
    const result = await submitEventBooking.run(request({}, "organiser", admin) as never);
    expect(result).toMatchObject({ paymentReady: true });
    expect(requireSectionModerator).toHaveBeenCalledWith(sectionId, "organiser", admin);
    expect(profileQuery).toHaveBeenCalledWith({ id: "member" });
    expect(groupsQuery).toHaveBeenCalledWith({ userId: "member" });
    expect(mocks.executeMutation).toHaveBeenCalledWith("CreateCompleteBookingFromCallable", expect.objectContaining({
      bookerId: "member", createdBy: "organiser", updatedBy: "organiser", status: "SUBMITTED",
      bookingPlaces: [expect.objectContaining({ bookerId: "member", createdBy: "organiser" })],
      bookingLines: [expect.objectContaining({ ticketTypeId: memberId, createdBy: "organiser" })],
    }));
  });

  it("denies unauthorised callers before reading another user's booking or replay", async () => {
    vi.mocked(requireSectionModerator).mockRejectedValueOnce(new HttpsError("permission-denied", "Not an organiser"));
    await expect(submitEventBooking.run(request() as never)).rejects.toThrow("Not an organiser");
    expect(replayQuery).not.toHaveBeenCalled();
    expect(bookingsQuery).not.toHaveBeenCalled();
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("keeps ordinary self-booking closed and ignores an untrusted window override", async () => {
    await expect(submitEventBooking.run(request({ bookerId: undefined, organiserBooking: true }) as never)).rejects.toThrow(/published booking window/);
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("allows organiser creation before opening but rejects invalid windows", async () => {
    eventQuery.mockResolvedValue({ data: { event: event("2099-01-01", "2100-01-01") } } as never);
    await expect(submitEventBooking.run(request() as never)).resolves.toMatchObject({ paymentReady: true });
    eventQuery.mockResolvedValue({ data: { event: event("invalid", "2020-01-01") } } as never);
    await expect(submitEventBooking.run(request() as never)).rejects.toThrow(/published booking window/);
  });

  it("uses the selected user's ticket eligibility", async () => {
    eventQuery.mockResolvedValue({ data: { event: { ...event(), ticketTypes: ticketTypes.map((ticket) => ({
      ...ticket, userGroup: { id: groupId, membershipStatuses: ["RESERVE"] },
    })) } } } as never);
    await expect(submitEventBooking.run(request() as never)).rejects.toThrow(/Not eligible/);
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("keeps the selected user's booker permission required", async () => {
    sectionQuery.mockResolvedValue({ data: { section: { purposeLinks: [{ purposes: ["ACCESS"], userGroup: { id: groupId, membershipStatuses: ["REGULAR"] } }] } } } as never);
    await expect(submitEventBooking.run(request() as never)).rejects.toThrow(/not configured/);
  });

  it("adds a guest to a paid booking with only the new guest outstanding", async () => {
    setExisting();
    await submitEventBooking.run(request(addGuest()) as never);
    expect(mocks.executeMutation).toHaveBeenCalledWith("CreateActiveBookingRevisionFromCallable", expect.objectContaining({
      bookerId: "member", createdBy: "organiser", deltaAmountMinor: 2500, adjustmentStatus: "PENDING_AUTO_CHARGE",
      bookingPlaces: [expect.objectContaining({ bookerId: "member" })],
      bookingLines: [expect.objectContaining({ bookingPlaceId: placeId }), expect.objectContaining({ guestDisplayName: "Alex Guest", ticketTypeId: guestId })],
    }));
  });

  it("keeps over-limit guest additions pending approval", async () => {
    setExisting();
    eventQuery.mockResolvedValue({ data: { event: event("2020-01-01", "2021-01-01", 0) } } as never);
    expect(await submitEventBooking.run(request(addGuest()) as never)).toMatchObject({ paymentReady: false, approvalStatus: "PENDING" });
    expect(mocks.executeMutation).toHaveBeenCalledWith("CreatePendingBookingRevisionFromCallable", expect.anything());
  });

  it.each([
    { ...addGuest(), lines: [{ ticketTypeId: memberId, sortOrder: 0, dietaryNote: "Changed" }, addGuest().lines[1]] },
    { ...addGuest(), sitNextToUserIds: ["other-user"] },
    { ...addGuest(), lines: [addGuest().lines[0]] },
  ])("rejects amendments to existing details through the add action", async (change) => {
    setExisting();
    await expect(submitEventBooking.run(request(change) as never)).rejects.toThrow(/Only new tickets/);
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("rejects a second member ticket and unnamed guests", async () => {
    setExisting();
    await expect(submitEventBooking.run(request({ ...addGuest(), lines: [addGuest().lines[0], { ticketTypeId: memberId, sortOrder: 1 }] }) as never)).rejects.toThrow(/Exactly one member/);
    await expect(submitEventBooking.run(request({ ...addGuest(), lines: [addGuest().lines[0], { ticketTypeId: guestId, sortOrder: 1 }] }) as never)).rejects.toThrow(/guest display name/);
  });

  it("rejects stale booking revisions", async () => {
    setExisting();
    await expect(submitEventBooking.run(request({ ...addGuest(), baseRevisionNumber: 0 }) as never)).rejects.toThrow(/conflict/);
    expect(mocks.executeMutation).not.toHaveBeenCalled();
  });

  it("recovers a completed submission without creating duplicate tickets", async () => {
    replayQuery.mockResolvedValue({ data: { user: { bookings: [existingBooking()] } } } as never);
    expect(await submitEventBooking.run(request() as never)).toMatchObject({ bookingId, idempotentReplay: true });
    expect(requireSectionModerator).toHaveBeenCalledOnce();
    expect(mocks.executeMutation).not.toHaveBeenCalled();
    await expect(submitEventBooking.run(request({ lines: [{ ticketTypeId: memberId, sortOrder: 0, dietaryNote: "Changed" }] }) as never)).rejects.toThrow(/submission key/);
  });

  it("rejects selecting the booking user as their own seating preference", async () => {
    await expect(submitEventBooking.run(request({ sitNextToUserIds: ["member"] }) as never)).rejects.toThrow(/yourself/);
  });
});

describe("managed booking context", () => {
  it("returns the selected user's eligible tickets and current booking", async () => {
    setExisting();
    const result = await getManagedBookingContext.run(request() as never);
    expect(result).toMatchObject({ user: { id: "member", email: "member@example.com" }, booking: { id: bookingId, lines: [{ ticketTypeId: memberId }] } });
    expect(result?.ticketTypes).toHaveLength(2);
  });

  it("does not expose user or booking details to an unauthorised caller", async () => {
    vi.mocked(requireSectionModerator).mockRejectedValueOnce(new HttpsError("permission-denied", "Not an organiser"));
    await expect(getManagedBookingContext.run(request() as never)).rejects.toThrow("Not an organiser");
    expect(profileQuery).not.toHaveBeenCalled();
    expect(bookingsQuery).not.toHaveBeenCalled();
  });

  it("rejects ineligible users and invalid ids", async () => {
    profileQuery.mockResolvedValue({ data: { user: { membershipStatus: "RESIGNED" } } } as never);
    await expect(getManagedBookingContext.run(request() as never)).rejects.toThrow(/permission to access/);
    await expect(getManagedBookingContext.run(request({ bookerId: " " }) as never)).rejects.toThrow(/bookerId/);
  });
});
