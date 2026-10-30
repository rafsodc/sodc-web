import { describe, expect, it } from "vitest";
import { emptyEventAttendeeTicketFilters } from "../bookingApprovalsAdmin";
import {
  eventAnnouncementPath,
  readEventAnnouncementFilters,
} from "../eventAnnouncementNavigation";
describe("announcement audience URLs", () => {
  it("retains the same selected audience after copying/reloading the task", () => {
    const filters = {
      ...emptyEventAttendeeTicketFilters,
      audience: "MEMBER",
      paymentState: "PAID",
      attendeeName: "Alex & Jo",
    };
    const link = eventAnnouncementPath("section", "event", filters);
    expect(link).toContain(
      "/sections/section/manage/events/event?task=announcement",
    );
    expect(
      readEventAnnouncementFilters(
        new URL(link, "https://local.invalid").search,
      ),
    ).toEqual(filters);
  });
  it("ignores unknown keys and bounds display filters", () => {
    const result = readEventAnnouncementFilters(
      `?audience.attendeeName=${"x".repeat(300)}&audience.__proto__=yes&admin=true`,
    );
    expect(result.attendeeName).toHaveLength(200);
    expect(Object.keys(result)).toEqual(
      Object.keys(emptyEventAttendeeTicketFilters),
    );
  });
});
