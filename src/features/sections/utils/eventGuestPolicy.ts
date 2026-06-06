/**
 * Member-facing copy for extra-guest rules (replaces raw maxGuestsWithoutModeratorApproval in UI).
 */
export function formatEventGuestPolicy(maxGuestsWithoutModeratorApproval?: number | null): string {
  if (maxGuestsWithoutModeratorApproval == null) {
    return "Extra guest tickets may require organiser review before they are confirmed.";
  }
  if (maxGuestsWithoutModeratorApproval === 0) {
    return "Any guest tickets beyond your own place require organiser review.";
  }
  const n = maxGuestsWithoutModeratorApproval;
  return `You can include up to ${n} guest ticket${n === 1 ? "" : "s"} without organiser review. Additional guests need approval.`;
}

export function guestCountNeedsModerationNotice(
  totalGuestTickets: number,
  maxGuestsWithoutModeratorApproval?: number | null
): boolean {
  if (maxGuestsWithoutModeratorApproval == null) {
    return totalGuestTickets > 0;
  }
  return totalGuestTickets > maxGuestsWithoutModeratorApproval;
}
