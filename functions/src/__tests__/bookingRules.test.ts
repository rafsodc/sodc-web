import { describe, it, expect } from "vitest";
import { TicketAudience } from "@dataconnect/admin-generated";
import {
  BOOKING_RULE_ERROR_CODES,
  evaluateBookingGatekeeping,
  evaluateBookingLines,
  evaluateGuestApprovalGate,
  userHasSectionAccess,
  userHasBookerPurpose,
  isWithinBookingWindow,
  type LineInputForRules,
  type TicketTypeForRules,
} from "../bookingRules";

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

  it("evaluateBookingLines accepts member-only then guest", () => {
    const lines: LineInputForRules[] = [
      { ticketTypeId: "tt-m", sortOrder: 0 },
      { ticketTypeId: "tt-g", sortOrder: 1, guestDisplayName: "Guest Name" },
    ];
    const r = evaluateBookingLines(lines, map, "REGULAR", explicit);
    expect(r.ok).toBe(true);
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

  it("rejects more than one guest line", () => {
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
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BOOKING_RULE_ERROR_CODES.TOO_MANY_GUEST_LINES);
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
});
