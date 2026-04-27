import { TicketAudience } from "@dataconnect/admin-generated";

/** Stable codes for clients (issue #46 / member UI #47). */
export const BOOKING_RULE_ERROR_CODES = {
  INVALID_LINES: "INVALID_LINES",
  NO_SECTION_ACCESS: "NO_SECTION_ACCESS",
  NO_BOOKER_PURPOSE: "NO_BOOKER_PURPOSE",
  NOT_AUTHORIZED_BOOKER: "NOT_AUTHORIZED_BOOKER",
  OUTSIDE_BOOKING_WINDOW: "OUTSIDE_BOOKING_WINDOW",
  TICKET_TYPE_NOT_FOUND: "TICKET_TYPE_NOT_FOUND",
  INELIGIBLE_TICKET_TYPE: "INELIGIBLE_TICKET_TYPE",
  SELF_TICKET_REQUIRED: "SELF_TICKET_REQUIRED",
  GUEST_BEFORE_SELF: "GUEST_BEFORE_SELF",
  TOO_MANY_GUEST_LINES: "TOO_MANY_GUEST_LINES",
  INVALID_GUEST_FIELDS: "INVALID_GUEST_FIELDS",
  GUEST_APPROVAL_REQUIRED: "GUEST_APPROVAL_REQUIRED",
  BOOKING_ALREADY_SUBMITTED: "BOOKING_ALREADY_SUBMITTED",
  IDEMPOTENCY_DRAFT_CONFLICT: "IDEMPOTENCY_DRAFT_CONFLICT",
} as const;

export type BookingRuleErrorCode = (typeof BOOKING_RULE_ERROR_CODES)[keyof typeof BOOKING_RULE_ERROR_CODES];

export type BookingRulesFailure = { ok: false; code: BookingRuleErrorCode; message: string };
export type BookingRulesSuccess = { ok: true };
export type BookingRulesResult = BookingRulesFailure | BookingRulesSuccess;

function fail(code: BookingRuleErrorCode, message: string): BookingRulesFailure {
  return { ok: false, code, message };
}

export function purposeGrantsSectionAccess(purpose: string): boolean {
  return purpose === "ACCESS" || purpose === "MODERATOR";
}

function linkHasPurpose(link: { purpose?: string; purposes?: string[] | null }, target: string): boolean {
  if (link.purpose) return link.purpose === target;
  return link.purposes?.includes(target) ?? false;
}

/** Explicit group membership or membership-status–based group (same idea as getSectionMembersMerged). */
export function userMatchesUserGroup(
  membershipStatus: string,
  group: { id: string; membershipStatuses?: string[] | null },
  explicitGroupIds: Set<string>
): boolean {
  if (explicitGroupIds.has(group.id)) return true;
  const statuses = group.membershipStatuses;
  if (!statuses?.length) return false;
  return statuses.includes(membershipStatus as never);
}

export function userHasSectionAccess(
  purposeLinks: { purpose?: string; purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }[],
  explicitGroupIds: Set<string>,
  membershipStatus: string
): boolean {
  for (const link of purposeLinks) {
    if (!linkHasPurpose(link, "ACCESS") && !linkHasPurpose(link, "MODERATOR")) continue;
    if (userMatchesUserGroup(membershipStatus, link.userGroup, explicitGroupIds)) {
      return true;
    }
  }
  return false;
}

export function userHasBookerPurpose(
  purposeLinks: { purpose?: string; purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }[],
  explicitGroupIds: Set<string>,
  membershipStatus: string
): boolean {
  const bookerLinks = purposeLinks.filter((l) => linkHasPurpose(l, "BOOKER"));
  if (bookerLinks.length === 0) return false;
  return bookerLinks.some((l) => userMatchesUserGroup(membershipStatus, l.userGroup, explicitGroupIds));
}

export function isWithinBookingWindow(
  bookingStartDateTime: string,
  bookingEndDateTime: string,
  nowMs: number = Date.now()
): boolean {
  const start = Date.parse(bookingStartDateTime);
  const end = Date.parse(bookingEndDateTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return nowMs >= start && nowMs <= end;
}

export interface TicketTypeForRules {
  id: string;
  audience: TicketAudience;
  userGroup: { id: string; membershipStatuses?: string[] | null };
}

export interface LineInputForRules {
  ticketTypeId: string;
  sortOrder: number;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
}

/**
 * Validates line items: eligibility per ticket type, self-before-guest ordering, at most one guest line.
 */
export function evaluateBookingLines(
  lines: LineInputForRules[],
  ticketTypesById: Map<string, TicketTypeForRules>,
  membershipStatus: string,
  explicitGroupIds: Set<string>,
  options?: { maxGuestLines?: number }
): BookingRulesResult {
  if (lines.length === 0) {
    return fail(BOOKING_RULE_ERROR_CODES.INVALID_LINES, "At least one ticket line is required");
  }

  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const line of sorted) {
    const tt = ticketTypesById.get(line.ticketTypeId);
    if (!tt) {
      return fail(BOOKING_RULE_ERROR_CODES.TICKET_TYPE_NOT_FOUND, `Unknown ticket type ${line.ticketTypeId}`);
    }
    if (!userMatchesUserGroup(membershipStatus, tt.userGroup, explicitGroupIds)) {
      return fail(BOOKING_RULE_ERROR_CODES.INELIGIBLE_TICKET_TYPE, `Not eligible for ticket type ${tt.id}`);
    }
  }

  let memberLineCount = 0;
  let guestLineCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i];
    const tt = ticketTypesById.get(line.ticketTypeId)!;
    if (tt.audience === TicketAudience.MEMBER) {
      memberLineCount++;
      if (line.guestUserId?.trim() || line.guestDisplayName?.trim()) {
        return fail(
          BOOKING_RULE_ERROR_CODES.INVALID_GUEST_FIELDS,
          "Member-priced lines cannot name a guest; use a guest ticket type for guests"
        );
      }
    } else {
      guestLineCount++;
      const named =
        (line.guestUserId && line.guestUserId.trim().length > 0) ||
        (line.guestDisplayName && line.guestDisplayName.trim().length > 0);
      if (!named) {
        return fail(
          BOOKING_RULE_ERROR_CODES.INVALID_GUEST_FIELDS,
          "Guest ticket lines must include a guest display name or linked user id"
        );
      }
    }
  }

  if (memberLineCount < 1) {
    return fail(BOOKING_RULE_ERROR_CODES.SELF_TICKET_REQUIRED, "At least one member ticket line is required for the booker");
  }

  const maxGuestLines = options?.maxGuestLines ?? 1;
  if (guestLineCount > maxGuestLines) {
    return fail(
      BOOKING_RULE_ERROR_CODES.TOO_MANY_GUEST_LINES,
      maxGuestLines === 1
        ? "Only one guest ticket is allowed in the standard flow; use moderator approval for more guests"
        : `A maximum of ${maxGuestLines} guest tickets is allowed`
    );
  }

  const firstMemberIdx = sorted.findIndex((ln) => ticketTypesById.get(ln.ticketTypeId)!.audience === TicketAudience.MEMBER);
  const firstGuestIdx = sorted.findIndex((ln) => ticketTypesById.get(ln.ticketTypeId)!.audience === TicketAudience.GUEST);
  if (firstGuestIdx >= 0 && firstMemberIdx >= 0 && firstGuestIdx < firstMemberIdx) {
    return fail(BOOKING_RULE_ERROR_CODES.GUEST_BEFORE_SELF, "Member tickets must be ordered before guest tickets");
  }

  return { ok: true };
}

export function evaluateGuestApprovalGate(args: {
  guestTicketCount: number;
  maxGuestsWithoutModeratorApproval?: number | null;
  approvedGuestCapacity: number;
}): BookingRulesResult {
  const threshold = args.maxGuestsWithoutModeratorApproval;
  if (threshold == null || args.guestTicketCount <= threshold) {
    return { ok: true };
  }
  const requiredApprovedGuestCount = args.guestTicketCount - threshold;
  if (args.approvedGuestCapacity >= requiredApprovedGuestCount) {
    return { ok: true };
  }
  return fail(
    BOOKING_RULE_ERROR_CODES.GUEST_APPROVAL_REQUIRED,
    "Guest ticket count exceeds approved moderation threshold for this booking revision"
  );
}

export function evaluateBookingGatekeeping(args: {
  purposeLinks: { purpose?: string; purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }[];
  membershipStatus: string;
  explicitGroupIds: Set<string>;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  nowMs?: number;
}): BookingRulesResult {
  if (!userHasSectionAccess(args.purposeLinks, args.explicitGroupIds, args.membershipStatus)) {
    return fail(BOOKING_RULE_ERROR_CODES.NO_SECTION_ACCESS, "You do not have permission to access this section");
  }
  if (!args.purposeLinks.some((l) => linkHasPurpose(l, "BOOKER"))) {
    return fail(BOOKING_RULE_ERROR_CODES.NO_BOOKER_PURPOSE, "This section is not configured for bookings");
  }
  if (!userHasBookerPurpose(args.purposeLinks, args.explicitGroupIds, args.membershipStatus)) {
    return fail(BOOKING_RULE_ERROR_CODES.NOT_AUTHORIZED_BOOKER, "You are not in a group allowed to book for this section");
  }
  if (!isWithinBookingWindow(args.bookingStartDateTime, args.bookingEndDateTime, args.nowMs)) {
    return fail(BOOKING_RULE_ERROR_CODES.OUTSIDE_BOOKING_WINDOW, "Booking is only allowed during the published booking window");
  }
  return { ok: true };
}
