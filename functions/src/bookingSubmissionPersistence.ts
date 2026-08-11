import { randomUUID } from "node:crypto";
import {
  BookingApprovalStatus,
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { getBookingServiceDataConnect } from "./bookingServiceDataConnect";

export const MAX_ATOMIC_BOOKING_LINES = 100;

export interface SubmissionLine {
  ticketTypeId: UUIDString;
  audience: TicketAudience;
  sortOrder: number;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
}

export interface ExistingSubmissionLine extends SubmissionLine {
  bookingPlaceId?: UUIDString | null;
  paymentAllocationStatuses?: TicketOrderStatus[];
}

export interface PlannedSubmissionLine extends SubmissionLine {
  id: UUIDString;
  bookingPlaceId: UUIDString;
}

export interface BookingPlacePlan {
  lines: PlannedSubmissionLine[];
  newBookingPlaceIds: UUIDString[];
  removedBookingPlaceIds: UUIDString[];
  paidRemovedBookingPlaceIds: UUIDString[];
}

function uuidKey(value: string): string {
  return value.trim().replace(/-/g, "").toLowerCase();
}

function normalizedName(value?: string | null): string {
  return value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB") ?? "";
}

function placeIdentityKey(line: SubmissionLine): string {
  const ticket = uuidKey(line.ticketTypeId);
  if (line.audience === TicketAudience.MEMBER) return `member|ticket:${ticket}`;
  return `guest|user:${line.guestUserId?.trim() ?? ""}|name:${normalizedName(line.guestDisplayName)}|ticket:${ticket}`;
}

/**
 * Reuses stable places only for unchanged attendee/ticket identities. A name,
 * linked-user, audience, or ticket-type change is a place replacement; this
 * prevents a paid entitlement being silently transferred to another guest.
 */
export function planBookingPlaces(args: {
  lines: SubmissionLine[];
  previousLines?: ExistingSubmissionLine[];
  createId?: () => UUIDString;
}): BookingPlacePlan {
  const createId = args.createId ?? (() => randomUUID() as UUIDString);
  const queues = new Map<string, ExistingSubmissionLine[]>();
  for (const previous of args.previousLines ?? []) {
    if (!previous.bookingPlaceId) continue;
    const key = placeIdentityKey(previous);
    const queue = queues.get(key) ?? [];
    queue.push(previous);
    queues.set(key, queue);
  }

  const reusedPlaceIds = new Set<string>();
  const newBookingPlaceIds: UUIDString[] = [];
  const lines = [...args.lines]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((line): PlannedSubmissionLine => {
      const matched = queues.get(placeIdentityKey(line))?.shift();
      const bookingPlaceId = matched?.bookingPlaceId ?? createId();
      if (matched?.bookingPlaceId) reusedPlaceIds.add(uuidKey(matched.bookingPlaceId));
      else newBookingPlaceIds.push(bookingPlaceId);
      return { ...line, id: createId(), bookingPlaceId };
    });

  const removed = (args.previousLines ?? []).filter(
    (line) => line.bookingPlaceId && !reusedPlaceIds.has(uuidKey(line.bookingPlaceId))
  );
  return {
    lines,
    newBookingPlaceIds,
    removedBookingPlaceIds: removed.map((line) => line.bookingPlaceId!),
    paidRemovedBookingPlaceIds: removed
      .filter((line) => line.paymentAllocationStatuses?.includes(TicketOrderStatus.PAID))
      .map((line) => line.bookingPlaceId!),
  };
}

interface BookingData {
  id: UUIDString;
  eventId: UUIDString;
  bookerId: string;
  clientSubmissionKey: string;
  revisionGroupId: UUIDString;
  revisionNumber: number;
  supersedesBookingId?: UUIDString | null;
  status: BookingStatus;
  approvalStatus: BookingApprovalStatus;
  sitNextToUserIds: string[];
  accommodationRequested: boolean;
  accommodationNote?: string | null;
  createdBy: string;
  updatedBy: string;
}

interface BookingPlaceData {
  id: UUIDString;
  eventId: UUIDString;
  bookerId: string;
  createdBy: string;
  updatedBy: string;
}

interface BookingLineData {
  id: UUIDString;
  bookingPlaceId: UUIDString;
  bookingId: UUIDString;
  ticketTypeId: UUIDString;
  guestUserId?: string | null;
  guestDisplayName?: string | null;
  dietaryNote?: string | null;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
}

interface CompleteBookingVariables {
  booking: BookingData;
  bookingPlaces: BookingPlaceData[];
  bookingLines: BookingLineData[];
}

export interface CompleteBookingPersistenceInput {
  bookingId: UUIDString;
  eventId: UUIDString;
  bookerId: string;
  idempotencyKey: UUIDString;
  revisionGroupId: UUIDString;
  revisionNumber: number;
  supersedesBookingId?: UUIDString | null;
  approvalStatus: BookingApprovalStatus;
  sitNextToUserIds: string[];
  accommodationRequested: boolean;
  accommodationNote?: string | null;
  placePlan: BookingPlacePlan;
}

function completeVariables(input: CompleteBookingPersistenceInput): CompleteBookingVariables {
  return {
    booking: {
      id: input.bookingId,
      eventId: input.eventId,
      bookerId: input.bookerId,
      clientSubmissionKey: input.idempotencyKey,
      revisionGroupId: input.revisionGroupId,
      revisionNumber: input.revisionNumber,
      supersedesBookingId: input.supersedesBookingId ?? null,
      status: BookingStatus.SUBMITTED,
      approvalStatus: input.approvalStatus,
      sitNextToUserIds: input.sitNextToUserIds,
      accommodationRequested: input.accommodationRequested,
      accommodationNote: input.accommodationRequested ? input.accommodationNote ?? null : null,
      createdBy: "system",
      updatedBy: "system",
    },
    bookingPlaces: input.placePlan.newBookingPlaceIds.map((id) => ({
      id,
      eventId: input.eventId,
      bookerId: input.bookerId,
      createdBy: "system",
      updatedBy: "system",
    })),
    bookingLines: input.placePlan.lines.map((line) => ({
      id: line.id,
      bookingPlaceId: line.bookingPlaceId,
      bookingId: input.bookingId,
      ticketTypeId: line.ticketTypeId,
      guestUserId: line.guestUserId?.trim() || null,
      guestDisplayName: line.guestDisplayName?.trim() || null,
      dietaryNote: line.dietaryNote?.trim() || null,
      sortOrder: line.sortOrder,
      createdBy: "system",
      updatedBy: "system",
    })),
  };
}

export async function persistInitialBooking(input: CompleteBookingPersistenceInput): Promise<void> {
  await getBookingServiceDataConnect().executeMutation<unknown, CompleteBookingVariables>(
    "CreateCompleteBookingFromCallable",
    completeVariables(input)
  );
}

export async function persistPendingBookingRevision(input: CompleteBookingPersistenceInput): Promise<void> {
  if (!input.supersedesBookingId) throw new Error("Pending revision requires supersedesBookingId");
  await getBookingServiceDataConnect().executeMutation<unknown, CompleteBookingVariables & { supersedesBookingId: UUIDString }>(
    "CreatePendingBookingRevisionFromCallable",
    { ...completeVariables(input), supersedesBookingId: input.supersedesBookingId }
  );
}

export async function persistActiveBookingRevision(args: {
  input: CompleteBookingPersistenceInput;
  activeBookingId: UUIDString;
  deltaAmountMinor: number;
  adjustmentStatus: BookingPaymentAdjustmentStatus;
}): Promise<void> {
  await getBookingServiceDataConnect().executeMutation<unknown, CompleteBookingVariables & {
    revisionGroupId: UUIDString;
    bookingId: UUIDString;
    supersededBookingId: UUIDString;
    deltaAmountMinor: number;
    adjustmentStatus: BookingPaymentAdjustmentStatus;
    orchestrationKey: string;
  }>("CreateActiveBookingRevisionFromCallable", {
    ...completeVariables(args.input),
    revisionGroupId: args.input.revisionGroupId,
    bookingId: args.input.bookingId,
    supersededBookingId: args.activeBookingId,
    deltaAmountMinor: args.deltaAmountMinor,
    adjustmentStatus: args.adjustmentStatus,
    orchestrationKey: `${args.input.bookingId}:${args.input.idempotencyKey}`,
  });
}

export async function activateApprovedBookingRevision(args: {
  bookingId: UUIDString;
  revisionGroupId: UUIDString;
  activeBookingId: UUIDString;
  reviewedById: string;
  approvalNote?: string | null;
  deltaAmountMinor: number;
  adjustmentStatus: BookingPaymentAdjustmentStatus;
}): Promise<void> {
  await getBookingServiceDataConnect().executeMutation<unknown, {
    bookingId: UUIDString;
    revisionGroupId: UUIDString;
    activeBookingId: UUIDString;
    reviewedById: string;
    approvalNote?: string | null;
    deltaAmountMinor: number;
    adjustmentStatus: BookingPaymentAdjustmentStatus;
    orchestrationKey: string;
  }>("ActivateApprovedBookingRevisionFromCallable", {
    ...args,
    approvalNote: args.approvalNote?.trim() || null,
    orchestrationKey: `booking-approval:${args.bookingId}`,
  });
}
