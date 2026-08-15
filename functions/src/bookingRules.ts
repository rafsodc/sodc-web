import { BookingApprovalStatus, TicketAudience } from "@dataconnect/admin-generated";

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
  EVENT_GUEST_POLICY_NOT_CONFIGURED: "EVENT_GUEST_POLICY_NOT_CONFIGURED",
  BOOKING_ALREADY_SUBMITTED: "BOOKING_ALREADY_SUBMITTED",
  IDEMPOTENCY_DRAFT_CONFLICT: "IDEMPOTENCY_DRAFT_CONFLICT",
  PAID_BOOKING_PLACE_REMOVAL_REQUIRES_REFUND: "PAID_BOOKING_PLACE_REMOVAL_REQUIRES_REFUND",
} as const;

export type BookingRuleErrorCode = (typeof BOOKING_RULE_ERROR_CODES)[keyof typeof BOOKING_RULE_ERROR_CODES];

export type BookingRulesFailure = { ok: false; code: BookingRuleErrorCode; message: string };
export type BookingRulesSuccess = { ok: true };
export type BookingRulesResult = BookingRulesFailure | BookingRulesSuccess;
export type BookingGatekeepingResult = BookingRulesFailure | { ok: true; moderatorLateBooking: boolean };

function fail(code: BookingRuleErrorCode, message: string): BookingRulesFailure {
  return { ok: false, code, message };
}

export function purposeGrantsSectionAccess(purpose: string): boolean {
  return purpose === "ACCESS" || purpose === "MODERATOR";
}

function linkHasPurpose(link: { purpose?: string; purposes?: string[] | null }, target: string): boolean {
  return link.purpose === target || (link.purposes?.includes(target) ?? false);
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

export function userHasModeratorPurpose(
  purposeLinks: { purpose?: string; purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }[],
  explicitGroupIds: Set<string>,
  membershipStatus: string
): boolean {
  return purposeLinks.some(
    (link) =>
      linkHasPurpose(link, "MODERATOR") &&
      userMatchesUserGroup(membershipStatus, link.userGroup, explicitGroupIds)
  );
}

export type BookingWindowState = "BEFORE" | "OPEN" | "AFTER" | "INVALID";

export function getBookingWindowState(
  bookingStartDateTime: string,
  bookingEndDateTime: string,
  nowMs: number = Date.now()
): BookingWindowState {
  const start = Date.parse(bookingStartDateTime);
  const end = Date.parse(bookingEndDateTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return "INVALID";
  if (nowMs < start) return "BEFORE";
  if (nowMs > end) return "AFTER";
  return "OPEN";
}

export function isWithinBookingWindow(
  bookingStartDateTime: string,
  bookingEndDateTime: string,
  nowMs: number = Date.now()
): boolean {
  return getBookingWindowState(bookingStartDateTime, bookingEndDateTime, nowMs) === "OPEN";
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
 * Validates the complete booking line collection. Every guest is represented by
 * a guest-audience BookingLine; moderation is decided separately for the whole
 * booking revision.
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

  if (memberLineCount !== 1) {
    return fail(
      BOOKING_RULE_ERROR_CODES.SELF_TICKET_REQUIRED,
      "Exactly one member ticket line is required for the booker"
    );
  }

  const maxGuestLines = options?.maxGuestLines;
  if (maxGuestLines != null && guestLineCount > maxGuestLines) {
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
  if (threshold == null) {
    return fail(
      BOOKING_RULE_ERROR_CODES.EVENT_GUEST_POLICY_NOT_CONFIGURED,
      "This event does not have a guest approval limit configured"
    );
  }
  if (args.guestTicketCount <= threshold) {
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

export interface ApprovalRelevantGuest {
  ticketTypeId: string;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
}

function assertGuestApprovalPolicy(maxGuestsWithoutModeratorApproval: number): void {
  if (!Number.isInteger(maxGuestsWithoutModeratorApproval) || maxGuestsWithoutModeratorApproval < 0) {
    throw new RangeError("maxGuestsWithoutModeratorApproval must be a non-negative integer");
  }
}

/** Derives initial moderation state from guest places only; the member is excluded. */
export function deriveBookingApprovalStatus(args: {
  guestTicketCount: number;
  maxGuestsWithoutModeratorApproval: number;
}): BookingApprovalStatus {
  assertGuestApprovalPolicy(args.maxGuestsWithoutModeratorApproval);
  if (!Number.isInteger(args.guestTicketCount) || args.guestTicketCount < 0) {
    throw new RangeError("guestTicketCount must be a non-negative integer");
  }
  return args.guestTicketCount > args.maxGuestsWithoutModeratorApproval
    ? BookingApprovalStatus.PENDING
    : BookingApprovalStatus.NOT_REQUIRED;
}

export function bookingApprovalAllowsPayment(status: BookingApprovalStatus): boolean {
  return status === BookingApprovalStatus.NOT_REQUIRED || status === BookingApprovalStatus.APPROVED;
}

function approvalIdentityKey(guest: ApprovalRelevantGuest): string {
  const linkedUser = guest.guestUserId?.trim();
  const displayName = guest.guestDisplayName?.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB") ?? "";
  return `user:${linkedUser ?? ""}|name:${displayName}|ticket:${guest.ticketTypeId}`;
}

/**
 * Guest count, identity, and ticket type require reapproval. Ordering and
 * dietary-only edits deliberately do not.
 */
export function approvalRelevantGuestDetailsChanged(
  previousGuests: ApprovalRelevantGuest[],
  revisedGuests: ApprovalRelevantGuest[]
): boolean {
  if (previousGuests.length !== revisedGuests.length) return true;
  // Compare as a multiset because ordering is not approval-relevant. Two
  // unlinked guests with the same normalized name and ticket type are
  // intentionally indistinguishable: swapping them changes no policy data.
  const previous = previousGuests.map(approvalIdentityKey).sort();
  const revised = revisedGuests.map(approvalIdentityKey).sort();
  return previous.some((key, index) => key !== revised[index]);
}

/** Carries approval across dietary-only edits and resets relevant over-limit edits. */
export function deriveRevisedBookingApprovalStatus(args: {
  previousStatus: BookingApprovalStatus;
  previousGuests: ApprovalRelevantGuest[];
  revisedGuests: ApprovalRelevantGuest[];
  maxGuestsWithoutModeratorApproval: number;
}): BookingApprovalStatus {
  const policyStatus = deriveBookingApprovalStatus({
    guestTicketCount: args.revisedGuests.length,
    maxGuestsWithoutModeratorApproval: args.maxGuestsWithoutModeratorApproval,
  });
  if (policyStatus === BookingApprovalStatus.NOT_REQUIRED) return policyStatus;
  return approvalRelevantGuestDetailsChanged(args.previousGuests, args.revisedGuests)
    ? BookingApprovalStatus.PENDING
    : args.previousStatus;
}

export function evaluateBookingGatekeeping(args: {
  purposeLinks: { purpose?: string; purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }[];
  membershipStatus: string;
  explicitGroupIds: Set<string>;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  nowMs?: number;
}): BookingGatekeepingResult {
  if (!userHasSectionAccess(args.purposeLinks, args.explicitGroupIds, args.membershipStatus)) {
    return fail(BOOKING_RULE_ERROR_CODES.NO_SECTION_ACCESS, "You do not have permission to access this section");
  }
  if (!args.purposeLinks.some((l) => linkHasPurpose(l, "BOOKER"))) {
    return fail(BOOKING_RULE_ERROR_CODES.NO_BOOKER_PURPOSE, "This section is not configured for bookings");
  }
  if (!userHasBookerPurpose(args.purposeLinks, args.explicitGroupIds, args.membershipStatus)) {
    return fail(BOOKING_RULE_ERROR_CODES.NOT_AUTHORIZED_BOOKER, "You are not in a group allowed to book for this section");
  }
  const bookingWindowState = getBookingWindowState(
    args.bookingStartDateTime,
    args.bookingEndDateTime,
    args.nowMs
  );
  const moderatorLateBooking =
    bookingWindowState === "AFTER" &&
    userHasModeratorPurpose(args.purposeLinks, args.explicitGroupIds, args.membershipStatus);
  if (bookingWindowState !== "OPEN" && !moderatorLateBooking) {
    return fail(BOOKING_RULE_ERROR_CODES.OUTSIDE_BOOKING_WINDOW, "Booking is only allowed during the published booking window");
  }
  return { ok: true, moderatorLateBooking };
}
