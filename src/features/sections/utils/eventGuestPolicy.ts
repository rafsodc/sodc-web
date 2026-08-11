/** Member-facing copy for the whole-booking approval threshold. */
export function formatEventGuestPolicy(maxGuestsWithoutModeratorApproval?: number | null): string {
  if (maxGuestsWithoutModeratorApproval == null) {
    return "A booking with guests may need organiser approval before payment is available.";
  }
  if (maxGuestsWithoutModeratorApproval === 0) {
    return "Any booking with guests needs organiser approval before payment is available.";
  }
  const n = maxGuestsWithoutModeratorApproval;
  return `A booking with up to ${n} guest${n === 1 ? "" : "s"} can proceed directly to payment. More than ${n} will send the complete booking for organiser approval.`;
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
