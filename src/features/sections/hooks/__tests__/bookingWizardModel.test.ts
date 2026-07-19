import { describe, expect, it } from "vitest";
import {
  buildBookingSubmissionLines,
  EMPTY_GUEST_DETAIL,
  extractCallableErrorCode,
  guestCountValidationError,
  guestDetailsValidationError,
  resizeExtraGuestDetails,
} from "../bookingWizardModel";

describe("bookingWizardModel", () => {
  it("resizes additional guest rows without mutating existing values", () => {
    const previous = [{ guestDisplayName: "Guest one", dietaryNote: "None" }];
    const expanded = resizeExtraGuestDetails(previous, 2, "full");
    expect(expanded).toEqual([previous[0], EMPTY_GUEST_DETAIL]);
    expect(expanded).not.toBe(previous);
    expect(resizeExtraGuestDetails(expanded, 1, "additionalGuests")).toEqual([previous[0]]);
  });

  it("validates guest counts for both wizard modes", () => {
    expect(
      guestCountValidationError({
        mode: "additionalGuests",
        extraGuestRequestCount: 0,
        totalGuestCount: 0,
        hasGuestTicketTypes: true,
      })
    ).toBe("Enter how many extra guest tickets you need.");
    expect(
      guestCountValidationError({
        mode: "full",
        extraGuestRequestCount: 0,
        totalGuestCount: 1,
        hasGuestTicketTypes: false,
      })
    ).toBe("Guest tickets are not available for this event.");
  });

  it("identifies the first incomplete guest detail", () => {
    expect(
      guestDetailsValidationError({
        mode: "full",
        includeGuest: false,
        guestTicketTypeId: null,
        guestDisplayName: "",
        extraGuestRequestCount: 2,
        extraGuestTicketTypeId: "guest-ticket",
        extraGuestDetails: [
          { guestDisplayName: "Guest one", dietaryNote: "" },
          { guestDisplayName: "", dietaryNote: "" },
        ],
      })
    ).toBe("Enter a name for additional guest 2.");
  });

  it("builds normalized member and guest submission lines", () => {
    expect(
      buildBookingSubmissionLines({
        memberTicketTypeId: "member-ticket",
        includeGuest: true,
        guestTicketTypeId: "guest-ticket",
        guestDisplayName: "  Guest Name  ",
        guestDietaryNote: "  Vegan  ",
      })
    ).toEqual([
      {
        ticketTypeId: "member-ticket",
        sortOrder: 0,
        guestUserId: null,
        guestDisplayName: null,
        dietaryNote: null,
      },
      {
        ticketTypeId: "guest-ticket",
        sortOrder: 1,
        guestUserId: null,
        guestDisplayName: "Guest Name",
        dietaryNote: "Vegan",
      },
    ]);
  });

  it("reads callable error codes from either supported Firebase shape", () => {
    expect(extractCallableErrorCode({ details: { code: "DETAILS" } })).toBe("DETAILS");
    expect(extractCallableErrorCode({ customData: { code: "CUSTOM" } })).toBe("CUSTOM");
    expect(extractCallableErrorCode(new Error("none"))).toBeUndefined();
  });
});
