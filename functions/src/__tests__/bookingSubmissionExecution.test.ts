import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingApprovalStatus,
  BookingPaymentAdjustmentStatus,
  TicketAudience,
} from "@dataconnect/admin-generated";

const mocks = vi.hoisted(() => ({ executeMutation: vi.fn() }));

vi.mock("firebase-admin/data-connect", () => ({
  getDataConnect: vi.fn(() => ({ executeMutation: mocks.executeMutation })),
}));

import {
  persistActiveBookingRevision,
  persistInitialBooking,
  persistPendingBookingRevision,
  type CompleteBookingPersistenceInput,
} from "../bookingSubmissionPersistence";

const input: CompleteBookingPersistenceInput = {
  bookingId: "10000000-0000-4000-8000-000000000001",
  eventId: "20000000-0000-4000-8000-000000000001",
  bookerId: "user-1",
  idempotencyKey: "30000000-0000-4000-8000-000000000001",
  revisionGroupId: "40000000-0000-4000-8000-000000000001",
  revisionNumber: 1,
  approvalStatus: BookingApprovalStatus.PENDING,
  sitNextToUserIds: ["user-2"],
  accommodationRequested: false,
  accommodationNote: null,
  placePlan: {
    newBookingPlaceIds: ["50000000-0000-4000-8000-000000000001"],
    removedBookingPlaceIds: [],
    paidRemovedBookingPlaceIds: [],
    lines: [
      {
        id: "60000000-0000-4000-8000-000000000001",
        bookingPlaceId: "50000000-0000-4000-8000-000000000001",
        ticketTypeId: "70000000-0000-4000-8000-000000000001",
        audience: TicketAudience.MEMBER,
        sortOrder: 0,
        dietaryNote: "Vegetarian",
      },
    ],
  },
};

describe("atomic booking submission execution", () => {
  beforeEach(() => mocks.executeMutation.mockReset().mockResolvedValue({ data: {} }));

  it("sends the booking, stable places, and lines through one named mutation", async () => {
    await persistInitialBooking(input);

    expect(mocks.executeMutation).toHaveBeenCalledOnce();
    expect(mocks.executeMutation).toHaveBeenCalledWith(
      "CreateCompleteBookingFromCallable",
      expect.objectContaining({
        booking: expect.objectContaining({
          id: input.bookingId,
          approvalStatus: BookingApprovalStatus.PENDING,
          status: "SUBMITTED",
        }),
        bookingPlaces: [expect.objectContaining({ id: input.placePlan.newBookingPlaceIds[0] })],
        bookingLines: [
          expect.objectContaining({
            bookingId: input.bookingId,
            bookingPlaceId: input.placePlan.newBookingPlaceIds[0],
            dietaryNote: "Vegetarian",
          }),
        ],
      }),
    );
  });

  it("keeps a pending revision on its dedicated non-activating operation", async () => {
    await persistPendingBookingRevision({
      ...input,
      revisionNumber: 2,
      supersedesBookingId: "80000000-0000-4000-8000-000000000001",
    });
    expect(mocks.executeMutation).toHaveBeenCalledWith(
      "CreatePendingBookingRevisionFromCallable",
      expect.objectContaining({
        supersedesBookingId: "80000000-0000-4000-8000-000000000001",
      }),
    );
  });

  it("activates a revision and records its adjustment in the same named operation", async () => {
    await persistActiveBookingRevision({
      input: {
        ...input,
        revisionNumber: 2,
        approvalStatus: BookingApprovalStatus.NOT_REQUIRED,
        supersedesBookingId: "80000000-0000-4000-8000-000000000001",
      },
      activeBookingId: "80000000-0000-4000-8000-000000000001",
      deltaAmountMinor: 2500,
      adjustmentStatus: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
    });
    expect(mocks.executeMutation).toHaveBeenCalledWith(
      "CreateActiveBookingRevisionFromCallable",
      expect.objectContaining({
        deltaAmountMinor: 2500,
        adjustmentStatus: BookingPaymentAdjustmentStatus.PENDING_AUTO_CHARGE,
      }),
    );
  });
});
