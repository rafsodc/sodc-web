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

import type { MembershipStatus } from "@dataconnect/generated";
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
  getSectionForUser,
  getSectionEventsForUser,
  getEventForUser,
  submitEventBooking,
  createTicketCheckoutSession,
  createEventBookingCheckoutSession,
  getMyTicketOrderStripeArtifactsBatch,
  reconcileMyCheckoutSessionOrders,
  reviewBookingRevision,
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
    expect(result.error).toBe("Administrator access could not be granted. Please try again.");
    expect(result.error).not.toContain("Permission denied");
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
    expect(result.error).toBe("Administrator access could not be revoked. Please try again.");
    expect(result.error).not.toContain("Last admin");
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
    expect(result.error).toBe("The display name could not be updated. Please try again.");
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
    expect(result.error).toBe("The display name could not be updated. Please try again.");
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
    expect(result.error).toBe("Users without profiles could not be loaded. Please try again.");
  });
});

describe("listUsersPendingApproval", () => {
  it("calls the function and returns pending users", async () => {
    const users = [{ id: "u2", firstName: "John", lastName: "Doe", email: "j@d.com", serviceNumber: "SN1", membershipStatus: "PENDING", requestedMembershipStatus: "REGULAR" as MembershipStatus, createdAt: "", updatedAt: "" }];
    makeCallable({ data: { users } });

    const result = await listUsersPendingApproval();

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "listUsersPendingApproval");
    expect(result).toEqual({ success: true, users });
  });

  it("returns success: false on error", async () => {
    makeFailingCallable("Service unavailable");
    const result = await listUsersPendingApproval();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Pending users could not be loaded. Please try again.");
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
    expect(result.error).toBe("The account status could not be synchronised. Please try again.");
  });
});

// ============================================================================
// Membership status functions
// ============================================================================

describe("updateMembershipStatus", () => {
  it("calls updateMembershipStatus with userId and newStatus", async () => {
    const callable = makeCallable({ data: { success: true } });
    const result = await updateMembershipStatus("user-789", "REGULAR" as MembershipStatus);

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "updateMembershipStatus");
    expect(callable).toHaveBeenCalledWith({ userId: "user-789", newStatus: "REGULAR" as MembershipStatus });
    expect(result).toEqual({ success: true });
  });

  it("returns success: false on error", async () => {
    vi.mocked(httpsCallable).mockReturnValue(
      vi.fn().mockRejectedValue({
        message: "Invalid status transition",
        details: { code: "CURRENT_STATUS_RESTRICTED" },
      }) as any,
    );
    const result = await updateMembershipStatus("user-789", "REGULAR" as MembershipStatus);

    expect(result.success).toBe(false);
    expect(result.error).toBe("The membership status could not be updated. Please try again.");
    expect(result.error).not.toContain("Invalid status transition");
    expect(result.domainCode).toBe("CURRENT_STATUS_RESTRICTED");
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
    vi.mocked(httpsCallable).mockReturnValue(
      vi.fn().mockRejectedValue({
        message: "Cannot resign as admin",
        details: { code: "ADMIN_RESIGNATION_NOT_ALLOWED" },
      }) as any,
    );
    const result = await resignMembership();

    expect(result.success).toBe(false);
    expect(result.error).toBe("The membership could not be resigned. Please try again.");
    expect(result.error).not.toContain("Cannot resign as admin");
    expect(result.domainCode).toBe("ADMIN_RESIGNATION_NOT_ALLOWED");
  });
});

// ============================================================================
// Section members
// ============================================================================

describe("getSectionMembersMerged", () => {
  it("calls getSectionMembersMerged with sectionId and returns members", async () => {
    const members = [{ id: "u1", firstName: "A", lastName: "B", email: "a@b.com", membershipStatus: "REGULAR" as MembershipStatus }];
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

describe("getSectionForUser", () => {
  it("calls getSectionForUser with sectionId and returns the access result", async () => {
    const response = { section: { id: "section-abc", name: "Test" }, hasAccess: true, canModerate: false };
    const callable = makeCallable({ data: response });

    const result = await getSectionForUser("section-abc");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "getSectionForUser");
    expect(callable).toHaveBeenCalledWith({ sectionId: "section-abc" });
    expect(result).toEqual(response);
  });

  it("propagates errors (no try/catch)", async () => {
    makeFailingCallable("Section not found");

    await expect(getSectionForUser("bad-id")).rejects.toThrow("Section not found");
  });
});

describe("getSectionEventsForUser", () => {
  it("calls getSectionEventsForUser with sectionId and returns events", async () => {
    const events = [{ id: "event-1", title: "Dinner" }];
    const callable = makeCallable({ data: { events } });

    const result = await getSectionEventsForUser("section-abc");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "getSectionEventsForUser");
    expect(callable).toHaveBeenCalledWith({ sectionId: "section-abc" });
    expect(result).toEqual({ events });
  });

  it("propagates errors (no try/catch)", async () => {
    makeFailingCallable("You do not have permission to view this section");

    await expect(getSectionEventsForUser("bad-id")).rejects.toThrow(
      "You do not have permission to view this section"
    );
  });
});

describe("getEventForUser", () => {
  it("calls getEventForUser with eventId and returns the event", async () => {
    const event = { id: "event-1", title: "Dinner" };
    const callable = makeCallable({ data: { event } });

    const result = await getEventForUser("event-1");

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "getEventForUser");
    expect(callable).toHaveBeenCalledWith({ eventId: "event-1" });
    expect(result).toEqual({ event });
  });

  it("propagates errors (no try/catch)", async () => {
    makeFailingCallable("Event not found");

    await expect(getEventForUser("bad-id")).rejects.toThrow("Event not found");
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
      lines: [{ ticketTypeId: TICKET_UUID, sortOrder: 1, dietaryNote: "  vegan  " }],
      sitNextToUserIds: ["  uid-1  ", "", "uid-2"],
      accommodationRequested: true,
      accommodationNote: "  ground floor  ",
    });

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "submitEventBooking");
    const sent = callable.mock.calls[0][0];
    expect(sent.lines[0].dietaryNote).toBe("vegan");
    expect(sent).not.toHaveProperty("bookerDietaryNote");
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
    expect(sent).not.toHaveProperty("bookerDietaryNote");
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
    const callable = makeCallable({ data: { url: "https://stripe.com/checkout/3", orderIds: ["o3"], confirmed: false } });

    const result = await createEventBookingCheckoutSession({ eventId: EVENT_UUID });

    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "createEventBookingCheckoutSession"
    );
    expect(callable).toHaveBeenCalledWith({ eventId: EVENT_UUID });
    expect(result).toEqual({ url: "https://stripe.com/checkout/3", orderIds: ["o3"], confirmed: false });
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

describe("reviewBookingRevision", () => {
  it("sends an exact revision decision with a normalized id and note", async () => {
    const response = {
      success: true,
      bookingId: BOOKING_UUID,
      revisionNumber: 2,
      approvalStatus: "APPROVED" as const,
      paymentDelta: 1000,
    };
    const callable = makeCallable({ data: response });

    await expect(reviewBookingRevision({
      bookingId: BOOKING_UUID,
      expectedRevisionNumber: 2,
      decision: "APPROVED",
      moderatorNote: "  Approved for payment  ",
    })).resolves.toEqual(response);

    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "reviewBookingRevision");
    expect(callable).toHaveBeenCalledWith({
      bookingId: BOOKING_UUID,
      expectedRevisionNumber: 2,
      decision: "APPROVED",
      moderatorNote: "Approved for payment",
    });
  });
});
