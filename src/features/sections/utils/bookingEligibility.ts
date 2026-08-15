import type { MembershipStatus } from "@dataconnect/generated";
import { linkHasPurpose } from "./purposeLinks";

/** Mirrors server `bookingRules.userMatchesUserGroup` for client-side previews. */
export function userMatchesUserGroup(
  membershipStatus: string,
  group: { id: string; membershipStatuses?: string[] | null },
  explicitGroupIds: Set<string>
): boolean {
  if (explicitGroupIds.has(group.id)) return true;
  const statuses = group.membershipStatuses;
  if (!statuses?.length) return false;
  return statuses.includes(membershipStatus);
}

export function purposeGrantsSectionAccess(purpose: string): boolean {
  return purpose === "ACCESS" || purpose === "MODERATOR";
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

export type BookingGateFailureCode =
  | "NO_SECTION_ACCESS"
  | "NO_BOOKER_PURPOSE"
  | "NOT_AUTHORIZED_BOOKER"
  | "OUTSIDE_BOOKING_WINDOW";

export type BookingGateResult =
  | { ok: true; moderatorWindowOverride: "BEFORE" | "AFTER" | null }
  | { ok: false; code: BookingGateFailureCode; message: string };

/**
 * Client-side gate preview (server still enforces). Uses the same rules as `evaluateBookingGatekeeping`.
 */
export function evaluateBookingGatePreview(args: {
  purposeLinks: { purpose?: string; purposes?: string[] | null; userGroup: { id: string; membershipStatuses?: string[] | null } }[];
  membershipStatus: MembershipStatus | string;
  explicitGroupIds: Set<string>;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  nowMs?: number;
}): BookingGateResult {
  const { purposeLinks, membershipStatus, explicitGroupIds, bookingStartDateTime, bookingEndDateTime, nowMs } =
    args;

  if (!userHasSectionAccess(purposeLinks, explicitGroupIds, membershipStatus)) {
    return {
      ok: false,
      code: "NO_SECTION_ACCESS",
      message: "You do not have permission to access this section.",
    };
  }
  if (!purposeLinks.some((l) => linkHasPurpose(l, "BOOKER"))) {
    return {
      ok: false,
      code: "NO_BOOKER_PURPOSE",
      message: "This section is not configured for online bookings.",
    };
  }
  if (!userHasBookerPurpose(purposeLinks, explicitGroupIds, membershipStatus)) {
    return {
      ok: false,
      code: "NOT_AUTHORIZED_BOOKER",
      message: "You are not in a group allowed to book for this section.",
    };
  }
  const bookingWindowState = getBookingWindowState(bookingStartDateTime, bookingEndDateTime, nowMs);
  const moderatorWindowOverride =
    (bookingWindowState === "BEFORE" || bookingWindowState === "AFTER") &&
    userHasModeratorPurpose(purposeLinks, explicitGroupIds, membershipStatus)
      ? bookingWindowState
      : null;
  if (bookingWindowState !== "OPEN" && !moderatorWindowOverride) {
    return {
      ok: false,
      code: "OUTSIDE_BOOKING_WINDOW",
      message:
        bookingWindowState === "AFTER"
          ? "Bookings for this event are closed."
          : "Booking is only open during the published booking window.",
    };
  }
  return { ok: true, moderatorWindowOverride };
}
