import { MemoryRouter, Routes, Route, useParams, useNavigate, useLocation } from "react-router-dom";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { useEffect, type ReactElement } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { captureSectionEventSummaryRead, rememberSectionEventSummaries } from "../../../../shared/query/sectionEventSummaryCache";
const render = (ui: ReactElement) => baseRender(<MemoryRouter><SummaryCacheProbe />{ui}</MemoryRouter>);
import { guestCall } from "../../../guests/api";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render as baseRender, screen, waitFor, within } from "../../../../test-utils";
import SectionEventsManager from "../SectionEventsManager";
import * as reactGenerated from "../../../../shared/query/authoritativeHooks";
import * as generated from "@dataconnect/generated";
import * as firebaseDataConnect from "firebase/data-connect";
import userEvent from "@testing-library/user-event";
import {
  dataConnectQueryResult,
  type DataConnectQueryResultOverrides,
} from "../../../../test-utils/dataConnectMocks";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("../../../../shared/query/authoritativeHooks", () => ({
  useGetEventsForSection: vi.fn(),
  useGetEventById: vi.fn(),
  useListBookingPaymentAdjustmentsForAdmin: vi.fn(),
  useListEventBookingsForAdmin: vi.fn(),
  useListTicketOrdersForAdmin: vi.fn(),
}));

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn().mockResolvedValue({ data: null }),
  queryRef: vi.fn(() => ({type:"query"})),
  executeMutation: vi.fn().mockResolvedValue({}),
  validateArgs: vi.fn((_config: unknown, dcOrVars: unknown, vars: unknown) => {
    if (vars !== undefined) return { dc: dcOrVars, vars };
    return { dc: {}, vars: dcOrVars };
  }),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
  auth: { currentUser: { uid: "admin" } },
  functions: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reviewBookingRevision: vi.fn().mockResolvedValue({ success: true }),
  getSectionMemberNamesByIds: vi.fn().mockResolvedValue({users:[]}),
  getAnnouncementTemplates: vi.fn().mockResolvedValue([]),
  getAnnouncementDeliveryConfiguration: vi.fn().mockResolvedValue({ siteDeliveryMode: "SIMULATION" }),
  getAnnouncementSendHistory: vi.fn().mockResolvedValue([]),
  previewEventAnnouncementAudience: vi.fn(),
  sendSectionAnnouncement: vi.fn(),
}));

vi.mock("../../../guests/api", () => ({ guestCall: vi.fn().mockResolvedValue({ event: {}, guests: [], ticketTypes: [] }), money: (value: number) => String(value), paymentLabel: (value: string) => value }));

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
  vi.mocked(firebaseFunctions.getSectionMemberNamesByIds).mockResolvedValue((overrides.data ?? {users:[]}) as never);
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
    deleteEventRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    createTicketTypeRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    updateTicketTypeRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    deleteTicketTypeRef: vi.fn((_dc: unknown, vars: unknown) => ({ type: "mutation", vars })),
    ...Object.fromEntries([
      ["getEventsForSectionRef", "GetEventsForSection"], ["getEventByIdRef", "GetEventById"],
      ["listEventBookingsForAdminRef", "ListEventBookingsForAdmin"], ["listTicketOrdersForAdminRef", "ListTicketOrdersForAdmin"],
      ["listBookingPaymentAdjustmentsForAdminRef", "ListBookingPaymentAdjustmentsForAdmin"],
    ].map(([key, name]) => [key, vi.fn((dataConnect: unknown, variables: unknown) => ({ name, dataConnect, variables }))])),
  };
});

function CanonicalManagerRoute() {
  const {sectionId = "section-1",eventId} = useParams();
  return <SectionEventsManager key={`${sectionId}:${eventId ?? "list"}`} sectionId={sectionId} sectionName="Events Section" initialEventId={eventId} routeControlled onBack={() => {}} />;
}
let managerQueryClient: QueryClient;
function SummaryCacheProbe() {
  const queryClient = useQueryClient();
  useEffect(() => { managerQueryClient = queryClient; }, [queryClient]);
  return null;
}
let managerNavigation: ReturnType<typeof useNavigate>;
function ManagerHistory() {
  const navigate = useNavigate(); const location = useLocation();
  useEffect(() => {managerNavigation=navigate;},[navigate]);
  return <><output>{location.pathname+location.search}</output><button onClick={() => navigate("/elsewhere")}>Leave task</button><button onClick={() => navigate(-1)}>History back</button><button onClick={() => navigate(1)}>History forward</button></>;
}
function canonicalManagerElement(path: string) {
  return <MemoryRouter initialEntries={[path]}><SummaryCacheProbe/><ManagerHistory/><Routes><Route path="/sections/:sectionId/manage/events" element={<CanonicalManagerRoute/>}/><Route path="/sections/:sectionId/manage/events/:eventId" element={<CanonicalManagerRoute/>}/><Route path="/elsewhere" element={<div>Elsewhere</div>}/></Routes></MemoryRouter>;
}
function canonicalManager(path: string) {
  return baseRender(canonicalManagerElement(path));
}

function unloadBlocked() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("SectionEventsManager", () => {
  const sectionId = "section-1";
  const sectionName = "Events Section";
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firebaseDataConnect.executeQuery).mockReset().mockResolvedValue({ data: null } as never);
    vi.mocked(firebaseDataConnect.executeMutation).mockReset().mockResolvedValue({} as never);
    vi.mocked(guestCall).mockResolvedValue({ event: {}, guests: [], ticketTypes: [] });
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

  it("opens the user-ticket form from event administration", async () => {
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} initialEventId="ev-1" onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /^current attendee tickets$/i }));
    await user.click(screen.getByRole("button", { name: /^add ticket$/i }));
    expect(screen.getByRole("dialog", { name: "Add ticket for a user" })).toBeInTheDocument();
  });

  it("creates an organiser/club guest type through the existing three-category editor", async () => {
    const user = userEvent.setup();
    vi.mocked(firebaseDataConnect.executeQuery).mockResolvedValueOnce({
      data: { userGroups: [{ id: "group-1", name: "Invited guests" }] },
    } as never);
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} initialEventId="ev-1" onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /^ticket types$/i }));
    await user.click(screen.getByRole("button", { name: /add ticket type/i }));
    await user.click(screen.getByRole("combobox", { name: "Ticket category" }));
    expect(screen.getByRole("option", { name: "Member ticket" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Member’s guest ticket" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Organiser/club guest ticket" }));
    expect(screen.queryByText("Available for new allocations")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: /access group/i }));
    await user.click(screen.getByRole("option", { name: "Invited guests" }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Club dinner" } });
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: "Invited guests" } });
    fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: "12.50" } });
    await user.click(screen.getByRole("checkbox", { name: "Dinner" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(generated.createTicketTypeRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: "ev-1",
        userGroupId: "group-1",
        audience: generated.TicketAudience.ORGANISER_GUEST,
        title: "Club dinner",
        description: "Invited guests",
        price: 12.5,
        includesDinner: true,
      }),
    ));
  }, 10_000);

  it("shows and deletes organiser types through the standard ticket table", async () => {
    const type = { id: "org-type", title: "Club dinner", description: "Invitation", price: 25, sortOrder: 1, audience: generated.TicketAudience.ORGANISER_GUEST, userGroup: { id: "group-1", name: "Invited guests", membershipStatuses: [] }, includesDinner: true, includesSymposium: false };
    mockGetEventById({
      data: { event: { id: "ev-1", title: "Event", maxGuestsWithoutModeratorApproval: 0, ticketTypes: [type] } },
      isLoading: false,
      isError: false,
    });
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} initialEventId="ev-1" onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /^ticket types$/i }));
    expect(await screen.findByText("Organiser/club guest ticket")).toBeInTheDocument();
    expect(screen.getByText("Invited guests")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Club dinner" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(generated.deleteTicketTypeRef).toHaveBeenCalledWith(
      expect.anything(),
      { id: "org-type" },
    ));
  });

  it("explains when a ticket type cannot be deleted because tickets exist", async () => {
    const type = {
      id: "member-type",
      title: "Dinner",
      description: "",
      price: 25,
      sortOrder: 1,
      audience: generated.TicketAudience.MEMBER,
      userGroup: { id: "group-1", name: "Members", membershipStatuses: [] },
      includesDinner: true,
      includesSymposium: false,
    };
    mockGetEventById({
      data: { event: { id: "ev-1", title: "Event", maxGuestsWithoutModeratorApproval: 0, ticketTypes: [type] } },
      isLoading: false,
      isError: false,
    });
    vi.mocked(firebaseDataConnect.executeMutation).mockRejectedValueOnce(
      new Error("TICKET_TYPE_IN_USE"),
    );
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} initialEventId="ev-1" onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /^ticket types$/i }));
    await user.click(screen.getByRole("button", { name: "Delete Dinner" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText(
        "This ticket type cannot be deleted because tickets already exist.",
      ),
    ).toBeInTheDocument();
  });

  const deletionEvent = {
    id: "ev-1", title: "Annual Dinner", startDateTime: "2030-03-01T18:00:00Z", endDateTime: "2030-03-01T22:00:00Z",
    bookingStartDateTime: "2030-02-01T00:00:00Z", bookingEndDateTime: "2030-02-28T23:59:59Z",
    location: "Hall", guestOfHonour: null, sponsors: null, details: null, maxGuestsWithoutModeratorApproval: 0,
  };

  async function openDeletion(kind: "event" | "ticket type") {
    mockGetEventsForSection({ data: { section: { id: sectionId, events: [deletionEvent, { ...deletionEvent, id: "ev-2", title: "Second Dinner" }] } }, isLoading: false, isError: false });
    mockGetEventById({
      data: { event: { ...deletionEvent, ticketTypes: [{
        id: "type-1", title: "Dinner", description: "Dinner", price: 25, sortOrder: 0,
        audience: generated.TicketAudience.MEMBER, userGroup: { id: "members", name: "Members", membershipStatuses: [] },
        includesDinner: true, includesSymposium: false,
      }, {
        id: "type-2", title: "Second Dinner", description: "Another ticket type", price: 30, sortOrder: 1,
        audience: generated.TicketAudience.MEMBER, userGroup: { id: "members", name: "Members", membershipStatuses: [] },
        includesDinner: true, includesSymposium: false,
      }] } }, isLoading: false, isError: false,
    });
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName}
      initialEventId={kind === "ticket type" ? deletionEvent.id : undefined} onBack={onBack} />);
    if (kind === "ticket type") await user.click(screen.getByRole("button", { name: /^ticket types$/i }));
    await user.click(screen.getByRole("button", { name: kind === "event" ? "Delete Annual Dinner" : "Delete Dinner" }));
    return { user, dialog: screen.getByRole("dialog", { name: `Delete ${kind}?` }) };
  }

  it.each(["event", "ticket type"] as const)("retires summaries before an ambiguous %s deletion without replay or a server refresh", async kind => {
    const { user, dialog } = await openDeletion(kind);
    const scope = captureSectionEventSummaryRead(managerQueryClient, sectionId);
    managerQueryClient.setQueryData(scope.queryKey, { events: [] });
    vi.mocked(firebaseDataConnect.executeMutation).mockImplementationOnce(async () => {
      expect(managerQueryClient.getQueryData(scope.queryKey)).toBeUndefined();
      throw new Error("Response lost after deletion may have committed");
    });

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
    rememberSectionEventSummaries(managerQueryClient, { events: [] }, scope);
    expect(managerQueryClient.getQueryData(scope.queryKey)).toBeUndefined();
    expect(firebaseDataConnect.executeQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["event", "create"], ["event", "update"], ["ticket", "create"], ["ticket", "update"],
  ] as const)("retires summaries before an ambiguous %s %s without replaying the write", async (kind, action) => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const event = { ...deletionEvent, section: { id: sectionId }, ticketTypes: [{
      id: "type-1", title: "Dinner", description: "Dinner", price: 25, sortOrder: 0,
      audience: generated.TicketAudience.MEMBER, userGroup: { id: "members", name: "Members", membershipStatuses: [] },
      includesDinner: true, includesSymposium: false,
    }] };
    mockGetEventsForSection({ data: { section: { id: sectionId, events: [event] } }, isLoading: false, isError: false });
    mockGetEventById({ data: { event }, isLoading: false, isError: false });
    vi.mocked(firebaseDataConnect.executeQuery).mockResolvedValue({ data: { userGroups: [{ id: "members", name: "Members" }] } } as never);
    const route = kind === "event"
      ? action === "create" ? "/sections/section-1/manage/events?edit=new-event" : "/sections/section-1/manage/events/ev-1?edit=event"
      : `/sections/section-1/manage/events/ev-1?task=tickets&ticket=${action === "create" ? "new" : "type-1"}`;
    const view = canonicalManager(route);
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: `Uncertain ${kind} ${action}` } });
      if (kind === "ticket") {
        await user.click(screen.getByRole("combobox", { name: /access group/i }));
        await user.click(await screen.findByRole("option", { name: "Members" }));
      }
      const scope = captureSectionEventSummaryRead(managerQueryClient, sectionId);
      managerQueryClient.setQueryData(scope.queryKey, { events: [] });
      vi.mocked(firebaseDataConnect.executeMutation).mockImplementationOnce(async () => {
        expect(managerQueryClient.getQueryData(scope.queryKey)).toBeUndefined();
        throw new Error("Response lost after save may have committed");
      });
      const readsBeforeSave = vi.mocked(firebaseDataConnect.executeQuery).mock.calls.length;

      await user.click(screen.getByRole("button", { name: "Save" }));

      await screen.findByText(/The previous save could not be confirmed/);
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
      expect(firebaseDataConnect.executeQuery).toHaveBeenCalledTimes(readsBeforeSave);
      rememberSectionEventSummaries(managerQueryClient, { events: [] }, scope);
      expect(managerQueryClient.getQueryData(scope.queryKey)).toBeUndefined();
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

  it.each(["event", "ticket type"] as const)("names the %s and cancels without a mutation or native prompt", async (kind) => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    try {
      const { user, dialog } = await openDeletion(kind);
      expect(dialog).toHaveTextContent(kind === "event" ? "Annual Dinner" : "Dinner");
      expect(dialog).toHaveTextContent("This cannot be undone.");
      if (kind === "event") expect(dialog).toHaveTextContent("remove its unused ticket types");
      expect(firebaseDataConnect.executeMutation).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(firebaseDataConnect.executeMutation).not.toHaveBeenCalled();
      expect(nativeConfirm).not.toHaveBeenCalled();
    } finally {
      nativeConfirm.mockRestore();
    }
  });

  it.each(["event", "ticket type"] as const)("guards the exact %s deletion against rapid confirmation and pending dismissal", async (kind) => {
    let finishDelete!: (value: unknown) => void;
    vi.mocked(firebaseDataConnect.executeMutation).mockImplementationOnce(() => new Promise((resolve) => { finishDelete = resolve; }) as never);
    const { user, dialog } = await openDeletion(kind);
    const deleteButton = within(dialog).getByRole("button", { name: "Delete" });
    act(() => { fireEvent.click(deleteButton); fireEvent.click(deleteButton); });
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: `Delete ${kind}?` })).toBeInTheDocument();
    expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
    expect(kind === "event" ? generated.deleteEventRef : generated.deleteTicketTypeRef).toHaveBeenCalledWith(
      expect.anything(), { id: kind === "event" ? "ev-1" : "type-1" },
    );
    await act(async () => { finishDelete({}); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
  });

  it.each(["event", "ticket type"] as const)("opens another %s deletion during refresh and keeps its mutation guarded when the old refresh ends", async (kind) => {
    const heldRead = kind === "event" ? "GetEventsForSection" : "GetEventById";
    let finishFirstRefresh!: (value: unknown) => void;
    let finishSecondDelete: ((value: unknown) => void) | undefined;
    let firstRefreshStarted = false;
    vi.mocked(firebaseDataConnect.executeQuery).mockImplementation((ref) => {
      if (ref.name === heldRead && !firstRefreshStarted) {
        firstRefreshStarted = true;
        return new Promise((resolve) => { finishFirstRefresh = resolve; }) as never;
      }
      return Promise.resolve({ data: null }) as never;
    });
    vi.mocked(firebaseDataConnect.executeMutation)
      .mockResolvedValueOnce({} as never)
      .mockImplementationOnce(() => new Promise((resolve) => { finishSecondDelete = resolve; }) as never);
    try {
      const { user, dialog } = await openDeletion(kind);
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(firstRefreshStarted).toBe(true));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      const secondTrigger = screen.getByRole("button", { name: "Delete Second Dinner" });
      expect(secondTrigger).toBeEnabled();
      await user.click(secondTrigger);
      const secondDialog = screen.getByRole("dialog", { name: `Delete ${kind}?` });
      expect(secondDialog).toHaveTextContent("Second Dinner");
      expect(within(secondDialog).getByRole("button", { name: "Delete" })).toBeEnabled();
      await user.click(within(secondDialog).getByRole("button", { name: "Delete" }));
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledTimes(2);
      await act(async () => { finishFirstRefresh({ data: null }); });
      // An older refresh settling must not unlock the newer deletion.
      expect(within(secondDialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
      expect(within(secondDialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(secondDialog).toBeInTheDocument();
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledTimes(2);
      const refs = kind === "event" ? generated.deleteEventRef : generated.deleteTicketTypeRef;
      expect(vi.mocked(refs).mock.calls.map(([, vars]) => vars)).toEqual([
        { id: kind === "event" ? "ev-1" : "type-1" },
        { id: kind === "event" ? "ev-2" : "type-2" },
      ]);
      await act(async () => { finishSecondDelete?.({}); });
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    } finally {
      await act(async () => { finishFirstRefresh?.({ data: null }); finishSecondDelete?.({}); });
    }
  }, 30_000);

  it.each([
    ["event", "Cancel"], ["ticket type", "Cancel"], ["event", "Delete"], ["ticket type", "Delete"],
  ] as const)("retains the named %s confirmation during the closing transition after %s", async (kind, action) => {
    const { dialog } = await openDeletion(kind);
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: action })); });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`Delete ${kind}?`);
    expect(dialog).toHaveTextContent(kind === "event" ? "Annual Dinner" : "Dinner");
    expect(dialog).not.toHaveTextContent("“”");
    expect(firebaseDataConnect.executeMutation).toHaveBeenCalledTimes(action === "Delete" ? 1 : 0);
    // Retaining the closing item must not leave its old Delete button active.
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete", hidden: true }));
    expect(firebaseDataConnect.executeMutation).toHaveBeenCalledTimes(action === "Delete" ? 1 : 0);
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
  });

  it("renders events list with section name", async () => {
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Events: Events Section/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
  });

  it("deletes an event without first deleting its bookings", async () => {
    const event = { id: "ev-1", title: "Annual Dinner", startDateTime: "2025-03-01T18:00:00Z", endDateTime: "2025-03-01T22:00:00Z", bookingStartDateTime: "2025-02-01T00:00:00Z", bookingEndDateTime: "2025-02-28T23:59:59Z", location: "Main Hall", guestOfHonour: null, sponsors: null, details: null, maxGuestsWithoutModeratorApproval: 0 };
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [event] } },
      isLoading: false,
      isError: false,
    });
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Delete Annual Dinner" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(generated.deleteEventRef).toHaveBeenCalledWith(
      expect.anything(),
      { id: "ev-1" },
    ));
    expect(firebaseDataConnect.executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({ name: "GetEventsForSection" }), { fetchPolicy: "SERVER_ONLY" },
    );
    expect(vi.mocked(firebaseDataConnect.executeQuery).mock.calls.every(([ref]) => ref.name === "GetEventsForSection")).toBe(true);
  });

  it("explains when an event cannot be deleted because tickets exist", async () => {
    const event = { id: "ev-1", title: "Annual Dinner", startDateTime: "2025-03-01T18:00:00Z", endDateTime: "2025-03-01T22:00:00Z", bookingStartDateTime: "2025-02-01T00:00:00Z", bookingEndDateTime: "2025-02-28T23:59:59Z", location: "Main Hall", guestOfHonour: null, sponsors: null, details: null, maxGuestsWithoutModeratorApproval: 0 };
    mockGetEventsForSection({
      data: { section: { id: sectionId, events: [event] } },
      isLoading: false,
      isError: false,
    });
    vi.mocked(firebaseDataConnect.executeMutation).mockRejectedValueOnce(
      new Error("EVENT_HAS_TICKETS"),
    );
    const user = userEvent.setup();
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Delete Annual Dinner" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText(
        "This event cannot be deleted because tickets already exist.",
      ),
    ).toBeInTheDocument();
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
            booker: { id: "u-1", firstName: "Alex", lastName: "Smith", email: "alex@example.com", rank: "Wing Commander", membershipStatus: "REGULAR" },
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

    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Dinner" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Symposium" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Accommodation" })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: "Seating preferences" })).toHaveLength(2);
    expect(await screen.findByText("Taylor Member")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Revision" })).not.toBeInTheDocument();
    expect(firebaseFunctions.getSectionMemberNamesByIds).toHaveBeenCalledWith(sectionId,["u-2"]);
    expect(firebaseFunctions.getSectionMemberNamesByIds).not.toHaveBeenCalledWith(sectionId,expect.arrayContaining(["u-rejected-preference"]));
    expect(screen.getByRole("columnheader", { name: "Rank" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Membership status" })).toBeInTheDocument();
    expect(screen.getByText("Wing Commander")).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
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
  }, 10_000);

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

    vi.mocked(firebaseDataConnect.executeQuery).mockImplementation(async (ref) => {
      if (ref.name === "GetEventsForSection") {
        await refetchEvents();
        return { data: { section: { id: sectionId, events: [updatedEvent] } } } as never;
      }
      if (ref.name === "GetEventById") {
        await refetchEventDetail();
        return { data: { event: { ...updatedEvent, ticketTypes: [] } } } as never;
      }
      return { data: null } as never;
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
  }, 10_000);

  it.each([
    ["booking approvals", /no booking revisions for this filter/i],
    ["booking audit activity", /no bookings found for this event/i],
    ["payment status activity", /no payment orders found for this event/i],
  ] as const)("shows the empty state for %s", async (panel, message) => {
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

    // Each panel has independent behavior. Open the requested event directly
    // so this assertion does not spend its budget navigating unrelated panels.
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} initialEventId="ev-1" onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: new RegExp(`^${panel}$`, "i") }));
    expect(await screen.findByText(message)).toBeInTheDocument();
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
  it("loads a cold event URL with its approval tab selected and shareable task links", async () => {
    const event = {id:"ev-1",title:"Cold event",section:{id:sectionId},startDateTime:"2030-03-01T18:00:00Z",endDateTime:"2030-03-01T22:00:00Z",bookingStartDateTime:"2030-01-01T00:00:00Z",bookingEndDateTime:"2030-02-28T00:00:00Z",maxGuestsWithoutModeratorApproval:0,ticketTypes:[]};
    mockGetEventsForSection({data:{section:{id:sectionId,events:[event]}},isLoading:false,isError:false});
    mockGetEventById({data:{event},isLoading:false,isError:false});
    canonicalManager("/sections/section-1/manage/events/ev-1?task=approvals");
    expect(screen.getByRole("tab",{name:"Approvals (0)"})).toHaveAttribute("aria-selected","true");
    expect(screen.getByRole("tabpanel",{name:"Approvals (0)"})).toBeInTheDocument();
    expect(screen.getByRole("tab",{name:"Tickets & attendees"})).toHaveAttribute("href","/sections/section-1/manage/events/ev-1?task=attendees");
    expect(screen.queryByRole("button",{name:"Booking approvals"})).not.toBeInTheDocument();
    expect(reactGenerated.useListEventBookingsForAdmin).toHaveBeenCalledWith(expect.anything(),{eventId:"ev-1"},{enabled:true});
  });

  function prepareRoutedEvent() {
    const event = {
      id: "ev-1", section: { id: sectionId }, title: "Managed Dinner", location: "Main Hall",
      startDateTime: "2030-03-01T18:00:00Z", endDateTime: "2030-03-01T22:00:00Z",
      bookingStartDateTime: "2030-01-01T00:00:00Z", bookingEndDateTime: "2030-02-28T00:00:00Z",
      maxGuestsWithoutModeratorApproval: 1, ticketTypes: [],
    };
    mockGetEventsForSection({ data: { section: { id: sectionId, events: [event] } }, isLoading: false, isError: false });
    mockGetEventById({ data: { event }, isLoading: false, isError: false });
    return event;
  }

  function routedBooking(approvalStatus = "APPROVED") {
    return {
      id: "routed-booking", status: "SUBMITTED", approvalStatus,
      revisionGroupId: "10000000-0000-4000-8000-000000000001", revisionNumber: 1,
      supersededAt: null, sitNextToUserIds: ["seating-member"],
      accommodationRequested: false, accommodationNote: null,
      createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T01:00:00Z", createdBy: "member", updatedBy: "member",
      booker: { id: "member", firstName: "Alex", lastName: "Member", email: "alex@example.invalid", rank: null, membershipStatus: "REGULAR" },
      lines: [{ id: "routed-line", sortOrder: 0, guestDisplayName: null, dietaryNote: null,
        bookingPlace: { id: "routed-place", paymentAllocations: [], attendanceRemoved: false },
        ticketType: { id: "routed-type", title: "Dinner place", audience: "MEMBER", price: 0, includesDinner: true, includesSymposium: false } }],
    };
  }

  it("opens an unpaid-booker announcement from the real Payments shortcut with its exact audience URL", async () => {
    prepareRoutedEvent();
    const approved = routedBooking();
    const unpaid = { ...approved, lines: approved.lines.map((line) => ({ ...line, ticketType: { ...line.ticketType, price: 25 } })) };
    mockEventBookings({ data: { event: { id: "ev-1", bookings: [unpaid], bookingTicketOrders: [] } }, isLoading: false, isError: false });
    const view = canonicalManager("/sections/section-1/manage/events/ev-1?task=payments");
    try {
      const user = userEvent.setup();
      const contact = await screen.findByRole("button", { name: "Contact unpaid bookers" });
      await waitFor(() => expect(contact).toBeEnabled());
      await user.click(contact);
      expect(screen.getByText("/sections/section-1/manage/events/ev-1?task=announcement&recipientTarget=BOOKERS&audience.paymentState=UNPAID")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Communications" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Booking owners" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Payment" })).toHaveTextContent("Unpaid");
      expect(screen.queryByRole("heading", { name: "Event attendees" })).not.toBeInTheDocument();
      expect(firebaseFunctions.previewEventAnnouncementAudience).not.toHaveBeenCalled();
      expect(firebaseFunctions.sendSectionAnnouncement).not.toHaveBeenCalled();
    } finally { view.unmount(); }
  }, 20_000);

  it("retains a confirmed approval across failed refresh, task history and remount without another decision", async () => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    prepareRoutedEvent();
    mockEventBookings({ data: { event: { id: "ev-1", bookings: [routedBooking("PENDING")] } }, isLoading: false, isError: false });
    vi.mocked(firebaseDataConnect.executeQuery).mockRejectedValue(new Error("Authoritative booking reload unavailable"));
    const view = canonicalManager("/sections/section-1/manage/events/ev-1?task=approvals");
    try {
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Review change" }));
      let review = screen.getByRole("dialog", { name: /Review booking change/ });
      await user.click(within(review).getByRole("button", { name: "Approve revision" }));
      await waitFor(() => expect(within(review).getByText(/Decision saved/)).toBeInTheDocument());
      await waitFor(() => expect(within(review).getByRole("button", { name: "Close review" })).toBeEnabled());
      expect(within(review).getByRole("button", { name: "Approve revision" })).toBeDisabled();
      expect(within(review).getByRole("button", { name: "Request changes" })).toBeDisabled();
      fireEvent.click(within(review).getByRole("button", { name: "Approve revision" }));
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledOnce();
      await user.click(within(review).getByRole("button", { name: "Close review" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      expect(screen.getByText(/The latest event data could not be loaded/)).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Payments" }));
      await act(async () => managerNavigation(-1));
      await user.click(screen.getByRole("button", { name: "Review change" }));
      review = screen.getByRole("dialog", { name: /Review booking change/ });
      expect(within(review).getByText(/Decision saved/)).toBeInTheDocument();
      expect(within(review).getByRole("button", { name: "Approve revision" })).toBeDisabled();
      await user.click(within(review).getByRole("button", { name: "Close review" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      await act(async () => managerNavigation("/elsewhere"));
      await act(async () => managerNavigation(-1));
      await user.click(screen.getByRole("button", { name: "Review change" }));
      review = screen.getByRole("dialog", { name: /Review booking change/ });
      expect(within(review).getByText(/Decision saved/)).toBeInTheDocument();
      expect(within(review).getByRole("textbox", { name: "Moderator note" })).toBeDisabled();
      expect(within(review).getByRole("button", { name: "Request changes" })).toBeDisabled();
      expect(within(review).getByRole("button", { name: "Approve revision" })).toBeDisabled();
      fireEvent.click(within(review).getByRole("button", { name: "Request changes" }));
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledOnce();
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

  it("defaults a canonical event page to Overview with exactly six main task tabs", async () => {
    prepareRoutedEvent();
    canonicalManager("/sections/section-1/manage/events/ev-1");
    const tabs = within(screen.getByRole("tablist", { name: "Event sections" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Overview", "Event details", "Tickets & attendees", "Approvals (0)", "Communications", "Payments"]);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Managed Dinner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "/sections/section-1/manage/events/ev-1?task=activity");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Status filter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Payment views" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Approval summary is unavailable.")).not.toBeInTheDocument());
  });

  it.each([
    ["overview", true, true, false, false],
    ["details", false, false, false, false],
    ["tickets", false, false, false, false],
    ["attendees", true, true, false, true],
    ["removed", true, false, false, true],
    ["approvals", true, false, false, true],
    ["activity", true, false, false, false],
    ["payments", true, true, true, false],
    ["communications", false, false, false, false],
    ["guests", false, true, false, false],
  ] as const)("enables only the required private datasets for the %s task", async (task, bookings, guests, payments, names) => {
    prepareRoutedEvent();
    mockEventBookings({ data: { event: { id: "ev-1", bookings: [routedBooking()], bookingTicketOrders: [] } }, isLoading: false, isError: false });
    canonicalManager(`/sections/section-1/manage/events/ev-1?task=${task}`);
    await act(async () => { await Promise.resolve(); });
    expect(reactGenerated.useListEventBookingsForAdmin).toHaveBeenLastCalledWith(expect.anything(), { eventId: "ev-1" }, { enabled: bookings });
    expect(reactGenerated.useListTicketOrdersForAdmin).toHaveBeenLastCalledWith(expect.anything(), { eventId: "ev-1" }, { enabled: payments });
    expect(reactGenerated.useListBookingPaymentAdjustmentsForAdmin).toHaveBeenLastCalledWith(expect.anything(), { eventId: "ev-1" }, { enabled: payments });
    if (guests) expect(guestCall).toHaveBeenCalledWith("getOrganiserGuestList", expect.objectContaining({ eventId: "ev-1" }));
    else expect(guestCall).not.toHaveBeenCalled();
    if (names) await waitFor(() => expect(firebaseFunctions.getSectionMemberNamesByIds).toHaveBeenCalledWith("section-1", ["seating-member"]));
    else expect(firebaseFunctions.getSectionMemberNamesByIds).not.toHaveBeenCalled();
  });

  it("unmounts inactive task panels while preserving event and moderator-note drafts", async () => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    prepareRoutedEvent();
    mockEventBookings({ data: { event: { id: "ev-1", bookings: [routedBooking("PENDING")] } }, isLoading: false, isError: false });
    const view = canonicalManager("/sections/section-1/manage/events/ev-1?task=details");
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), { target: { value: "Unsent event draft" } });
      expect(screen.getByRole("heading", { level: 1, name: "Managed Dinner" })).toBeInTheDocument();
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Approvals (1)" }));
      expect(screen.queryByRole("form", { name: "Event details" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Review change" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Moderator note" }), { target: { value: "Unsent review note" } });
      await user.click(screen.getByRole("button", { name: "Close review" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      await user.click(screen.getByRole("tab", { name: "Payments" }));
      expect(screen.queryByRole("combobox", { name: "Status filter" })).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Moderator note" })).not.toBeInTheDocument();
      expect(screen.getByRole("tablist", { name: "Payment views" })).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Event details" }));
      expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("Unsent event draft");
      expect(screen.queryByRole("tablist", { name: "Payment views" })).not.toBeInTheDocument();
      await act(async () => managerNavigation("/elsewhere"));
      await act(async () => managerNavigation(-1));
      expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("Unsent event draft");
      await user.click(screen.getByRole("tab", { name: "Approvals (1)" }));
      await user.click(screen.getByRole("button", { name: "Review change" }));
      expect(screen.getByRole("textbox", { name: "Moderator note" })).toHaveValue("Unsent review note");
      expect(generated.updateEventRef).not.toHaveBeenCalled();
      expect(firebaseFunctions.reviewBookingRevision).not.toHaveBeenCalled();
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

  it.each(["success", "failure"] as const)("releases review controls when a %s settles after browser task navigation", async (outcome) => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    prepareRoutedEvent();
    const first = routedBooking("PENDING");
    const second = { ...routedBooking("PENDING"), id: "second-review", revisionGroupId: "20000000-0000-4000-8000-000000000002", booker: { ...first.booker, id: "second-member", firstName: "Blair" } };
    mockEventBookings({ data: { event: { id: "ev-1", bookings: [first, second] } }, isLoading: false, isError: false });
    let complete!: (value: unknown) => void;
    let fail!: (error: Error) => void;
    const pending = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
    vi.mocked(firebaseFunctions.reviewBookingRevision).mockReturnValueOnce(pending as never);
    const view = canonicalManager("/sections/section-1/manage/events/ev-1");
    try {
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: "Approvals (2)" }));
      await user.click(within(screen.getByRole("row", { name: /Alex Member/ })).getByRole("button", { name: "Review change" }));
      await user.click(within(screen.getByRole("dialog", { name: /Review booking change/ })).getByRole("button", { name: "Approve revision" }));
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledOnce();
      await act(async () => managerNavigation(-1));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
      await act(async () => {
        if (outcome === "success") complete({ success: true, bookingId: first.id, revisionNumber: 1, approvalStatus: "APPROVED", paymentDelta: null });
        else fail(new Error("Decision transport interrupted"));
        await pending.catch(() => {});
      });
      await act(async () => managerNavigation(1));
      const secondRow = screen.getByRole("row", { name: /Blair Member/ });
      await waitFor(() => expect(within(secondRow).getByRole("button", { name: "Review change" })).toBeEnabled());
      await user.click(within(secondRow).getByRole("button", { name: "Review change" }));
      const review = screen.getByRole("dialog", { name: /Review booking change/ });
      expect(within(review).getByRole("button", { name: "Close review" })).toBeEnabled();
      expect(within(review).getByRole("button", { name: "Request changes" })).toBeEnabled();
      expect(within(review).getByRole("button", { name: "Approve revision" })).toBeEnabled();
      await user.click(within(review).getByRole("button", { name: "Close review" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledOnce();
      await user.click(within(screen.getByRole("row", { name: /Blair Member/ })).getByRole("button", { name: "Review change" }));
      const reopened = screen.getByRole("dialog", { name: /Review booking change/ });
      await user.click(within(reopened).getByRole("button", { name: "Approve revision" }));
      await waitFor(() => expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledTimes(2));
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenLastCalledWith(expect.objectContaining({ bookingId: second.id, expectedRevisionNumber: 1, decision: "APPROVED" }));
      await waitFor(() => expect(within(reopened).getByRole("button", { name: "Close review" })).toBeEnabled());
      await user.click(within(reopened).getByRole("button", { name: "Close review" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    } finally {
      view.unmount(); owner.retire(); uninstall();
      complete({ success: true });
      await pending.catch(() => {});
    }
  }, 20_000);

  it.each(["event", "session"] as const)("does not let an old decision clear a newer request after %s replacement", async (boundary) => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const replacementOwner = createSessionLifecycle();
    let uninstallReplacement: (() => void) | undefined;
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const event = prepareRoutedEvent();
    const first = routedBooking("PENDING");
    const second = { ...routedBooking("PENDING"), id: "replacement-review", revisionGroupId: "30000000-0000-4000-8000-000000000003", booker: { ...first.booker, id: "replacement-member", firstName: "Blair" } };
    mockEventBookings({ data: { event: { id: event.id, bookings: [first] } }, isLoading: false, isError: false });
    let completeFirst!: (value: unknown) => void;
    let completeSecond!: (value: unknown) => void;
    const firstPending = new Promise(resolve => { completeFirst = resolve; });
    const secondPending = new Promise(resolve => { completeSecond = resolve; });
    vi.mocked(firebaseFunctions.reviewBookingRevision).mockReturnValueOnce(firstPending as never).mockReturnValueOnce(secondPending as never);
    let view = canonicalManager("/sections/section-1/manage/events/ev-1?task=approvals");
    try {
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Review change" }));
      await user.click(within(screen.getByRole("dialog", { name: /Review booking change/ })).getByRole("button", { name: "Approve revision" }));
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledOnce();
      await act(async () => managerNavigation("/sections/section-1/manage/events/ev-1"));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      const replacementEvent = boundary === "event" ? { ...event, id: "ev-2", title: "Another Dinner" } : event;
      mockGetEventsForSection({ data: { section: { id: sectionId, events: [event, ...(boundary === "event" ? [replacementEvent] : [])] } }, isLoading: false, isError: false });
      mockGetEventById({ data: { event: replacementEvent }, isLoading: false, isError: false });
      mockEventBookings({ data: { event: { id: replacementEvent.id, bookings: [second] } }, isLoading: false, isError: false });
      if (boundary === "session") {
        // Account replacement retires the private document and mounts a new tree.
        view.unmount();
        owner.retire();
        replacementOwner.observe("replacement-admin");
        uninstallReplacement = installSessionRuntime({ lifecycle: replacementOwner, retire: () => replacementOwner.retire(), signOut: async () => replacementOwner.retire() });
        view = canonicalManager(`/sections/section-1/manage/events/${replacementEvent.id}?task=approvals`);
      } else await act(async () => managerNavigation(`/sections/section-1/manage/events/${replacementEvent.id}?task=approvals`));
      const replacementReviewButton = await screen.findByRole("button", { name: "Review change" });
      await waitFor(() => expect(replacementReviewButton).toBeEnabled());
      await user.click(replacementReviewButton);
      let review = screen.getByRole("dialog", { name: /Review booking change/ });
      await user.click(within(review).getByRole("button", { name: "Approve revision" }));
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledTimes(2);
      await act(async () => {
        completeFirst({ success: true, bookingId: first.id, revisionNumber: 1, approvalStatus: "APPROVED", paymentDelta: null });
        await firstPending;
      });
      review = screen.getByRole("dialog", { name: /Review booking change/ });
      expect(within(review).getByRole("button", { name: "Saving decision…" })).toBeDisabled();
      expect(within(review).getByRole("button", { name: "Request changes" })).toBeDisabled();
      expect(within(review).getByRole("button", { name: "Close review" })).toBeDisabled();
      expect(within(review).queryByText(/Decision saved/)).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, hidden: true })).toHaveTextContent(replacementEvent.title);
      await act(async () => {
        completeSecond({ success: true, bookingId: second.id, revisionNumber: 1, approvalStatus: "APPROVED", paymentDelta: null });
        await secondPending;
      });
      await waitFor(() => expect(within(review).getByRole("button", { name: "Close review" })).toBeEnabled());
      expect(within(review).getByText(/Decision saved/)).toBeInTheDocument();
      expect(firebaseFunctions.reviewBookingRevision).toHaveBeenCalledTimes(2);
      await user.click(within(review).getByRole("button", { name: "Close review" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    } finally {
      view.unmount(); owner.retire(); replacementOwner.retire(); uninstallReplacement?.(); uninstall();
      completeFirst({ success: true }); completeSecond({ success: true });
      await Promise.all([firstPending, secondPending]);
    }
  }, 20_000);

  it("returns directly from organiser guests to attendees on a narrow screen", async () => {
    const previousMediaImplementation = vi.mocked(window.matchMedia).getMockImplementation()!;
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query.includes("max-width:600px") || query.includes("max-width: 899px"), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    prepareRoutedEvent();
    const view = canonicalManager("/sections/section-1/manage/events/ev-1?task=guests");
    try {
      const user = userEvent.setup();
      expect(screen.getByRole("combobox", { name: "Event section" })).toHaveTextContent("Tickets & attendees");
      const back = screen.getByRole("link", { name: "Back to attendees" });
      expect(back).toHaveAttribute("href", "/sections/section-1/manage/events/ev-1?task=attendees");
      await user.click(back);
      expect(screen.getByText("/sections/section-1/manage/events/ev-1?task=attendees")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Tickets & attendees" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Attendees" })).toHaveAttribute("aria-selected", "true");
      expect(screen.queryByRole("heading", { name: "Organiser guests" })).not.toBeInTheDocument();
    } finally { view.unmount(); vi.mocked(window.matchMedia).mockImplementation(previousMediaImplementation); }
  });

  it("waits for authoritative cold details before exposing editable fields or Save", async () => {
    const event = prepareRoutedEvent();
    const url = "/sections/section-1/manage/events/ev-1?task=details";
    mockGetEventById({ data: undefined, isLoading: true, isError: false });
    const view = canonicalManager(url);
    expect(screen.getByText("Loading event details…")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Event details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    const authoritativeEvent = { ...event, title: "Authoritative event", location: "Server-confirmed venue" };
    mockGetEventById({ data: { event: authoritativeEvent }, isLoading: false, isError: false });
    view.rerender(canonicalManagerElement(url));
    expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue(authoritativeEvent.title);
    expect(screen.getByRole("textbox", { name: "Location" })).toHaveValue(authoritativeEvent.location);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.queryByText("Loading event details…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: authoritativeEvent.title })).toBeInTheDocument();
    expect(firebaseDataConnect.executeMutation).not.toHaveBeenCalled();
  });

  it("preserves an existing event draft while a remounted detail read is pending and after it resolves", async () => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const event = prepareRoutedEvent();
    const url = "/sections/section-1/manage/events/ev-1?task=details";
    const view = canonicalManager(url);
    try {
      fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), { target: { value: "Retained unsent draft" } });
      await act(async () => managerNavigation("/elsewhere"));
      mockGetEventById({ data: undefined, isLoading: true, isError: false });
      await act(async () => managerNavigation(-1));
      expect(screen.getByText("Loading event details…")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
      const authoritativeEvent = { ...event, title: "Changed on server during the visit" };
      mockGetEventById({ data: { event: authoritativeEvent }, isLoading: false, isError: false });
      view.rerender(canonicalManagerElement(url));
      expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("Retained unsent draft");
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: authoritativeEvent.title })).toBeInTheDocument();
      expect(firebaseDataConnect.executeMutation).not.toHaveBeenCalled();
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

  it("recovers a failed cold Event details read without showing a blank editor or writing", async () => {
    const event = prepareRoutedEvent();
    mockGetEventById({ data: undefined, isLoading: false, isError: true, error: new Error("Detail temporarily unavailable") });
    vi.mocked(firebaseDataConnect.executeQuery).mockImplementation(async (ref) => {
      if (ref.name === "GetEventById") {
        mockGetEventById({ data: { event }, isLoading: false, isError: false });
        return { data: { event } } as never;
      }
      return { data: null } as never;
    });
    canonicalManager("/sections/section-1/manage/events/ev-1?task=details");
    const user = userEvent.setup();
    expect(screen.queryByRole("form", { name: "Event details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Retry loading" }));
    expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("Managed Dinner");
    expect(screen.getByRole("form", { name: "Event details" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry loading" })).not.toBeInTheDocument();
    expect(generated.getEventByIdRef).toHaveBeenCalledWith(expect.anything(), { id: "ev-1" });
    expect(firebaseDataConnect.executeMutation).not.toHaveBeenCalled();
  });

  it("hides a guest draft on another task, restores it on Back and remount, then clears it on dismissal", async () => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    prepareRoutedEvent();
    vi.mocked(guestCall).mockResolvedValue({
      event: { id: "ev-1", title: "Managed Dinner", bookingEndDateTime: "2030-02-28T00:00:00Z" }, guests: [],
      ticketTypes: [{ id: "organiser-type", title: "Organiser dinner", priceMinor: 2000, includesDinner: true, includesSymposium: false }],
    });
    const view = canonicalManager("/sections/section-1/manage/events/ev-1?task=guests");
    try {
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Add guest" }));
      fireEvent.change(screen.getByRole("textbox", { name: "First name" }), { target: { value: "Unsent" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Last name" }), { target: { value: "Guest draft" } });
      expect(unloadBlocked()).toBe(true);
      await act(async () => managerNavigation("/sections/section-1/manage/events/ev-1?task=payments"));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      expect(screen.getByRole("heading", { name: "Payments" })).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "First name" })).not.toBeInTheDocument();
      await act(async () => managerNavigation(-1));
      expect(await screen.findByRole("textbox", { name: "First name" })).toHaveValue("Unsent");
      expect(screen.getByRole("textbox", { name: "Last name" })).toHaveValue("Guest draft");
      await act(async () => managerNavigation("/elsewhere"));
      await act(async () => managerNavigation(-1));
      expect(await screen.findByRole("textbox", { name: "First name" })).toHaveValue("Unsent");
      expect(screen.getByRole("textbox", { name: "Last name" })).toHaveValue("Guest draft");
      await user.click(within(screen.getByRole("dialog", { name: "Add guest" })).getByRole("button", { name: "Back" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
      expect(unloadBlocked()).toBe(false);
      await user.click(screen.getByRole("button", { name: "Add guest" }));
      expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue("");
      expect(screen.getByRole("textbox", { name: "Last name" })).toHaveValue("");
      expect(vi.mocked(guestCall).mock.calls.every(([name]) => name === "getOrganiserGuestList")).toBe(true);
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

  it("saves inline details once and updates the event header only after the authoritative detail read", async () => {
    const event = prepareRoutedEvent();
    const updated = { ...event, title: "Server-confirmed dinner" };
    let finishDetail!: (value: unknown) => void;
    const detailRead = new Promise(resolve => { finishDetail = resolve; });
    vi.mocked(firebaseDataConnect.executeQuery).mockImplementation(async (ref) => {
      if (ref.name === "GetEventsForSection") {
        mockGetEventsForSection({ data: { section: { id: sectionId, events: [updated] } }, isLoading: false, isError: false });
        return { data: { section: { id: sectionId, events: [updated] } } } as never;
      }
      if (ref.name === "GetEventById") {
        const result = await detailRead;
        mockGetEventById({ data: { event: updated }, isLoading: false, isError: false });
        return result as never;
      }
      return { data: null } as never;
    });
    canonicalManager("/sections/section-1/manage/events/ev-1?task=details");
    const user = userEvent.setup();
    fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), { target: { value: updated.title } });
    expect(screen.getByRole("heading", { level: 1, name: event.title })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(generated.getEventByIdRef).toHaveBeenCalledWith(expect.anything(), { id: "ev-1" }));
    expect(generated.updateEventRef).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: event.title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: updated.title })).not.toBeInTheDocument();
    await act(async () => { finishDetail({ data: { event: updated } }); await detailRead; });
    expect(await screen.findByRole("heading", { level: 1, name: updated.title })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
  }, 20_000);

  it("refuses an event absent from the authoritative section list before enabling private management reads", () => {
    canonicalManager("/sections/section-1/manage/events/forged");
    expect(screen.getByText(/Event unavailable in this section/)).toBeInTheDocument();
    expect(reactGenerated.useGetEventById).toHaveBeenCalledWith(expect.anything(),{id:"forged"},{enabled:false});
    expect(reactGenerated.useListEventBookingsForAdmin).toHaveBeenCalledWith(expect.anything(),{eventId:"forged"},{enabled:false});
    expect(screen.queryByRole("button",{name:"Add ticket type"})).not.toBeInTheDocument();
  });

  it("does not render a mismatched event returned for another section", () => {
    mockGetEventsForSection({data:{section:{id:sectionId,events:[{id:"ev-1",title:"Event"}]}},isLoading:false,isError:false});
    mockGetEventById({data:{event:{id:"ev-1",section:{id:"other"},title:"Wrong section private title",ticketTypes:[]}},isLoading:false,isError:false});
    canonicalManager("/sections/section-1/manage/events/ev-1");
    expect(screen.getByText(/Event unavailable in this section/)).toBeInTheDocument();
    expect(screen.queryByText(/Wrong section private title/)).not.toBeInTheDocument();
  });

  it("restores a new-event form after leaving its resource and browser back, then clears it on Cancel", async () => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({lifecycle:owner,retire:()=>owner.retire(),signOut:async()=>owner.retire()});
    const view = canonicalManager("/sections/section-1/manage/events?edit=new-event");
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i),{target:{value:"Unsent event draft"}});
      await act(async () => managerNavigation("/elsewhere"));
      expect(screen.getByText("Elsewhere")).toBeInTheDocument();
      await act(async () => managerNavigation(-1));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Unsent event draft");
      await user.click(screen.getByRole("button",{name:"Cancel"}));
      await user.click(await screen.findByRole("link",{name:"Add event"}));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("");
    } finally { view.unmount(); uninstall(); }
  },20_000);

  it("opens a ticket editor from its cold URL and rejects missing ticket IDs", async () => {
    const event = {id:"ev-1",section:{id:sectionId},title:"Event",ticketTypes:[{id:"ticket-1",title:"Member dinner",price:25,sortOrder:0,audience:generated.TicketAudience.MEMBER,includesDinner:true,includesSymposium:false,userGroup:{id:"group-1",name:"Members"}}]};
    mockGetEventsForSection({data:{section:{id:sectionId,events:[event]}},isLoading:false,isError:false});
    mockGetEventById({data:{event},isLoading:false,isError:false});
    const view = canonicalManager("/sections/section-1/manage/events/ev-1?task=tickets&ticket=ticket-1");
    expect(await screen.findByLabelText(/^title/i)).toHaveValue("Member dinner");
    view.unmount();
    canonicalManager("/sections/section-1/manage/events/ev-1?task=tickets&ticket=foreign");
    expect(screen.getByText("Ticket type unavailable in this event.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },20_000);

  it("matches compact server event and section UUIDs to uppercase hyphenated direct URLs", () => {
    const sid="AABBCCDD-1111-4222-8333-ABCDEF123456";
    const eid="EEFF0011-2222-4333-8444-ABCDEF654321";
    const event={id:eid.replaceAll("-","").toLowerCase(),section:{id:sid.replaceAll("-","").toLowerCase()},title:"Mixed format event",ticketTypes:[],maxGuestsWithoutModeratorApproval:0};
    mockGetEventsForSection({data:{section:{id:event.section.id,events:[event]}},isLoading:false,isError:false});
    mockGetEventById({data:{event},isLoading:false,isError:false});
    canonicalManager(`/sections/${sid}/manage/events/${eid}?task=tickets`);
    expect(screen.getByRole("heading",{level:1,name:"Mixed format event"})).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"Add ticket type"})).toHaveAttribute("href",`/sections/${sid.toLowerCase()}/manage/events/${eid.toLowerCase()}?task=tickets&ticket=new`);
    expect(reactGenerated.useGetEventById).toHaveBeenCalledWith(expect.anything(),{id:eid},{enabled:true});
  });

  it("keeps exactly one event create while leaving, returning pending, then completing away", async () => {
    const owner=createSessionLifecycle(); owner.observe("admin");
    const uninstall=installSessionRuntime({lifecycle:owner,retire:()=>owner.retire(),signOut:async()=>owner.retire()});
    let complete!:(value:unknown)=>void;
    const pending=new Promise(resolve=>{complete=resolve});
    vi.mocked(firebaseDataConnect.executeMutation).mockReturnValueOnce(pending as never);
    const view=canonicalManager("/sections/section-1/manage/events?edit=new-event");
    try {
      const user=userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i),{target:{value:"Pending one event"}});
      await user.click(screen.getByRole("button",{name:"Save"}));
      await waitFor(()=>expect(generated.createEventRef).toHaveBeenCalledOnce());
      await act(async()=>managerNavigation("/elsewhere"));
      await act(async()=>managerNavigation(-1));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Pending one event");
      expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
      expect(screen.getByText(/This save is still being confirmed/)).toBeInTheDocument();
      expect(generated.createEventRef).toHaveBeenCalledOnce();
      await act(async()=>managerNavigation(1));
      await act(async()=>{complete({data:{event_insert:{id:"created-event"}}});await pending;});
      expect(screen.getByText("Elsewhere")).toBeInTheDocument();
      await act(async()=>managerNavigation(-1));
      expect(await screen.findByText(/The previous save completed/)).toBeInTheDocument();
      expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
      await user.click(screen.getByRole("button",{name:"Load saved change"}));
      expect(await screen.findByRole("link",{name:"Add event"})).toBeInTheDocument();
      expect(generated.createEventRef).toHaveBeenCalledOnce();
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
    } finally {view.unmount();uninstall();}
  },20_000);

  it("does not close a different editor when an old update completes", async () => {
    const event={id:"ev-1",section:{id:sectionId},title:"Original event",startDateTime:"2030-03-01T18:00:00Z",endDateTime:"2030-03-01T22:00:00Z",bookingStartDateTime:"2030-01-01T00:00:00Z",bookingEndDateTime:"2030-02-28T00:00:00Z",maxGuestsWithoutModeratorApproval:0,ticketTypes:[]};
    mockGetEventsForSection({data:{section:{id:sectionId,events:[event]}},isLoading:false,isError:false});
    mockGetEventById({data:{event},isLoading:false,isError:false});
    let complete!:(value:unknown)=>void;
    const pending=new Promise(resolve=>{complete=resolve});
    vi.mocked(firebaseDataConnect.executeMutation).mockReturnValueOnce(pending as never);
    canonicalManager("/sections/section-1/manage/events/ev-1?edit=event");
    const user=userEvent.setup();
    fireEvent.change(await screen.findByLabelText(/^title/i),{target:{value:"Saved old edit"}});
    await user.click(screen.getByRole("button",{name:"Save"}));
    await act(async()=>managerNavigation("/sections/section-1/manage/events?edit=new-event"));
    fireEvent.change(await screen.findByLabelText(/^title/i),{target:{value:"Newer unsaved event"}});
    await act(async()=>{complete({});await pending;});
    expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer unsaved event");
    expect(screen.getByText("/sections/section-1/manage/events?edit=new-event")).toBeInTheDocument();
    expect(screen.queryByText(/The previous save completed/)).not.toBeInTheDocument();
  },20_000);

  it("retains an uncertain create failure until explicit latest-list review instead of replaying", async () => {
    const owner=createSessionLifecycle();owner.observe("admin");
    const uninstall=installSessionRuntime({lifecycle:owner,retire:()=>owner.retire(),signOut:async()=>owner.retire()});
    let fail!:(error:Error)=>void;
    const pending=new Promise((_resolve,reject)=>{fail=reject});
    vi.mocked(firebaseDataConnect.executeMutation).mockReturnValueOnce(pending as never);
    const view=canonicalManager("/sections/section-1/manage/events?edit=new-event");
    try {
      const user=userEvent.setup();fireEvent.change(await screen.findByLabelText(/^title/i),{target:{value:"Unconfirmed create"}});
      await user.click(screen.getByRole("button",{name:"Save"}));
      await act(async()=>managerNavigation("/elsewhere"));
      await act(async()=>{fail(new Error("Network timeout"));await pending.catch(()=>{});});
      expect(screen.getByText("Elsewhere")).toBeInTheDocument();
      await act(async()=>managerNavigation(-1));
      expect(await screen.findByText(/The previous save could not be confirmed/)).toBeInTheDocument();
      expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
      expect(generated.createEventRef).toHaveBeenCalledOnce();
      vi.mocked(firebaseDataConnect.executeQuery).mockResolvedValue({ data: { section: { id: sectionId, events: [] } } } as never);
      await user.click(screen.getByRole("button",{name:"Check latest list"}));
      const review = await screen.findByRole("dialog",{name:"Start a new save request?"});
      expect(generated.createEventRef).toHaveBeenCalledOnce();
      await user.click(within(review).getByRole("button", { name: "I checked — start a new request" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Start a new save request?", hidden: true })).not.toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Unconfirmed create");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
      expect(unloadBlocked()).toBe(true);
    } finally {view.unmount();uninstall();}
  },20_000);

  it("keeps exactly one ticket create across a pending leave/back and reconciles its saved receipt", async () => {
    const owner=createSessionLifecycle();owner.observe("admin");
    const uninstall=installSessionRuntime({lifecycle:owner,retire:()=>owner.retire(),signOut:async()=>owner.retire()});
    const event={id:"ev-1",section:{id:sectionId},title:"Event",ticketTypes:[],maxGuestsWithoutModeratorApproval:0};
    mockGetEventsForSection({data:{section:{id:sectionId,events:[event]}},isLoading:false,isError:false});
    mockGetEventById({data:{event},isLoading:false,isError:false});
    vi.mocked(firebaseDataConnect.executeQuery).mockResolvedValue({data:{userGroups:[{id:"group-1",name:"Members"}]}} as never);
    let complete!:(value:unknown)=>void;
    const pending=new Promise(resolve=>{complete=resolve});
    vi.mocked(firebaseDataConnect.executeMutation).mockReturnValueOnce(pending as never);
    const view=canonicalManager("/sections/section-1/manage/events/ev-1?task=tickets&ticket=new");
    try {
      const user=userEvent.setup();fireEvent.change(await screen.findByLabelText(/^title/i),{target:{value:"Pending ticket"}});
      await user.click(screen.getByRole("combobox",{name:/access group/i}));
      await user.click(await screen.findByRole("option",{name:"Members"}));
      await user.click(screen.getByRole("button",{name:"Save"}));
      await waitFor(()=>expect(generated.createTicketTypeRef).toHaveBeenCalledOnce());
      await act(async()=>managerNavigation("/elsewhere"));
      await act(async()=>managerNavigation(-1));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Pending ticket");
      expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
      expect(generated.createTicketTypeRef).toHaveBeenCalledOnce();
      await act(async()=>managerNavigation(1));
      await act(async()=>{complete({});await pending;});
      expect(screen.getByText("Elsewhere")).toBeInTheDocument();
      await act(async()=>managerNavigation(-1));
      expect(await screen.findByText(/The previous save completed/)).toBeInTheDocument();
      await user.click(screen.getByRole("button",{name:"Load saved change"}));
      // Navigation closes the editor before MUI removes its exiting portal and
      // accessibility mask. Wait for that transition before querying the page.
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument(), { timeout: 5000 });
      expect(await screen.findByRole("link",{name:"Add ticket type"})).toBeInTheDocument();
      expect(generated.createTicketTypeRef).toHaveBeenCalledOnce();
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
    } finally {view.unmount();uninstall();}
  },20_000);

  it.each(["event", "ticket"] as const)("clears a found %s save receipt and draft only after successful list review without another mutation", async (kind) => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const savedTitle = `Saved ${kind} after timeout`;
    const event = { id: "ev-1", section: { id: sectionId }, title: kind === "event" ? savedTitle : "Owned event", ticketTypes: [], maxGuestsWithoutModeratorApproval: 0 };
    mockGetEventsForSection({ data: { section: { id: sectionId, events: [event] } }, isLoading: false, isError: false });
    mockGetEventById({ data: { event }, isLoading: false, isError: false });
    let reviewFailure: "error" | "missing" | null = null;
    let reviews = 0;
    vi.mocked(firebaseDataConnect.executeQuery).mockImplementation(async (ref) => {
      const name = (ref as { name?: string }).name;
      if (name === (kind === "event" ? "GetEventsForSection" : "GetEventById")) {
        reviews += 1;
        if (reviewFailure === "error") throw new Error("Latest list unavailable");
        if (reviewFailure === "missing") return { data: null } as never;
      }
      return { data: name === "GetEventsForSection" ? { section: { id: sectionId, events: [event] } }
        : name === "GetEventById" ? { event: { ...event, ticketTypes: [{ id: "saved-ticket", title: savedTitle }] } }
        : { userGroups: [{ id: "group-1", name: "Members" }] } } as never;
    });
    vi.mocked(firebaseDataConnect.executeMutation).mockRejectedValueOnce(new Error("Response lost after server commit"));
    const url = kind === "event" ? "/sections/section-1/manage/events?edit=new-event" : "/sections/section-1/manage/events/ev-1?task=tickets&ticket=new";
    const view = canonicalManager(url);
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: savedTitle } });
      if (kind === "ticket") {
        await user.click(screen.getByRole("combobox", { name: /access group/i }));
        await user.click(await screen.findByRole("option", { name: "Members" }));
      }
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText(/The previous save could not be confirmed/);
      expect(unloadBlocked()).toBe(true);
      await act(async () => managerNavigation("/elsewhere"));
      expect(unloadBlocked()).toBe(true);
      await act(async () => managerNavigation(-1));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue(savedTitle);
      for (const failure of ["error", "missing"] as const) {
        reviewFailure = failure;
        const before = reviews;
        await user.click(screen.getByRole("button", { name: "Check latest list" }));
        await waitFor(() => expect(reviews).toBe(before + 1));
        expect(screen.queryByRole("button", { name: "I found the saved change — close this draft" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        expect(unloadBlocked()).toBe(true);
      }
      reviewFailure = null;
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      const review = await screen.findByRole("dialog", { name: "Start a new save request?" });
      expect(within(review).getByText(savedTitle)).toBeInTheDocument();
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
      await user.click(within(review).getByRole("button", { name: "I found the saved change — close this draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument(), { timeout: 5000 });
      expect(unloadBlocked()).toBe(false);
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
      await act(async () => managerNavigation(url));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("");
      expect(screen.queryByText(/The previous save could not be confirmed/)).not.toBeInTheDocument();
      expect(unloadBlocked()).toBe(false);
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "A separate unsent draft" } });
      if (kind === "ticket") {
        await user.click(screen.getByRole("combobox", { name: /access group/i }));
        await user.click(await screen.findByRole("option", { name: "Members" }));
      }
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument(), { timeout: 5000 });
      await act(async () => managerNavigation("/elsewhere"));
      expect(unloadBlocked()).toBe(false);
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

  it("ignores a deferred review after leaving and returning while preserving another editor's draft", async () => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const event = { id: "ev-1", section: { id: sectionId }, title: "Existing event", ticketTypes: [], maxGuestsWithoutModeratorApproval: 0 };
    mockGetEventsForSection({ data: { section: { id: sectionId, events: [event] } }, isLoading: false, isError: false });
    mockGetEventById({ data: { event }, isLoading: false, isError: false });
    vi.mocked(firebaseDataConnect.executeMutation).mockRejectedValueOnce(new Error("Uncertain create"));
    let complete!: (data: unknown) => void;
    const latest = new Promise(resolve => { complete = resolve; });
    vi.mocked(firebaseDataConnect.executeQuery).mockReturnValueOnce(latest as never);
    const firstUrl = "/sections/section-1/manage/events?edit=new-event";
    const otherUrl = "/sections/section-1/manage/events/ev-1?edit=event";
    const view = canonicalManager(firstUrl);
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Original uncertain draft" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText(/The previous save could not be confirmed/);
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      await waitFor(() => expect(firebaseDataConnect.executeQuery).toHaveBeenCalledOnce());
      await act(async () => managerNavigation(otherUrl));
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Another editor's unsent changes" } });
      await act(async () => managerNavigation(-1));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Original uncertain draft");
      await act(async () => { complete({ data: { section: { id: sectionId, events: [event] } } }); await latest; });
      expect(screen.queryByRole("dialog", { name: "Start a new save request?" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(unloadBlocked()).toBe(true);
      await act(async () => managerNavigation(otherUrl));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Another editor's unsent changes");
      expect(firebaseDataConnect.executeMutation).toHaveBeenCalledOnce();
    } finally { view.unmount(); owner.retire(); uninstall(); }
  }, 20_000);

});
