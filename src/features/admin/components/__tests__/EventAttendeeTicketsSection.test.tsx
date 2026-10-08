import { BookingApprovalStatus, MembershipStatus, TicketAudience } from "@dataconnect/generated";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "../../../../test-utils";
import type { EventAttendeeTicketRow } from "../../utils/bookingApprovalsAdmin";
import { EventAttendeeTicketsSection } from "../sectionEventsManagerSurfaces/TicketAdminSurface";

function attendeeRow(overrides: Partial<EventAttendeeTicketRow> = {}): EventAttendeeTicketRow {
  return {
    key: "alex",
    bookingId: "booking-1",
    attendeeName: "Alex Member",
    email: "alex@example.com",
    rank: "Wing Commander",
    membershipStatus: MembershipStatus.REGULAR,
    audience: TicketAudience.MEMBER,
    ticketType: "Full event",
    includesDinner: true,
    includesSymposium: true,
    accommodationRequested: false,
    seatingPreferences: [],
    dietaryNote: null,
    approvalStatus: BookingApprovalStatus.APPROVED,
    paymentState: "PAID",
    ...overrides,
  };
}

describe("current attendee ticket filters", () => {
  beforeEach(() => {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; max-age=0; path=/`;
    });
  });

  it("combines column filters and copies unique emails from only the visible rows", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const rows = [
      attendeeRow(),
      attendeeRow({ key: "alex-duplicate", email: "ALEX@example.com", ticketType: "Dinner only" }),
      attendeeRow({ key: "alex-second", email: "second@example.com", ticketType: "Dinner companion" }),
      attendeeRow({ key: "no-email", email: null, ticketType: "Dinner guest" }),
      attendeeRow({
        key: "jamie",
        attendeeName: "Jamie Guest",
        email: "jamie@example.com",
        rank: "Squadron Leader",
        membershipStatus: MembershipStatus.RESERVE,
        audience: TicketAudience.GUEST,
        ticketType: "Symposium only",
        includesDinner: false,
        paymentState: "UNPAID",
      }),
    ];
    render(<EventAttendeeTicketsSection eventTitle="Annual Dinner" loading={false} rows={rows} />);

    await user.type(screen.getByRole("textbox", { name: "Filter attendee" }), "alex");
    await user.click(screen.getByRole("combobox", { name: "Dinner" }));
    await user.click(screen.getByRole("option", { name: "Yes" }));

    expect(screen.getByText("Showing 4 of 5 attendees")).toBeInTheDocument();
    expect(screen.queryByText("Jamie Guest")).not.toBeInTheDocument();
    expect(screen.getByText("Dinner guest")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy email addresses (2)" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("alex@example.com, second@example.com"));
    expect(screen.getByText("2 unique email addresses copied.")).toBeInTheDocument();

    writeText.mockClear();
    await user.click(screen.getByRole("combobox", { name: "Email separator" }));
    await user.click(screen.getByRole("option", { name: "Semicolons (Outlook)" }));
    expect(document.cookie).toContain("sodc-attendee-email-separator=semicolon");
    expect(document.cookie).toContain("sodc-cookie-preferences=accepted");
    await user.click(screen.getByRole("button", { name: "Copy email addresses (2)" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("alex@example.com; second@example.com"));
    expect(screen.getByText("CSV includes all attendees")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export full CSV" })).toBeInTheDocument();
  });

  it("restores a saved separator and ignores an invalid cookie value", () => {
    document.cookie = "sodc-cookie-preferences=accepted; path=/";
    document.cookie = "sodc-attendee-email-separator=semicolon; path=/";
    const first = render(<EventAttendeeTicketsSection eventTitle="Dinner" loading={false} rows={[attendeeRow()]} />);
    expect(screen.getByRole("combobox", { name: "Email separator" })).toHaveTextContent("Semicolons (Outlook)");

    first.unmount();
    document.cookie = "sodc-attendee-email-separator=invalid; path=/";
    render(<EventAttendeeTicketsSection eventTitle="Dinner" loading={false} rows={[attendeeRow()]} />);
    expect(screen.getByRole("combobox", { name: "Email separator" })).toHaveTextContent("Commas");
  });

  it("shows a no-match state and clear filters restores every row", async () => {
    const user = userEvent.setup();
    render(<EventAttendeeTicketsSection
      eventTitle="Annual Dinner"
      loading={false}
      rows={[attendeeRow(), attendeeRow({ key: "jamie", attendeeName: "Jamie Guest" })]}
    />);

    await user.type(screen.getByRole("textbox", { name: "Filter attendee" }), "nobody");
    expect(screen.getByText("No attendees match the current filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy email addresses (0)" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Showing 2 of 2 attendees")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Alex Member")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Jamie Guest")).toBeInTheDocument();
  });
});
