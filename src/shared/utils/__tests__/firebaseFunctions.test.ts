import { describe, it, expect, vi, beforeEach } from "vitest";
import { httpsCallable } from "firebase/functions";

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("../../../config/firebase", () => ({
  functions: {},
}));

vi.mock("../uuid", () => ({
  toCanonicalUuid: (id: string) => id.toLowerCase().replace(/[^a-f0-9-]/g, ""),
}));

import {
  grantAdminClaim,
  revokeAdminClaim,
  updateDisplayName,
  updateUserDisplayName,
  listUsersWithoutDataConnectProfile,
  listUsersPendingApproval,
  syncPendingUserClaims,
  updateMembershipStatus,
  resignMembership,
  getSectionMembersMerged,
  submitEventBooking,
  createTicketCheckoutSession,
  createEventBookingCheckoutSession,
  getMyTicketOrderStripeArtifactsBatch,
  reconcileMyCheckoutSessionOrders,
  submitGuestTicketRequest,
  reviewGuestTicketRequest,
} from "../firebaseFunctions";

function makeCallable(returnValue: unknown) {
  const callable = vi.fn().mockResolvedValue(returnValue);
  vi.mocked(httpsCallable).mockReturnValue(callable as any);
  return callable;
}

function makeFailingCallable(message: string) {
  const callable = vi.fn().mockRejectedValue(new Error(message));
  vi.mocked(httpsCallable).mockReturnValue(callable as any);
  return callable;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Admin functions
// ============================================================================

describe("grantAdminClaim", () => {
  it("calls the grantAdmin function with the uid", async () => {
    const callable = makeCallable({ data: { success: true, message: "Admin granted" } });
    const result = await grantAdminClaim("uid-123");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "grantAdmin");
    expect(callable).toHaveBeenCalledWith({ uid: "uid-123" });
    expect(result).toEqual({ success: true, message: "Admin granted" });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Permission denied");
    const result = await grantAdminClaim("uid-123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Permission denied");
  });
});

describe("revokeAdminClaim", () => {
  it("calls the revokeAdmin function with the uid", async () => {
    const callable = makeCallable({ data: { success: true, message: "Admin revoked" } });
    const result = await revokeAdminClaim("uid-456");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "revokeAdmin");
    expect(callable).toHaveBeenCalledWith({ uid: "uid-456" });
    expect(result).toEqual({ success: true, message: "Admin revoked" });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Last admin cannot be revoked");
    const result = await revokeAdminClaim("uid-456");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Last admin");
  });
});

// ============================================================================
// Display name functions
// ============================================================================

describe("updateDisplayName", () => {
  it("calls updateDisplayName function with displayName", async () => {
    const callable = makeCallable({ data: { success: true } });
    const result = await updateDisplayName("New Name");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "updateDisplayName");
    expect(callable).toHaveBeenCalledWith({ displayName: "New Name" });
    expect(result).toEqual({ success: true });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Update failed");
    const result = await updateDisplayName("New Name");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Update failed");
  });
});

describe("updateUserDisplayName", () => {
  it("calls updateUserDisplayName with userId and displayName", async () => {
    const callable = makeCallable({ data: { success: true } });
    const result = await updateUserDisplayName("user-123", "Admin Name");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "updateUserDisplayName");
    expect(callable).toHaveBeenCalledWith({ userId: "user-123", displayName: "Admin Name" });
    expect(result).toEqual({ success: true });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Not found");
    const result = await updateUserDisplayName("user-123", "Admin Name");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not found");
  });
});

// ============================================================================
// User listing functions
// ============================================================================

describe("listUsersWithoutDataConnectProfile", () => {
  it("calls the function with no arguments and returns users", async () => {
    const users = [{ id: "u1", email: "a@b.com", displayName: "A" }];
    makeCallable({ data: { users } });

    const result = await listUsersWithoutDataConnectProfile();

    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "listUsersWithoutDataConnectProfile"
    );
    expect(result).toEqual({ success: true, users });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Unauthorized");
    const result = await listUsersWithoutDataConnectProfile();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });
});

describe("listUsersPendingApproval", () => {
  it("calls the function and returns pending users", async () => {
    const users = [{ id: "u2", firstName: "John", lastName: "Doe", email: "j@d.com", serviceNumber: "SN1", membershipStatus: "PENDING", requestedMembershipStatus: "REGULAR", createdAt: "", updatedAt: "" }];
    makeCallable({ data: { users } });

    const result = await listUsersPendingApproval();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "listUsersPendingApproval");
    expect(result).toEqual({ success: true, users });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Service unavailable");
    const result = await listUsersPendingApproval();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Service unavailable");
  });
});

describe("syncPendingUserClaims", () => {
  it("calls syncPendingUserClaims and returns success", async () => {
    makeCallable({ data: { success: true } });
    const result = await syncPendingUserClaims();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "syncPendingUserClaims");
    expect(result).toEqual({ success: true });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Claims sync failed");
    const result = await syncPendingUserClaims();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Claims sync failed");
  });
});

// ============================================================================
// Membership status functions
// ============================================================================

describe("updateMembershipStatus", () => {
  it("calls updateMembershipStatus with userId and newStatus", async () => {
    const callable = makeCallable({ data: { success: true } });
    const result = await updateMembershipStatus("user-789", "REGULAR");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "updateMembershipStatus");
    expect(callable).toHaveBeenCalledWith({ userId: "user-789", newStatus: "REGULAR" });
    expect(result).toEqual({ success: true });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Invalid status transition");
    const result = await updateMembershipStatus("user-789", "REGULAR");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid status transition");
  });
});

describe("resignMembership", () => {
  it("calls resignMembership with empty payload", async () => {
    const callable = makeCallable({ data: { success: true } });
    const result = await resignMembership();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "resignMembership");
    expect(callable).toHaveBeenCalledWith({});
    expect(result).toEqual({ success: true });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Cannot resign as admin");
    const result = await resignMembership();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot resign as admin");
  });
});

// ============================================================================
// Section members
// ============================================================================

describe("getSectionMembersMerged", () => {
  it("calls getSectionMembersMerged with sectionId and returns members", async () => {
    const members = [{ id: "u1", firstName: "A", lastName: "B", email: "a@b.com", membershipStatus: "REGULAR" }];
    const callable = makeCallable({ data: { members } });

    const result = await getSectionMembersMerged("section-abc");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "getSectionMembersMerged");
    expect(callable).toHaveBeenCalledWith({ sectionId: "section-abc" });
    expect(result).toEqual({ members });
  });

  it("propagates errors (no try/catch)", async () => {
    makeFailingCallable("Section not found");

    await expect(getSectionMembersMerged("bad-id")).rejects.toThrow("Section not found");
  });
});

// ============================================================================
// Event booking
// ============================================================================

const BOOKING_UUID = "11111111-1111-1111-1111-111111111111";
const TICKET_UUID = "22222222-2222-2222-2222-222222222222";
const EVENT_UUID = "33333333-3333-3333-3333-333333333333";

describe("submitEventBooking", () => {
  it("calls submitEventBooking with normalized payload", async () => {
    const callable = makeCallable({ data: { bookingId: "b1", status: "CONFIRMED" } });

    const result = await submitEventBooking({
      idempotencyKey: BOOKING_UUID,
      eventId: EVENT_UUID,
      lines: [{ ticketTypeId: TICKET_UUID, sortOrder: 1 }],
      bookerDietaryNote: "  vegan  ",
      sitNextToUserIds: ["  uid-1  ", "", "uid-2"],
      accommodationRequested: true,
      accommodationNote: "  ground floor  ",
    });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "submitEventBooking");
    const sent = callable.mock.calls[0][0];
    expect(sent.bookerDietaryNote).toBe("vegan");
    expect(sent.accommodationNote).toBe("ground floor");
    expect(sent.sitNextToUserIds).toEqual(["uid-1", "uid-2"]); // trimmed, blank filtered
    expect(result).toEqual({ bookingId: "b1", status: "CONFIRMED" });
  });

  it("defaults accommodationRequested to false and trims null notes", async () => {
    makeCallable({ data: { bookingId: "b2", status: "CONFIRMED" } });

    await submitEventBooking({
      idempotencyKey: BOOKING_UUID,
      eventId: EVENT_UUID,
      lines: [],
    });

    const callable = vi.mocked(httpsCallable).mock.results[0].value;
    const sent = callable.mock.calls[0][0];
    expect(sent.accommodationRequested).toBe(false);
    expect(sent.bookerDietaryNote).toBeNull();
    expect(sent.accommodationNote).toBeNull();
    expect(sent.sitNextToUserIds).toEqual([]);
  });

  it("propagates errors (no try/catch)", async () => {
    makeFailingCallable("Booking window closed");
    await expect(
      submitEventBooking({ idempotencyKey: BOOKING_UUID, eventId: EVENT_UUID, lines: [] })
    ).rejects.toThrow("Booking window closed");
  });
});

describe("createTicketCheckoutSession", () => {
  it("calls with normalized ticketTypeId and defaults quantity to 1", async () => {
    const callable = makeCallable({ data: { url: "https://stripe.com/checkout/1", orderId: "o1" } });

    const result = await createTicketCheckoutSession({ ticketTypeId: TICKET_UUID });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "createTicketCheckoutSession");
    expect(callable).toHaveBeenCalledWith({ ticketTypeId: TICKET_UUID, quantity: 1 });
    expect(result).toEqual({ url: "https://stripe.com/checkout/1", orderId: "o1" });
  });

  it("passes explicit quantity through", async () => {
    const callable = makeCallable({ data: { url: "https://stripe.com/checkout/2", orderId: "o2" } });

    await createTicketCheckoutSession({ ticketTypeId: TICKET_UUID, quantity: 3 });

    expect(callable).toHaveBeenCalledWith({ ticketTypeId: TICKET_UUID, quantity: 3 });
  });
});

describe("createEventBookingCheckoutSession", () => {
  it("calls with normalized eventId", async () => {
    const callable = makeCallable({ data: { url: "https://stripe.com/checkout/3", orderIds: ["o3"] } });

    const result = await createEventBookingCheckoutSession({ eventId: EVENT_UUID });

    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "createEventBookingCheckoutSession"
    );
    expect(callable).toHaveBeenCalledWith({ eventId: EVENT_UUID });
    expect(result).toEqual({ url: "https://stripe.com/checkout/3", orderIds: ["o3"] });
  });
});

describe("getMyTicketOrderStripeArtifactsBatch", () => {
  it("normalizes order IDs and returns artifacts", async () => {
    const artifacts = { artifactsByOrderId: { [BOOKING_UUID]: { receiptUrl: "https://receipt.url" } } };
    const callable = makeCallable({ data: artifacts });

    const result = await getMyTicketOrderStripeArtifactsBatch({ orderIds: [BOOKING_UUID] });

    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "getMyTicketOrderStripeArtifactsBatch"
    );
    expect(callable).toHaveBeenCalledWith({ orderIds: [BOOKING_UUID] });
    expect(result).toEqual(artifacts);
  });

  it("unwraps nested data.result if present", async () => {
    const artifacts = { artifactsByOrderId: { [BOOKING_UUID]: { receiptUrl: null } } };
    makeCallable({ data: { result: artifacts } });

    const result = await getMyTicketOrderStripeArtifactsBatch({ orderIds: [BOOKING_UUID] });

    expect(result).toEqual(artifacts);
  });
});

describe("reconcileMyCheckoutSessionOrders", () => {
  it("calls with normalized orderId and returns reconciliation result", async () => {
    const response = { appliedCount: 1, reconciledOrderIds: [BOOKING_UUID], orderIds: [BOOKING_UUID] };
    const callable = makeCallable({ data: response });

    const result = await reconcileMyCheckoutSessionOrders({ orderId: BOOKING_UUID });

    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "reconcileMyCheckoutSessionOrders"
    );
    expect(callable).toHaveBeenCalledWith({ orderId: BOOKING_UUID });
    expect(result).toEqual(response);
  });

  it("unwraps nested data.result if present", async () => {
    const response = { appliedCount: 0, reconciledOrderIds: [], orderIds: [] };
    makeCallable({ data: { result: response } });

    const result = await reconcileMyCheckoutSessionOrders({ orderId: BOOKING_UUID });

    expect(result).toEqual(response);
  });
});

// ============================================================================
// Guest ticket requests
// ============================================================================

describe("submitGuestTicketRequest", () => {
  it("calls with normalized UUIDs and trimmed strings", async () => {
    const callable = makeCallable({ data: { success: true, requestId: "r1" } });

    const result = await submitGuestTicketRequest({
      bookingId: BOOKING_UUID,
      requestedGuestCount: 2,
      guestTicketTypeId: TICKET_UUID,
      guestDisplayName: "  Jane Smith  ",
      dietaryNote: "  gluten free  ",
    });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "submitGuestTicketRequest");
    const sent = callable.mock.calls[0][0];
    expect(sent.guestDisplayName).toBe("Jane Smith");
    expect(sent.dietaryNote).toBe("gluten free");
    expect(result).toEqual({ success: true, requestId: "r1" });
  });

  it("sends null for blank dietaryNote", async () => {
    const callable = makeCallable({ data: { success: true, requestId: "r2" } });

    await submitGuestTicketRequest({
      bookingId: BOOKING_UUID,
      requestedGuestCount: 1,
      guestTicketTypeId: TICKET_UUID,
      guestDisplayName: "Jane",
      dietaryNote: "   ",
    });

    expect(callable.mock.calls[0][0].dietaryNote).toBeNull();
  });

  it("propagates errors", async () => {
    makeFailingCallable("Booking not found");
    await expect(
      submitGuestTicketRequest({
        bookingId: BOOKING_UUID,
        requestedGuestCount: 1,
        guestTicketTypeId: TICKET_UUID,
        guestDisplayName: "Jane",
      })
    ).rejects.toThrow("Booking not found");
  });
});

describe("reviewGuestTicketRequest", () => {
  it("calls with normalized id, status, and trimmed moderatorNote", async () => {
    const callable = makeCallable({ data: { success: true } });

    const result = await reviewGuestTicketRequest({
      id: BOOKING_UUID,
      status: "APPROVED",
      moderatorNote: "  Looks good  ",
    });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "reviewGuestTicketRequest");
    const sent = callable.mock.calls[0][0];
    expect(sent.status).toBe("APPROVED");
    expect(sent.moderatorNote).toBe("Looks good");
    expect(result).toEqual({ success: true });
  });

  it("sends null for blank moderatorNote", async () => {
    const callable = makeCallable({ data: { success: true } });

    await reviewGuestTicketRequest({
      id: BOOKING_UUID,
      status: "REJECTED",
      moderatorNote: "  ",
    });

    expect(callable.mock.calls[0][0].moderatorNote).toBeNull();
  });

  it("propagates errors", async () => {
    makeFailingCallable("Not authorized");
    await expect(
      reviewGuestTicketRequest({ id: BOOKING_UUID, status: "APPROVED" })
    ).rejects.toThrow("Not authorized");
  });
});
