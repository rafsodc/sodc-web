import { describe, expect, it } from "vitest";
import { BookingStatus } from "@dataconnect/admin-generated";
import { HttpsError } from "firebase-functions/v2/https";
import { computeRevisionPlan } from "../bookingRevisionEngine";

describe("bookingRevisionEngine", () => {
  it("creates revision 1 for first booking submission", () => {
    const plan = computeRevisionPlan([], {
      idempotencyKey: "00000000-0000-0000-0000-000000000001",
    });
    expect(plan).toEqual({
      revisionGroupId: "00000000-0000-0000-0000-000000000001",
      revisionNumber: 1,
      supersedesBookingId: null,
    });
  });

  it("requires base metadata when terminal booking already exists", () => {
    expect(() =>
      computeRevisionPlan(
        [
          {
            id: "10000000-0000-0000-0000-000000000001",
            status: BookingStatus.SUBMITTED,
            revisionGroupId: "20000000-0000-0000-0000-000000000001",
            revisionNumber: 1,
            clientSubmissionKey: "30000000-0000-0000-0000-000000000001",
          },
        ],
        { idempotencyKey: "40000000-0000-0000-0000-000000000001" }
      )
    ).toThrow(HttpsError);
  });

  it("computes deterministic next revision when base matches latest", () => {
    const plan = computeRevisionPlan(
      [
        {
          id: "10000000-0000-0000-0000-000000000001",
          status: BookingStatus.SUBMITTED,
          revisionGroupId: "20000000-0000-0000-0000-000000000001",
          revisionNumber: 1,
          clientSubmissionKey: "30000000-0000-0000-0000-000000000001",
        },
      ],
      {
        idempotencyKey: "40000000-0000-0000-0000-000000000001",
        baseBookingId: "10000000-0000-0000-0000-000000000001",
        baseRevisionNumber: 1,
      }
    );

    expect(plan).toEqual({
      revisionGroupId: "20000000-0000-0000-0000-000000000001",
      revisionNumber: 2,
      supersedesBookingId: "10000000-0000-0000-0000-000000000001",
    });
  });

  it("rejects stale base revision in race condition", () => {
    expect(() =>
      computeRevisionPlan(
        [
          {
            id: "10000000-0000-0000-0000-000000000001",
            status: BookingStatus.SUBMITTED,
            revisionGroupId: "20000000-0000-0000-0000-000000000001",
            revisionNumber: 1,
            clientSubmissionKey: "30000000-0000-0000-0000-000000000001",
          },
          {
            id: "10000000-0000-0000-0000-000000000002",
            status: BookingStatus.SUBMITTED,
            revisionGroupId: "20000000-0000-0000-0000-000000000001",
            revisionNumber: 2,
            clientSubmissionKey: "30000000-0000-0000-0000-000000000002",
          },
        ],
        {
          idempotencyKey: "40000000-0000-0000-0000-000000000001",
          baseBookingId: "10000000-0000-0000-0000-000000000001",
          baseRevisionNumber: 1,
        }
      )
    ).toThrow(HttpsError);
  });
});
