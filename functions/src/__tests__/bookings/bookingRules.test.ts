import { describe, it, expect } from "vitest";
import { BookingApprovalStatus, TicketAudience } from "@dataconnect/admin-generated";
import {
  BOOKING_RULE_ERROR_CODES,
  bookingApprovalAllowsPayment,
  evaluateBookingGatekeeping,
  evaluateBookingLines,
  evaluateGuestApprovalGate,
  approvalRelevantGuestDetailsChanged,
  deriveBookingApprovalStatus,
  deriveRevisedBookingApprovalStatus,
  userHasSectionAccess,
  userHasBookerPurpose,
  isWithinBookingWindow,
  type LineInputForRules,
  type TicketTypeForRules,
} from "../../bookingRules";

const group = (id: string, statuses?: string[] | null) => ({
  id,
  membershipStatuses: statuses ?? null,
});

describe("bookingRules", () => {
  const ttMember: TicketTypeForRules = {
    id: "tt-m",
    audience: TicketAudience.MEMBER,
    userGroup: group("g1", ["REGULAR"]),
  };
  const ttGuest: TicketTypeForRules = {
    id: "tt-g",
    audience: TicketAudience.GUEST,
    userGroup: group("g1", ["REGULAR"]),
  };

  const map = new Map<string, TicketTypeForRules>([
    [ttMember.id, ttMember],
    [ttGuest.id, ttGuest],
  ]);

  const explicit = new Set<string>(["g1"]);

  it("requires section ACCESS/MODERATOR match for gatekeeping", () => {
    const purposeLinks = [{ purpose: "BOOKER", userGroup: group("g1") }];
    expect(userHasSectionAccess(purposeLinks, explicit, "REGULAR")).toBe(false);
    const withAccess = [
      { purpose: "ACCESS", userGroup: group("g1", ["REGULAR"]) },
      { purpose: "BOOKER", userGroup: group("g1", ["REGULAR"]) },
    ];
    expect(
      evaluateBookingGatekeeping({
        purposeLinks: withAccess,
        membershipStatus: "REGULAR",
        explicitGroupIds: explicit,
        bookingStartDateTime: new Date(Date.now() - 60_000).toISOString(),
        bookingEndDateTime: new Date(Date.now() + 60_000).toISOString(),
      }).ok
    ).toBe(true);
  });

  it("accepts ACCESS from purposes array when legacy purpose differs", () => {
    const r = evaluateBookingGatekeeping({
      purposeLinks: [
        { purpose: "MEMBER", purposes: ["MEMBER", "ACCESS"], userGroup: group("g1", ["REGULAR"]) },
        { purpose: "BOOKER", userGroup: group("g1", ["REGULAR"]) },
      ],
      membershipStatus: "REGULAR",
      explicitGroupIds: explicit,
      bookingStartDateTime: new Date(Date.now() - 60_000).toISOString(),
      bookingEndDateTime: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(r.ok).toBe(true);
  });

  it("denies when no BOOKER purpose rows exist", () => {
    const r = evaluateBookingGatekeeping({
      purposeLinks: [{ purpose: "ACCESS", userGroup: group("g1", ["REGULAR"]) }],
      membershipStatus: "REGULAR",
      explicitGroupIds: explicit,
      bookingStartDateTime: new Date(Date.now() - 60_000).toISOString(),
      bookingEndDateTime: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BOOKING_RULE_ERROR_CODES.NO_BOOKER_PURPOSE);
  });

  it("denies booker when user does not match any BOOKER group", () => {
    const r = evaluateBookingGatekeeping({
      purposeLinks: [
        { purpose: "ACCESS", userGroup: group("g1", ["REGULAR"]) },
        { purpose: "BOOKER", userGroup: group("g2", ["INDUSTRY"]) },
      ],
      membershipStatus: "REGULAR",
      explicitGroupIds: new Set<string>(),
      nowMs: Date.now(),
      bookingStartDateTime: new Date(Date.now() - 60_000).toISOString(),
      bookingEndDateTime: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BOOKING_RULE_ERROR_CODES.NOT_AUTHORIZED_BOOKER);
  });

  it("userHasBookerPurpose is true when explicit membership matches", () => {
    expect(
      userHasBookerPurpose(
        [{ purpose: "BOOKER", userGroup: group("g9") }],
        new Set(["g9"]),
        "REGULAR"
      )
    ).toBe(true);
  });

  it("isWithinBookingWindow respects bounds", () => {
    const start = new Date(Date.now() - 120_000).toISOString();
    const end = new Date(Date.now() + 120_000).toISOString();
    expect(isWithinBookingWindow(start, end, Date.now())).toBe(true);
    expect(isWithinBookingWindow(start, end, Date.now() - 400_000)).toBe(false);
  });

  it("allows a matching section moderator to book after the window closes", () => {
    const result = evaluateBookingGatekeeping({
      purposeLinks: [
        { purposes: ["ACCESS", "BOOKER"], userGroup: group("g1", ["REGULAR"]) },
        { purpose: "MODERATOR", userGroup: group("moderators") },
      ],
      membershipStatus: "REGULAR",
      explicitGroupIds: new Set(["g1", "moderators"]),
      bookingStartDateTime: "2025-01-01T00:00:00.000Z",
      bookingEndDateTime: "2025-12-31T23:59:59.000Z",
      nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: true, moderatorWindowOverride: true });
  });

  it("does not allow an ordinary booker or another section's moderator after closing", () => {
    const result = evaluateBookingGatekeeping({
      purposeLinks: [
        { purposes: ["ACCESS", "BOOKER"], userGroup: group("g1", ["REGULAR"]) },
        { purpose: "MODERATOR", userGroup: group("other-section-moderators") },
      ],
      membershipStatus: "REGULAR",
      explicitGroupIds: new Set(["g1", "my-other-moderator-group"]),
      bookingStartDateTime: "2025-01-01T00:00:00.000Z",
      bookingEndDateTime: "2025-12-31T23:59:59.000Z",
      nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(BOOKING_RULE_ERROR_CODES.OUTSIDE_BOOKING_WINDOW);
  });

  it("allows a matching section moderator to book before the published opening time", () => {
    const result = evaluateBookingGatekeeping({
      purposeLinks: [
        { purposes: ["ACCESS", "BOOKER", "MODERATOR"], userGroup: group("g1", ["REGULAR"]) },
      ],
      membershipStatus: "REGULAR",
      explicitGroupIds: new Set(["g1"]),
      bookingStartDateTime: "2025-01-01T00:00:00.000Z",
      bookingEndDateTime: "2025-12-31T23:59:59.000Z",
      nowMs: Date.parse("2024-12-31T23:59:59.000Z"),
    });

    expect(result).toEqual({ ok: true, moderatorWindowOverride: true });
  });

  it("evaluateBookingLines accepts member-only then guest", () => {
    const lines: LineInputForRules[] = [
      { ticketTypeId: "tt-m", sortOrder: 0 },
      { ticketTypeId: "tt-g", sortOrder: 1, guestDisplayName: "Guest Name" },
    ];
    const r = evaluateBookingLines(lines, map, "REGULAR", explicit);
    expect(r.ok).toBe(true);
  });

  it("requires exactly one member ticket line", () => {
    const result = evaluateBookingLines(
      [
        { ticketTypeId: "tt-m", sortOrder: 0 },
        { ticketTypeId: "tt-m", sortOrder: 1 },
      ],
      map,
      "REGULAR",
      explicit,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(BOOKING_RULE_ERROR_CODES.SELF_TICKET_REQUIRED);
  });

  it("rejects guest before member (ordering)", () => {
    const lines: LineInputForRules[] = [
      { ticketTypeId: "tt-g", sortOrder: 0, guestDisplayName: "G" },
      { ticketTypeId: "tt-m", sortOrder: 1 },
    ];
    const r = evaluateBookingLines(lines, map, "REGULAR", explicit);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BOOKING_RULE_ERROR_CODES.GUEST_BEFORE_SELF);
  });

  it("represents every guest as a booking line", () => {
    const ttGuest2: TicketTypeForRules = {
      id: "tt-g2",
      audience: TicketAudience.GUEST,
      userGroup: group("g1", ["REGULAR"]),
    };
    const m = new Map(map);
    m.set(ttGuest2.id, ttGuest2);
    const lines: LineInputForRules[] = [
      { ticketTypeId: "tt-m", sortOrder: 0 },
      { ticketTypeId: "tt-g", sortOrder: 1, guestDisplayName: "A" },
      { ticketTypeId: "tt-g2", sortOrder: 2, guestDisplayName: "B" },
    ];
    const r = evaluateBookingLines(lines, m, "REGULAR", explicit);
    expect(r.ok).toBe(true);
  });

  it("rejects member line with guest fields", () => {
    const lines: LineInputForRules[] = [
      { ticketTypeId: "tt-m", sortOrder: 0, guestDisplayName: "oops" },
    ];
    const r = evaluateBookingLines(lines, map, "REGULAR", explicit);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BOOKING_RULE_ERROR_CODES.INVALID_GUEST_FIELDS);
  });

  it("allows over-threshold guest count when approved capacity is sufficient", () => {
    const result = evaluateGuestApprovalGate({
      guestTicketCount: 4,
      maxGuestsWithoutModeratorApproval: 1,
      approvedGuestCapacity: 3,
    });
    expect(result.ok).toBe(true);
  });

  it("requires approval when revised guest count exceeds threshold", () => {
    const result = evaluateGuestApprovalGate({
      guestTicketCount: 3,
      maxGuestsWithoutModeratorApproval: 1,
      approvedGuestCapacity: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(BOOKING_RULE_ERROR_CODES.GUEST_APPROVAL_REQUIRED);
    }
  });

  it("rejects an event with no configured guest approval limit", () => {
    const result = evaluateGuestApprovalGate({
      guestTicketCount: 0,
      maxGuestsWithoutModeratorApproval: null,
      approvedGuestCapacity: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(BOOKING_RULE_ERROR_CODES.EVENT_GUEST_POLICY_NOT_CONFIGURED);
    }
  });

  it.each([
    { guests: 0, limit: 0, expected: BookingApprovalStatus.NOT_REQUIRED },
    { guests: 1, limit: 0, expected: BookingApprovalStatus.PENDING },
    { guests: 2, limit: 2, expected: BookingApprovalStatus.NOT_REQUIRED },
    { guests: 3, limit: 2, expected: BookingApprovalStatus.PENDING },
  ])("derives approval at the guest-limit boundary", ({ guests, limit, expected }) => {
    expect(
      deriveBookingApprovalStatus({
        guestTicketCount: guests,
        maxGuestsWithoutModeratorApproval: limit,
      })
    ).toBe(expected);
  });

  it("treats identity and ticket changes, but not dietary edits or ordering, as approval relevant", () => {
    const original = [
      { ticketTypeId: "guest-dinner", guestDisplayName: "Alex Smith", dietaryNote: "none" },
      { ticketTypeId: "guest-dinner", guestUserId: "user-2", dietaryNote: "vegan" },
    ];
    expect(
      approvalRelevantGuestDetailsChanged(original, [
        { ...original[1], dietaryNote: "vegetarian" },
        { ...original[0], guestDisplayName: "  ALEX   SMITH ", dietaryNote: "gluten free" },
      ])
    ).toBe(false);
    expect(
      approvalRelevantGuestDetailsChanged(original, [
        original[0],
        { ...original[1], ticketTypeId: "guest-reception" },
      ])
    ).toBe(true);
  });

  it("treats an explicitly stored name change as relevant even when the linked user is unchanged", () => {
    expect(
      approvalRelevantGuestDetailsChanged(
        [{ ticketTypeId: "guest-dinner", guestUserId: "user-2", guestDisplayName: "Alex Smith" }],
        [{ ticketTypeId: "guest-dinner", guestUserId: "user-2", guestDisplayName: "Alex Jones" }],
      ),
    ).toBe(true);
  });

  it("returns an over-limit approved booking to pending after an approval-relevant edit", () => {
    const previousGuests = [
      { ticketTypeId: "guest-dinner", guestDisplayName: "Alex" },
      { ticketTypeId: "guest-dinner", guestDisplayName: "Sam" },
    ];
    expect(
      deriveRevisedBookingApprovalStatus({
        previousStatus: BookingApprovalStatus.APPROVED,
        previousGuests,
        revisedGuests: [previousGuests[0], { ...previousGuests[1], guestDisplayName: "Taylor" }],
        maxGuestsWithoutModeratorApproval: 1,
      })
    ).toBe(BookingApprovalStatus.PENDING);
  });

  it("preserves approval for an over-limit dietary-only edit", () => {
    const previousGuests = [
      { ticketTypeId: "guest-dinner", guestDisplayName: "Alex", dietaryNote: "none" },
      { ticketTypeId: "guest-dinner", guestDisplayName: "Sam", dietaryNote: "none" },
    ];
    expect(
      deriveRevisedBookingApprovalStatus({
        previousStatus: BookingApprovalStatus.APPROVED,
        previousGuests,
        revisedGuests: previousGuests.map((guest) => ({ ...guest, dietaryNote: "vegetarian" })),
        maxGuestsWithoutModeratorApproval: 1,
      })
    ).toBe(BookingApprovalStatus.APPROVED);
  });

  it("allows payment only for approval-eligible booking states", () => {
    expect(bookingApprovalAllowsPayment(BookingApprovalStatus.NOT_REQUIRED)).toBe(true);
    expect(bookingApprovalAllowsPayment(BookingApprovalStatus.APPROVED)).toBe(true);
    expect(bookingApprovalAllowsPayment(BookingApprovalStatus.PENDING)).toBe(false);
    expect(bookingApprovalAllowsPayment(BookingApprovalStatus.REJECTED)).toBe(false);
  });
});
