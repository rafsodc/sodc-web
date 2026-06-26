import { GuestTicketRequestStatus } from "@dataconnect/admin-generated";
import { validateUUID } from "./helpers";

export type GuestTicketRequestCarryForwardSource = {
  status: GuestTicketRequestStatus | string;
  requestedGuestCount: number;
  guestDisplayName?: string | null;
  guestTicketType?: { id: string } | null;
  reviewedBy?: { id: string } | null;
  reviewedAt?: string | null;
  moderatorNote?: string | null;
};

export type GuestTicketRequestSubmissionDecision =
  | {
      kind: "carry_forward_approved";
      reviewedById: string | null;
      reviewedAt: string | null;
      moderatorNote: string | null;
    }
  | { kind: "carry_forward_pending" }
  | { kind: "create_pending" };

export function normalizeGuestDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function ticketTypeIdsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  try {
    return validateUUID(a, "guestTicketTypeId") === validateUUID(b, "guestTicketTypeId");
  } catch {
    return false;
  }
}

function guestTicketRequestCount(request: { requestedGuestCount?: number }): number {
  return Math.max(1, request.requestedGuestCount ?? 1);
}

function buildGuestTicketRequestPool(
  requests: GuestTicketRequestCarryForwardSource[] | null | undefined,
  status: GuestTicketRequestStatus
): GuestTicketRequestCarryForwardSource[] {
  const pool: GuestTicketRequestCarryForwardSource[] = [];
  for (const request of requests ?? []) {
    if (request.status !== status) {
      continue;
    }
    const count = guestTicketRequestCount(request);
    for (let index = 0; index < count; index++) {
      pool.push(request);
    }
  }
  return pool;
}

export function buildApprovedGuestTicketRequestPool(
  requests: GuestTicketRequestCarryForwardSource[] | null | undefined
): GuestTicketRequestCarryForwardSource[] {
  return buildGuestTicketRequestPool(requests, GuestTicketRequestStatus.APPROVED);
}

export function buildPendingGuestTicketRequestPool(
  requests: GuestTicketRequestCarryForwardSource[] | null | undefined
): GuestTicketRequestCarryForwardSource[] {
  return buildGuestTicketRequestPool(requests, GuestTicketRequestStatus.PENDING);
}

function takeMatchingPoolEntry(
  pool: GuestTicketRequestCarryForwardSource[],
  guestDisplayName: string,
  guestTicketTypeId: string
): { match: GuestTicketRequestCarryForwardSource | null; remainingPool: GuestTicketRequestCarryForwardSource[] } {
  const normalizedName = normalizeGuestDisplayName(guestDisplayName);
  const matchIndex = pool.findIndex(
    (entry) =>
      normalizeGuestDisplayName(entry.guestDisplayName ?? "") === normalizedName &&
      ticketTypeIdsEqual(entry.guestTicketType?.id, guestTicketTypeId)
  );

  if (matchIndex === -1) {
    return { match: null, remainingPool: pool };
  }

  const match = pool[matchIndex]!;
  return {
    match,
    remainingPool: [...pool.slice(0, matchIndex), ...pool.slice(matchIndex + 1)],
  };
}

export function consumeGuestRequestPoolsForExistingRequests(
  approvedPool: GuestTicketRequestCarryForwardSource[],
  pendingPool: GuestTicketRequestCarryForwardSource[],
  existingRequests: GuestTicketRequestCarryForwardSource[] | null | undefined
): {
  approvedPool: GuestTicketRequestCarryForwardSource[];
  pendingPool: GuestTicketRequestCarryForwardSource[];
} {
  let remainingApprovedPool = approvedPool;
  let remainingPendingPool = pendingPool;

  for (const existing of existingRequests ?? []) {
    const ticketTypeId = existing.guestTicketType?.id;
    if (!ticketTypeId || !existing.guestDisplayName) {
      continue;
    }
    const count = guestTicketRequestCount(existing);
    for (let index = 0; index < count; index++) {
      if (existing.status === GuestTicketRequestStatus.APPROVED) {
        const resolved = takeMatchingPoolEntry(remainingApprovedPool, existing.guestDisplayName, ticketTypeId);
        remainingApprovedPool = resolved.remainingPool;
      } else if (existing.status === GuestTicketRequestStatus.PENDING) {
        const resolved = takeMatchingPoolEntry(remainingPendingPool, existing.guestDisplayName, ticketTypeId);
        remainingPendingPool = resolved.remainingPool;
      }
    }
  }

  return { approvedPool: remainingApprovedPool, pendingPool: remainingPendingPool };
}

export function resolveGuestTicketRequestSubmission(args: {
  approvedPool: GuestTicketRequestCarryForwardSource[];
  pendingPool: GuestTicketRequestCarryForwardSource[];
  guestDisplayName: string;
  guestTicketTypeId: string;
}): {
  decision: GuestTicketRequestSubmissionDecision;
  remainingApprovedPool: GuestTicketRequestCarryForwardSource[];
  remainingPendingPool: GuestTicketRequestCarryForwardSource[];
} {
  const approvedMatch = takeMatchingPoolEntry(args.approvedPool, args.guestDisplayName, args.guestTicketTypeId);
  if (approvedMatch.match) {
    return {
      decision: {
        kind: "carry_forward_approved",
        reviewedById: approvedMatch.match.reviewedBy?.id ?? null,
        reviewedAt: approvedMatch.match.reviewedAt ?? null,
        moderatorNote: approvedMatch.match.moderatorNote ?? null,
      },
      remainingApprovedPool: approvedMatch.remainingPool,
      remainingPendingPool: args.pendingPool,
    };
  }

  const pendingMatch = takeMatchingPoolEntry(args.pendingPool, args.guestDisplayName, args.guestTicketTypeId);
  if (pendingMatch.match) {
    return {
      decision: { kind: "carry_forward_pending" },
      remainingApprovedPool: args.approvedPool,
      remainingPendingPool: pendingMatch.remainingPool,
    };
  }

  return {
    decision: { kind: "create_pending" },
    remainingApprovedPool: args.approvedPool,
    remainingPendingPool: args.pendingPool,
  };
}

/** @deprecated Use resolveGuestTicketRequestSubmission */
export function resolveGuestTicketRequestCarryForward(args: {
  approvedPool: GuestTicketRequestCarryForwardSource[];
  guestDisplayName: string;
  guestTicketTypeId: string;
}): {
  decision:
    | {
        carryForward: true;
        reviewedById: string | null;
        reviewedAt: string | null;
        moderatorNote: string | null;
      }
    | { carryForward: false };
  remainingPool: GuestTicketRequestCarryForwardSource[];
} {
  const resolved = resolveGuestTicketRequestSubmission({
    approvedPool: args.approvedPool,
    pendingPool: [],
    guestDisplayName: args.guestDisplayName,
    guestTicketTypeId: args.guestTicketTypeId,
  });
  if (resolved.decision.kind === "carry_forward_approved") {
    return {
      decision: {
        carryForward: true,
        reviewedById: resolved.decision.reviewedById,
        reviewedAt: resolved.decision.reviewedAt,
        moderatorNote: resolved.decision.moderatorNote,
      },
      remainingPool: resolved.remainingApprovedPool,
    };
  }
  return { decision: { carryForward: false }, remainingPool: args.approvedPool };
}

/** @deprecated Use consumeGuestRequestPoolsForExistingRequests */
export function consumeCarryForwardPoolForExistingRequests(
  pool: GuestTicketRequestCarryForwardSource[],
  existingRequests: GuestTicketRequestCarryForwardSource[] | null | undefined
): GuestTicketRequestCarryForwardSource[] {
  return consumeGuestRequestPoolsForExistingRequests(pool, [], existingRequests).approvedPool;
}
