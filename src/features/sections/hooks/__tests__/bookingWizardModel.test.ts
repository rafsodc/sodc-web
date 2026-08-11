import { describe, expect, it } from "vitest";
import {
  BOOKING_STEPS,
  buildBookingSubmissionLines,
  guestDetailsValidationError,
  resizeGuestDetails,
} from "../bookingWizardModel";

describe("bookingWizardModel", () => {
  it("uses the simplified three-stage journey", () => {
    expect(BOOKING_STEPS).toEqual(["Your details", "Guests", "Review and submit"]);
  });

  it("resizes guest rows without mutating existing values", () => {
    const previous = [{
      ticketTypeId: "guest-ticket",
      guestDisplayName: "Guest one",
      dietaryNote: "None",
      paid: false,
    }];
    const resized = resizeGuestDetails(previous, 2, "guest-ticket");

    expect(resized).toEqual([
      previous[0],
      { ticketTypeId: "guest-ticket", guestDisplayName: "", dietaryNote: "", paid: false },
    ]);
    expect(previous).toHaveLength(1);
  });

  it("identifies the first incomplete guest", () => {
    expect(guestDetailsValidationError({
      hasGuestTicketTypes: true,
      guests: [
        { ticketTypeId: "guest-ticket", guestDisplayName: "Guest one", dietaryNote: "", paid: false },
        { ticketTypeId: "guest-ticket", guestDisplayName: "", dietaryNote: "", paid: false },
      ],
    })).toBe("Enter a name for guest 2.");
  });

  it("builds normalized member and guest lines with dietary notes on each ticket", () => {
    expect(buildBookingSubmissionLines({
      memberTicketTypeId: "member-ticket",
      memberDietaryNote: "  Vegetarian  ",
      guests: [
        {
          ticketTypeId: "guest-ticket",
          guestDisplayName: "  Guest Name  ",
          dietaryNote: "  Vegan  ",
          paid: false,
        },
      ],
    })).toEqual([
      {
        ticketTypeId: "member-ticket",
        sortOrder: 0,
        guestUserId: null,
        guestDisplayName: null,
        dietaryNote: "Vegetarian",
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
});
