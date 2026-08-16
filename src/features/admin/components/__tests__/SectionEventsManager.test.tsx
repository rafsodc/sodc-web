import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import SectionEventsManager from "../SectionEventsManager";
import * as reactGenerated from "@dataconnect/generated/react";
import * as generated from "@dataconnect/generated";
import * as firebaseDataConnect from "firebase/data-connect";
import userEvent from "@testing-library/user-event";
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from "../../../../test-utils/dataConnectMocks";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("@dataconnect/generated/react", () => ({
  useGetEventsForSection: vi.fn(),
  useGetEventById: vi.fn(),
  useListBookingPaymentAdjustmentsForAdmin: vi.fn(),
  useListEventBookingsForAdmin: vi.fn(),
  useListUserNamesByIds: vi.fn(),
  useListTicketOrdersForAdmin: vi.fn(),
}));

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn().mockResolvedValue({ data: null }),
  executeMutation: vi.fn().mockResolvedValue({}),
  validateArgs: vi.fn((_config: unknown, dcOrVars: unknown, vars: unknown) => {
    if (vars !== undefined) return { dc: dcOrVars, vars };
    return { dc: {}, vars: dcOrVars };
  }),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reviewBookingRevision: vi.fn().mockResolvedValue({ success: true }),
}));

function mockGetEventsForSection(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetEventsForSection>(overrides)
  );
}

function mockGetEventById(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useGetEventById).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useGetEventById>(overrides)
  );
}

function mockEventBookings(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListEventBookingsForAdmin).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListEventBookingsForAdmin>(overrides)
  );
}

function mockUserNames(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListUserNamesByIds).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListUserNamesByIds>(overrides)
  );
}

function mockBookingPaymentAdjustments(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListBookingPaymentAdjustmentsForAdmin).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListBookingPaymentAdjustmentsForAdmin>(overrides)
  );
}

function mockTicketOrders(overrides: DataConnectQueryResultOverrides) {
  vi.mocked(reactGenerated.useListTicketOrdersForAdmin).mockReturnValue(
    dataConnectQueryResult<typeof reactGenerated.useListTicketOrdersForAdmin>(overrides)
  );
}

vi.mock("@dataconnect/generated", async () => {
  const actual = await vi.importActual("@dataconnect/generated");
  return {
    ...actual,
    createEventRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    updateEventRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    createTicketTypeRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    updateTicketTypeRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
  };
});

describe("SectionEventsManager", () => {
  const sectionId = "section-1";
  const sectionName = "Events Section";
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseFunctions.reviewBookingRevision).mockResolvedValue({
      success: true,
      bookingId: "b-1",
      revisionNumber: 2,
      approvalStatus: "APPROVED",
      paymentDelta: null,
    });
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mockEventBookings({
      data: { event: { id: "ev-1", bookings: [] } },
      isLoading: false,
      isError: false,
    });
    mockUserNames({ data: { users: [] }, isLoading: false, isError: false });
    mockTicketOrders({
      data: { event: { id: "ev-1", ticketOrders: [] } },
      isLoading: false,
      isError: false,
    });
    mockBookingPaymentAdjustments({
      data: { event: { id: "ev-1", bookings: [] } },
      isLoading: false,
      isError: false,
    });
  });

  it("renders events list with section name", async () => {
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Events: Events Section/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
  });

  it("shows events table when section has events", async () => {
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Annual Dinner")).toBeInTheDocument();
    });
    expect(screen.getByText("Main Hall")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /event admin/i })).toBeInTheDocument();
  });

  it("renders error message when events query fails", async () => {
    mockGetEventsForSection({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
    });
  });

  it("creates an event with sponsors and Markdown details and previews the details", async () => {
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: /add event/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Sponsored dinner" } });
    fireEvent.change(screen.getByLabelText(/^sponsors$/i), { target: { value: "Example Ltd" } });
    fireEvent.change(screen.getByLabelText(/^event details$/i), {
      target: { value: "# Welcome\n\nPlease read **carefully**." },
    });

    expect(screen.getByRole("heading", { name: "Welcome", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("carefully").tagName).toBe("STRONG");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(generated.createEventRef).toHaveBeenCalled());
    expect(generated.createEventRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "Sponsored dinner",
        sponsors: "Example Ltd",
        details: "# Welcome\n\nPlease read **carefully**.",
      })
    );
    expect(firebaseDataConnect.executeMutation).toHaveBeenCalled();
  });

  it("uses the safe Markdown renderer for the admin preview", async () => {
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: /add event/i }));
    fireEvent.change(screen.getByLabelText(/^event details$/i), {
      target: {
        value: '<script>alert("preview unsafe")</script>\n\n[Unsafe preview](javascript:alert(1))',
      },
    });

    expect(screen.queryByText('alert("preview unsafe")')).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe preview" })).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe preview")).toBeInTheDocument();
  });

  it("renders a complete pending booking and approves its exact revision", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [{ id: "ev-1", title: "Annual Dinner", startDateTime: "2025-03-01T18:00:00Z", endDateTime: "2025-03-01T22:00:00Z", bookingStartDateTime: "2025-02-01T00:00:00Z", bookingEndDateTime: "2025-02-28T23:59:59Z", location: "Main Hall", guestOfHonour: "Jane Doe", maxGuestsWithoutModeratorApproval: 1 }] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: { event: { id: "ev-1", title: "Annual Dinner", startDateTime: "2025-03-01T18:00:00Z", endDateTime: "2025-03-01T22:00:00Z", bookingStartDateTime: "2025-02-01T00:00:00Z", bookingEndDateTime: "2025-02-28T23:59:59Z", location: "Main Hall", guestOfHonour: "Jane Doe", maxGuestsWithoutModeratorApproval: 1, ticketTypes: [] } },
      isLoading: false,
      isError: false,
    });
    mockEventBookings({
      data: {
        event: {
          id: "ev-1",
          bookings: [
            {
              id: "b-0", status: "SUBMITTED", approvalStatus: "APPROVED", revisionGroupId: "10000000-0000-4000-8000-000000000001", revisionNumber: 1, supersededAt: null,
              lines: [], createdAt: "2026-01-31T00:00:00Z", updatedAt: "2026-01-31T01:00:00Z", createdBy: "u-1", updatedBy: "u-1",
              booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" },
            },
            {
              id: "b-1", status: "SUBMITTED", approvalStatus: "PENDING", revisionGroupId: "10000000-0000-4000-8000-000000000001", revisionNumber: 2, supersededAt: null,
              supersedesBooking: { id: "b-0", revisionNumber: 1 }, createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T01:00:00Z", createdBy: "u-1", updatedBy: "u-1",
              booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" },
              lines: [
                { id: "line-member", sortOrder: 0, guestDisplayName: null, dietaryNote: "Vegetarian", bookingPlace: { id: "place-member", paymentAllocations: [] }, ticketType: { id: "tt-member", title: "Member ticket", audience: "MEMBER", price: 25 } },
                { id: "line-guest", sortOrder: 1, guestDisplayName: "Jamie Guest", dietaryNote: "No nuts", bookingPlace: { id: "place-guest", paymentAllocations: [] }, ticketType: { id: "tt-1", title: "Guest standard", audience: "GUEST", price: 10 } },
              ],
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^booking approvals$/i }));

    expect(screen.getByText("Jamie Guest")).toBeInTheDocument();
    expect(screen.getByText(/dietary: no nuts/i)).toBeInTheDocument();
    expect(screen.getAllByText(/rev 1/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() => expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalled());
    expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: "b-1",
      expectedRevisionNumber: 2,
      decision: "APPROVED",
    }));
    expect(await screen.findByText("Booking revision approved")).toBeInTheDocument();
  }, 10_000);

  it("shows event attendance details with named seating preferences and no revision", async () => {
    const user = userEvent.setup();
    const event = {
      id: "ev-1",
      title: "Annual Dinner",
      startDateTime: "2025-03-01T18:00:00Z",
      endDateTime: "2025-03-01T22:00:00Z",
      bookingStartDateTime: "2025-02-01T00:00:00Z",
      bookingEndDateTime: "2025-02-28T23:59:59Z",
      maxGuestsWithoutModeratorApproval: 1,
    };
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [event] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: { event: { ...event, ticketTypes: [] } },
      isLoading: false,
      isError: false,
    });
    mockEventBookings({
      data: {
        event: {
          id: "ev-1",
          bookingTicketOrders: [],
          bookings: [{
            id: "b-1",
            status: "SUBMITTED",
            approvalStatus: "APPROVED",
            revisionGroupId: "10000000-0000-4000-8000-000000000001",
            revisionNumber: 3,
            supersededAt: null,
            sitNextToUserIds: ["u-2"],
            accommodationRequested: true,
            accommodationNote: null,
            createdAt: "2026-02-01T00:00:00Z",
            updatedAt: "2026-02-01T01:00:00Z",
            createdBy: "u-1",
            updatedBy: "u-1",
            booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" },
            lines: [{
              id: "line-member",
              sortOrder: 0,
              guestDisplayName: null,
              dietaryNote: "Vegetarian",
              bookingPlace: { id: "place-member", paymentAllocations: [] },
              ticketType: {
                id: "tt-member",
                title: "Full event",
                audience: "MEMBER",
                price: 0,
                includesDinner: true,
                includesSymposium: true,
              },
            }],
          }, {
            id: "b-rejected",
            status: "SUBMITTED",
            approvalStatus: "REJECTED",
            revisionGroupId: "10000000-0000-4000-8000-000000000002",
            revisionNumber: 1,
            supersededAt: null,
            sitNextToUserIds: ["u-rejected-preference"],
            accommodationRequested: false,
            accommodationNote: null,
            createdAt: "2026-02-01T00:00:00Z",
            updatedAt: "2026-02-01T01:00:00Z",
            createdBy: "u-3",
            updatedBy: "u-3",
            booker: { id: "u-3", firstName: "Rejected", lastName: "Member", email: "rejected@example.com" },
            lines: [],
          }],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockUserNames({
      data: { users: [{ id: "u-2", firstName: "Taylor", lastName: "Member" }] },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^current attendee tickets$/i }));

    expect(screen.getByRole("columnheader", { name: "Dinner" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Symposium" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Accommodation" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Seating preferences" })).toBeInTheDocument();
    expect(screen.getByText("Taylor Member")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Revision" })).not.toBeInTheDocument();
    expect(reactGenerated.useListUserNamesByIds).toHaveBeenCalledWith(
      expect.anything(),
      { ids: ["u-2"] },
      { enabled: true }
    );
    expect(reactGenerated.useListUserNamesByIds).not.toHaveBeenCalledWith(
      expect.anything(),
      { ids: expect.arrayContaining(["u-rejected-preference"]) },
      expect.anything()
    );
  });

  it("updates Dinner and Symposium flags on a ticket type", async () => {
    const user = userEvent.setup();
    const event = {
      id: "ev-1",
      title: "Annual Dinner",
      startDateTime: "2025-03-01T18:00:00Z",
      endDateTime: "2025-03-01T22:00:00Z",
      bookingStartDateTime: "2025-02-01T00:00:00Z",
      bookingEndDateTime: "2025-02-28T23:59:59Z",
      maxGuestsWithoutModeratorApproval: 1,
    };
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [event] } },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: { event: { ...event, ticketTypes: [{
        id: "tt-1",
        title: "Member ticket",
        description: null,
        audience: "MEMBER",
        price: 25,
        sortOrder: 0,
        includesDinner: false,
        includesSymposium: false,
        userGroup: { id: "ug-1", name: "Members", membershipStatuses: [] },
      }] } },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^ticket types$/i }));
    await user.click(screen.getByRole("button", { name: "Edit Member ticket" }));
    await user.click(screen.getByRole("checkbox", { name: "Dinner" }));
    await user.click(screen.getByRole("checkbox", { name: "Symposium" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(generated.updateTicketTypeRef).toHaveBeenCalled());
    expect(generated.updateTicketTypeRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includesDinner: true, includesSymposium: true })
    );
  });

  it("opens event edit dialog from the event admin details section", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
              sponsors: "Example Ltd",
              details: "## Evening programme\n\nDinner and dancing.",
              maxGuestsWithoutModeratorApproval: 2,
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: {
        event: {
          id: "ev-1",
          title: "Annual Dinner",
          startDateTime: "2025-03-01T18:00:00Z",
          endDateTime: "2025-03-01T22:00:00Z",
          bookingStartDateTime: "2025-02-01T00:00:00Z",
          bookingEndDateTime: "2025-02-28T23:59:59Z",
          location: "Main Hall",
          guestOfHonour: "Jane Doe",
          sponsors: "Example Ltd",
          details: "## Evening programme\n\nDinner and dancing.",
          maxGuestsWithoutModeratorApproval: 2,
          ticketTypes: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^event details$/i }));
    await user.click(screen.getByRole("button", { name: /edit event details/i }));

    expect(screen.getByRole("dialog", { name: /edit event/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue("Annual Dinner");
    expect(screen.getByLabelText(/location/i)).toHaveValue("Main Hall");
    expect(screen.getByLabelText(/^sponsors$/i)).toHaveValue("Example Ltd");
    expect(screen.getByLabelText(/^event details$/i)).toHaveValue("## Evening programme\n\nDinner and dancing.");
    expect(screen.getByRole("heading", { name: "Evening programme", level: 4 })).toBeInTheDocument();
    expect(screen.getByLabelText(/max guests without moderator approval/i)).toHaveValue(2);
  });

  it("persists cleared optional event content as null", async () => {
    const user = userEvent.setup();
    const event = {
      id: "ev-1",
      title: "Annual Dinner",
      startDateTime: "2025-03-01T18:00:00Z",
      endDateTime: "2025-03-01T22:00:00Z",
      bookingStartDateTime: "2025-02-01T00:00:00Z",
      bookingEndDateTime: "2025-02-28T23:59:59Z",
      location: "Main Hall",
      guestOfHonour: "Jane Doe",
      sponsors: "Example Ltd",
      details: "Existing details",
      maxGuestsWithoutModeratorApproval: 2,
    };
    mockGetEventsForSection({ data: { section: { id: sectionId, events: [event] } }, isLoading: false, isError: false });
    mockGetEventById({ data: { event: { ...event, ticketTypes: [] } }, isLoading: false, isError: false });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^event details$/i }));
    await user.click(screen.getByRole("button", { name: /edit event details/i }));
    fireEvent.change(screen.getByLabelText(/^sponsors$/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^event details$/i), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(generated.updateEventRef).toHaveBeenCalled());
    expect(generated.updateEventRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sponsors: null, details: null })
    );
  }, 10_000);

  it("renders refreshed selected-event details after editing", async () => {
    const user = userEvent.setup();
    const event = {
      id: "ev-1",
      title: "Annual Dinner",
      startDateTime: "2025-03-01T18:00:00Z",
      endDateTime: "2025-03-01T22:00:00Z",
      bookingStartDateTime: "2025-02-01T00:00:00Z",
      bookingEndDateTime: "2025-02-28T23:59:59Z",
      location: "Main Hall",
      guestOfHonour: "Jane Doe",
      maxGuestsWithoutModeratorApproval: 2,
    };
    const updatedEvent = { ...event, title: "Updated Dinner" };
    const refetchEvents = vi.fn().mockImplementation(async () => {
      mockGetEventsForSection({
        data: { section: { id: sectionId, events: [updatedEvent] } },
        isLoading: false,
        isError: false,
        refetch: refetchEvents,
      });
      return {};
    });
    const refetchEventDetail = vi.fn().mockImplementation(async () => {
      mockGetEventById({
        data: { event: { ...updatedEvent, ticketTypes: [] } },
        isLoading: false,
        isError: false,
        refetch: refetchEventDetail,
      });
      return {};
    });
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [event] } },
      isLoading: false,
      isError: false,
      refetch: refetchEvents,
    });
    mockGetEventById({
      data: { event: { ...event, ticketTypes: [] } },
      isLoading: false,
      isError: false,
      refetch: refetchEventDetail,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^event details$/i }));
    await user.click(screen.getByRole("button", { name: /edit event details/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Updated Dinner" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(refetchEvents).toHaveBeenCalledOnce();
      expect(refetchEventDetail).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText("Updated Dinner")).toBeInTheDocument();
  });

  it("shows empty-state alerts for moderation, booking audit, and payment activity", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: {
        event: {
          id: "ev-1",
          title: "Annual Dinner",
          startDateTime: "2025-03-01T18:00:00Z",
          endDateTime: "2025-03-01T22:00:00Z",
          bookingStartDateTime: "2025-02-01T00:00:00Z",
          bookingEndDateTime: "2025-02-28T23:59:59Z",
          location: "Main Hall",
          guestOfHonour: "Jane Doe",
          maxGuestsWithoutModeratorApproval: null,
          ticketTypes: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^booking approvals$/i }));
    await user.click(screen.getByRole("button", { name: /^booking audit activity$/i }));
    await user.click(screen.getByRole("button", { name: /^payment status activity$/i }));

    expect(screen.getByText(/no booking revisions for this filter/i)).toBeInTheDocument();
    expect(screen.getByText(/no bookings found for this event/i)).toBeInTheDocument();
    expect(screen.getByText(/no payment orders found for this event/i)).toBeInTheDocument();
  });

  it("shows only the current pending booking revision", async () => {
    const user = userEvent.setup();
    mockGetEventsForSection({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      },
      isLoading: false,
      isError: false,
    });
    mockGetEventById({
      data: {
        event: {
          id: "ev-1",
          title: "Annual Dinner",
          startDateTime: "2025-03-01T18:00:00Z",
          endDateTime: "2025-03-01T22:00:00Z",
          bookingStartDateTime: "2025-02-01T00:00:00Z",
          bookingEndDateTime: "2025-02-28T23:59:59Z",
          location: "Main Hall",
          guestOfHonour: "Jane Doe",
          maxGuestsWithoutModeratorApproval: 1,
          ticketTypes: [],
        },
      },
      isLoading: false,
      isError: false,
    });
    const shared = { status: "SUBMITTED", approvalStatus: "PENDING", revisionGroupId: "10000000-0000-4000-8000-000000000001", createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z", createdBy: "u-1", updatedBy: "u-1", booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com" } };
    mockEventBookings({
      data: { event: { id: "ev-1", bookings: [
        { ...shared, id: "b-0", revisionNumber: 1, supersededAt: "2026-02-01T01:00:00Z", lines: [{ id: "old", sortOrder: 1, guestDisplayName: "Superseded Guest", dietaryNote: null, ticketType: { id: "tt-1", title: "Guest", audience: "GUEST", price: 10 }, bookingPlace: { id: "place-old", paymentAllocations: [] } }] },
        { ...shared, id: "b-1", revisionNumber: 2, supersededAt: null, supersedesBooking: { id: "b-0", revisionNumber: 1 }, lines: [{ id: "new", sortOrder: 1, guestDisplayName: "Current Guest", dietaryNote: null, ticketType: { id: "tt-1", title: "Guest", audience: "GUEST", price: 10 }, bookingPlace: { id: "place-new", paymentAllocations: [] } }] },
      ] } }, isLoading: false, isError: false,
    });
    mockTicketOrders({ data: { event: { id: "ev-1", ticketOrders: [] } }, isLoading: false, isError: false });
    mockBookingPaymentAdjustments({ data: { event: { id: "ev-1", bookings: [] } }, isLoading: false, isError: false });

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: /^booking approvals$/i }));

    expect(screen.getByText("Current Guest")).toBeInTheDocument();
    expect(screen.queryByText("Superseded Guest")).not.toBeInTheDocument();
  });
});
