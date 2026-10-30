import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { render, screen } from "../../../../test-utils";
import EventOverview from "../EventOverview";
import type { EventRow } from "../sectionEventsManagerTypes";

const event: EventRow = {
  id: "event-1", title: "Annual Dinner", location: "RAF Club",
  startDateTime: "2026-11-20T13:00:00Z", endDateTime: "2026-11-20T22:30:00Z",
  bookingStartDateTime: "2026-10-01T09:00:00Z", bookingEndDateTime: "2026-11-12T17:00:00Z",
  maxGuestsWithoutModeratorApproval: 1,
};

describe("event overview summaries", () => {
  it("shows supplied totals and direct links to their detailed tasks", () => {
    render(<MemoryRouter><EventOverview event={event} sectionId="section-1" activeTicketCount={126} pendingRevisionCount={3} outstandingAmountPence={128000} outstandingTicketCount={16} /></MemoryRouter>);
    expect(screen.getByText("126")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("£1,280.00")).toBeInTheDocument();
    expect(screen.getByText("16 tickets require payment")).toBeInTheDocument();
    expect(screen.getByText("3 booking revisions need review.")).toBeInTheDocument();
    expect(screen.getByText("£1,280.00 is outstanding across 16 tickets.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View tickets & attendees" })).toHaveAttribute("href", "/sections/section-1/manage/events/event-1?task=attendees");
    expect(screen.getByRole("link", { name: "Review approvals" })).toHaveAttribute("href", "/sections/section-1/manage/events/event-1?task=approvals");
    expect(screen.getByRole("link", { name: "Review payments" })).toHaveAttribute("href", "/sections/section-1/manage/events/event-1?task=payments");
    expect(screen.getByRole("link", { name: "Edit details" })).toHaveAttribute("href", "/sections/section-1/manage/events/event-1?task=details");
    expect(screen.getByText("RAF Club")).toBeInTheDocument();
  });

  it("does not turn unavailable data into zero or an all-clear message", () => {
    render(<MemoryRouter><EventOverview event={event} sectionId="section-1" /></MemoryRouter>);
    expect(screen.getAllByText("Not available")).toHaveLength(3);
    expect(screen.getByText("Approval summary is unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Payment summary is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("£0.00")).not.toBeInTheDocument();
    expect(screen.queryByText(/No pending revisions/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review approvals" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review payments" })).toBeInTheDocument();
  });

  it("distinguishes confirmed empty totals from unavailable summaries", () => {
    render(<MemoryRouter><EventOverview event={event} sectionId="section-1" activeTicketCount={0} pendingRevisionCount={0} outstandingAmountPence={0} outstandingTicketCount={0} /></MemoryRouter>);
    expect(screen.getByText("£0.00")).toBeInTheDocument();
    expect(screen.getByText("0 tickets require payment")).toBeInTheDocument();
    expect(screen.getByText("No pending revisions or outstanding payments in the current summaries.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review approvals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review payments" })).not.toBeInTheDocument();
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });
});
