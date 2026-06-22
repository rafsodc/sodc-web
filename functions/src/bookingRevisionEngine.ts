import { BookingStatus } from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { HttpsError } from "firebase-functions/v2/https";
import { bookingIdsEqual } from "./bookingCheckout";

interface BookingSnapshot {
  id: UUIDString;
  status: BookingStatus;
  revisionGroupId: UUIDString;
  revisionNumber: number;
  clientSubmissionKey?: string | null;
}

interface RevisionRequest {
  idempotencyKey: UUIDString;
  baseBookingId?: UUIDString;
  baseRevisionNumber?: number;
}

export interface RevisionPlan {
  revisionGroupId: UUIDString;
  revisionNumber: number;
  supersedesBookingId: UUIDString | null;
}

const TERMINAL_STATUSES = new Set<BookingStatus>([BookingStatus.SUBMITTED, BookingStatus.CONFIRMED]);

export function computeRevisionPlan(bookings: BookingSnapshot[], request: RevisionRequest): RevisionPlan {
  const terminalBookings = bookings.filter((booking) => TERMINAL_STATUSES.has(booking.status));
  const replay = terminalBookings.find((booking) => booking.clientSubmissionKey === request.idempotencyKey);
  if (replay) {
    return {
      revisionGroupId: replay.revisionGroupId,
      revisionNumber: replay.revisionNumber,
      supersedesBookingId: replay.id,
    };
  }

  if (terminalBookings.length === 0) {
    return {
      revisionGroupId: request.idempotencyKey,
      revisionNumber: 1,
      supersedesBookingId: null,
    };
  }

  if (!request.baseBookingId || !Number.isInteger(request.baseRevisionNumber)) {
    throw new HttpsError(
      "failed-precondition",
      "Booking revision update requires baseBookingId and baseRevisionNumber",
      { code: "BOOKING_REVISION_BASE_REQUIRED" }
    );
  }

  const base = terminalBookings.find((booking) => bookingIdsEqual(booking.id, request.baseBookingId!));
  if (!base) {
    throw new HttpsError("failed-precondition", "Base booking revision not found", {
      code: "BOOKING_REVISION_BASE_NOT_FOUND",
    });
  }
  if (base.revisionNumber !== request.baseRevisionNumber) {
    throw new HttpsError("aborted", "Booking revision conflict: base revision changed", {
      code: "BOOKING_REVISION_CONFLICT",
    });
  }

  const latestInGroup = terminalBookings
    .filter((booking) => booking.revisionGroupId === base.revisionGroupId)
    .reduce((acc, booking) => (booking.revisionNumber > acc.revisionNumber ? booking : acc), base);

  if (latestInGroup.id !== base.id && !bookingIdsEqual(latestInGroup.id, base.id)) {
    throw new HttpsError("aborted", "Booking revision conflict: a newer revision already exists", {
      code: "BOOKING_REVISION_CONFLICT",
    });
  }

  return {
    revisionGroupId: base.revisionGroupId,
    revisionNumber: base.revisionNumber + 1,
    supersedesBookingId: base.id,
  };
}
