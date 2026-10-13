/** Pure filter/payment rules shared by the attendee table and announcement server. */
export interface FilterableAttendee {
  attendeeName: string; rank: string | null; membershipStatus: string | null;
  audience: string; ticketType: string; includesDinner: boolean; includesSymposium: boolean;
  accommodationRequested: boolean; approvalStatus: string; paymentState: string;
}

export interface EventAttendeeTicketFilters {
  attendeeName: string;
  rank: string;
  membershipStatus: string;
  audience: string;
  ticketType: string;
  includesDinner: string;
  includesSymposium: string;
  accommodationRequested: string;
  approvalStatus: string;
  paymentState: string;
}

export const emptyEventAttendeeTicketFilters: EventAttendeeTicketFilters = {
  attendeeName: "",
  rank: "",
  membershipStatus: "",
  audience: "",
  ticketType: "",
  includesDinner: "",
  includesSymposium: "",
  accommodationRequested: "",
  approvalStatus: "",
  paymentState: "",
};

function includesText(value: string | null, filter: string): boolean {
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  return !normalizedFilter || (value ?? "").toLocaleLowerCase().includes(normalizedFilter);
}

function matchesBoolean(value: boolean, filter: string): boolean {
  return !filter || (value ? "YES" : "NO") === filter;
}

export function filterEventAttendeeTicketRows<T extends FilterableAttendee>(
  rows: readonly T[],
  filters: EventAttendeeTicketFilters
): T[] {
  return rows.filter(
    (row) =>
      includesText(row.attendeeName, filters.attendeeName) &&
      includesText(row.rank, filters.rank) &&
      (!filters.membershipStatus || row.membershipStatus === filters.membershipStatus) &&
      (!filters.audience || row.audience === filters.audience) &&
      includesText(row.ticketType, filters.ticketType) &&
      matchesBoolean(row.includesDinner, filters.includesDinner) &&
      matchesBoolean(row.includesSymposium, filters.includesSymposium) &&
      matchesBoolean(row.accommodationRequested, filters.accommodationRequested) &&
      (!filters.approvalStatus || row.approvalStatus === filters.approvalStatus) &&
      (!filters.paymentState || row.paymentState === filters.paymentState)
  );
}

export function attendeePaymentState(
  line: { ticketType: { price: number }; bookingPlace: { paymentAllocations?: Array<{ ticketOrderId: string; allocatedAmountMinor: number; refundedAmountMinor: number }> } },
  ticketOrdersById: ReadonlyMap<string, { status: string }>
) {
  if (line.ticketType.price <= 0) return "FREE";
  const allocations = line.bookingPlace.paymentAllocations ?? [];
  if (allocations.some((allocation) => !ticketOrdersById.has(allocation.ticketOrderId))) return "UNKNOWN";

  const requiredMinor = Math.round(line.ticketType.price * 100);
  let settledMinor = 0;
  let pendingMinor = 0;
  let settledAllocatedMinor = 0;
  let settledRefundedMinor = 0;
  for (const allocation of allocations) {
    const status = ticketOrdersById.get(allocation.ticketOrderId)?.status;
    if (status === "PAID" || status === "REFUNDED") {
      settledAllocatedMinor += allocation.allocatedAmountMinor;
      settledRefundedMinor += allocation.refundedAmountMinor;
      settledMinor += Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor);
    } else if (status === "PENDING") {
      pendingMinor += Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor);
    }
  }
  if (settledMinor >= requiredMinor) return "PAID";
  const outstandingMinor = requiredMinor - settledMinor;
  if (pendingMinor >= outstandingMinor) return "PAYMENT_PENDING";
  if (settledMinor > 0) return "PARTIALLY_PAID";
  if (settledAllocatedMinor > 0 && settledRefundedMinor >= settledAllocatedMinor) return "REFUNDED";
  return "UNPAID";
}

