import { describe, expect, it } from "vitest";
import {
  BookingPaymentAdjustmentStatus,
  BookingStatus,
  MembershipStatus,
  SectionType,
  TicketAudience,
  TicketOrderStatus,
} from "@dataconnect/generated";
import { getMembershipStatusLabel } from "../membershipStatusLabels";
import {
  getBookingPaymentAdjustmentStatusLabel,
  getBookingStatusLabel,
  getTicketOrderStatusLabel,
} from "../paymentStatusLabels";
import { getSectionTypeLabel, isMembersSectionType } from "../sectionTypeLabels";
import { getTicketCategoryLabel } from "../ticketAudienceLabels";

describe("member display labels", () => {
  it("maps membership statuses to readable labels", () => {
    expect(getMembershipStatusLabel(MembershipStatus.REGULAR)).toBe("Regular");
    expect(getMembershipStatusLabel(MembershipStatus.CIVIL_SERVICE)).toBe("Civil Service");
    expect(getMembershipStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("maps section types to readable labels", () => {
    expect(getSectionTypeLabel(SectionType.MEMBERS)).toBe("Members");
    expect(getSectionTypeLabel(SectionType.EVENTS)).toBe("Events");
    expect(isMembersSectionType(SectionType.MEMBERS)).toBe(true);
  });

  it("maps ticket audience categories", () => {
    expect(getTicketCategoryLabel(TicketAudience.MEMBER)).toBe("Member ticket");
  });

  it("maps payment and booking statuses", () => {
    expect(getTicketOrderStatusLabel(TicketOrderStatus.PAID)).toBe("Paid");
    expect(getTicketOrderStatusLabel(TicketOrderStatus.FAILED)).toBe("Payment failed");
    expect(getBookingPaymentAdjustmentStatusLabel(BookingPaymentAdjustmentStatus.PENDING_AUTO_REFUND)).toBe(
      "Refund pending"
    );
    expect(getBookingStatusLabel(BookingStatus.CONFIRMED)).toBe("Confirmed");
  });
});
