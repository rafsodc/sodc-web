import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, type DataConnect } from "firebase/data-connect";
import { BookingApprovalStatus, BookingStatus, MembershipStatus, TicketAudience, getMyBookingsRef, getEventByIdRef, getEventsForSectionRef, getUserGroupByIdRef, listUserGroupsRef, listEventBookingsForAdminRef } from "@dataconnect/generated";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test-utils";
import UserGroups from "../UserGroups";
import SectionEventsManager from "../SectionEventsManager";
import type { EventBookingAdminRow, TicketTypeRow } from "../sectionEventsManagerTypes";
import { reviewBookingRevision, submitEventBooking } from "../../../../shared/utils/firebaseFunctions";
import { dataConnectQueryOptions } from "../../../../shared/query/authoritativeDataConnect";
import { useGetMyBookings } from "../../../../shared/query/authoritativeHooks";
import { guestCall } from "../../../guests/api";

// Real installed SDK cache, real query refs, real app hooks and rendered MUI
// controls. Only the network transport/callables are replaced with memory state.
vi.unmock("firebase/data-connect");
const context = vi.hoisted(() => ({ dc: undefined as unknown as DataConnect }));
vi.mock("../../../../config/firebase", () => ({
  get dataConnect() { return context.dc; }, auth: { currentUser: { uid: "admin" } }, functions: {},
}));
vi.mock("../../../users/hooks/useAdminClaim", () => ({ useAdminClaim: () => true }));
vi.mock("../../../users/utils/searchUsers", () => ({ searchUsers: vi.fn() }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reviewBookingRevision: vi.fn(), submitEventBooking: vi.fn(), getSectionMembersMerged: vi.fn().mockResolvedValue({ members: [] }),
  getSectionMemberNamesByIds: vi.fn().mockResolvedValue({users:[]}),
}));
vi.mock("../../../guests/api", () => ({
  guestCall: vi.fn(), money: (value: number) => String(value), paymentLabel: (value: string) => value,
}));

type Group = { id: string; name: string; description: string | null; membershipStatuses: never[]; createdAt: string; updatedAt: string };
const group = (id: string, name: string): Group => ({ id, name, description: null, membershipStatuses: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" });
const event = {
  id: "event-1", title: "Annual Dinner", location: "Hall", details: null, sponsors: null, guestOfHonour: null,
  startDateTime: "2030-03-01T18:00:00Z", endDateTime: "2030-03-01T22:00:00Z",
  bookingStartDateTime: "2030-02-01T00:00:00Z", bookingEndDateTime: "2030-02-28T23:59:59Z", maxGuestsWithoutModeratorApproval: 1,
};
const ticket = (id: string, title: string): TicketTypeRow => ({
  id, title, description: "Dinner", price: 25, sortOrder: 0, audience: TicketAudience.MEMBER,
  includesDinner: true, includesSymposium: false, userGroup: { id: "members", name: "Members", membershipStatuses: [] },
});
const booking = (approvalStatus = BookingApprovalStatus.APPROVED): EventBookingAdminRow => ({
  id: "booking-1", status: BookingStatus.SUBMITTED, approvalStatus, accommodationRequested: false, revisionGroupId: "revision-1", revisionNumber: 1,
  supersededAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", createdBy: "member-1", updatedBy: "member-1",
  booker: { id: "member-1", firstName: "Alex", lastName: "Member", email: "alex@example.invalid", membershipStatus: MembershipStatus.REGULAR, rank: null },
  lines: [{ id: "line-1", sortOrder: 0, guestDisplayName: null, dietaryNote: "Before dietary", ticketType: ticket("type-1", "Dinner"),
    bookingPlace: { id: "place-1", attendanceRemoved: false, attendanceVersion: 1, paymentAllocations: [] } }],
});
let app: FirebaseApp;
let queryClient: QueryClient;
let groups: Group[];
let ticketTypes: TicketTypeRow[];
let bookings: EventBookingAdminRow[];
let failingWrite: boolean;
let eventExists: boolean;
let failReadsAfterWrite: string | null;
let failingRead: string | null;
let nextApp = 0;
const read = vi.fn();
const write = vi.fn();
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function view(screenName: "groups" | "event" | "events", key: string = screenName) {
  return <QueryClientProvider client={queryClient}><MemoryRouter>
    {screenName === "groups" ? <UserGroups key={key} onBack={vi.fn()} /> : <SectionEventsManager key={key}
      sectionId="section-1" sectionName="Events" initialEventId={screenName === "event" ? "event-1" : undefined} onBack={vi.fn()} />}
  </MemoryRouter></QueryClientProvider>;
}

function MemberBookingSnapshot() {
  const { data } = useGetMyBookings(context.dc);
  return <p>Member booking: {data?.user?.bookings[0]?.approvalStatus}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  groups = [group("members", "Members")]; ticketTypes = [ticket("type-1", "Dinner")]; bookings = [];
  eventExists = true; failingWrite = false; failingRead = null; failReadsAfterWrite = null;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  app = initializeApp({ projectId: "offline-freshness", apiKey: "fake" }, `admin-freshness-${nextApp++}`);
  context.dc = getDataConnect(app, { service: "offline", connector: "offline", location: "europe-west2" });
  read.mockImplementation(async (name: string, variables: Record<string, unknown>) => {
    if (name === failingRead) throw new Error("Read unavailable");
    let data: unknown;
    switch (name) {
      case "ListUserGroups": data = { userGroups: groups }; break;
      case "ListSectionTicketAccessGroups": data = {userGroups:groups.map(({id,name})=>({id,name}))}; break;
      case "ListUsers": data = { users: [] }; break;
      case "GetUserGroupById": data = { userGroup: groups.some((row) => row.id === variables.id)
        ? { ...groups.find((row) => row.id === variables.id), users: [], purposeLinks: [] } : null }; break;
      case "GetEventsForSection": data = { section: { id: "section-1", events: eventExists ? [event] : [] } }; break;
      case "GetEventById": data = { event: eventExists ? { ...event, ticketTypes } : null }; break;
      case "ListEventBookingsForAdmin": data = { event: { id: event.id, bookings, bookingTicketOrders: [] } }; break;
      case "ListTicketOrdersForAdmin": data = { event: { id: event.id, ticketOrders: [] } }; break;
      case "ListBookingPaymentAdjustmentsForAdmin": data = { event: { id: event.id, bookings: [] } }; break;
      case "ListUserNamesByIds": data = { users: [] }; break;
      case "GetMyBookings": data = { user: { id: "admin", bookings } }; break;
      default: throw new Error(`Unmodelled read ${name}`);
    }
    return { data: copy(data), extensions: {} };
  });
  write.mockImplementation(async (name: string, variables: Record<string, unknown>) => {
    if (failingWrite) throw new Error("Write rejected");
    if (name === "CreateUserGroup") groups.push({ ...group("created-group", String(variables.name)), description: String(variables.description ?? "") });
    if (name === "UpdateUserGroup") groups = groups.map((row) => row.id === variables.id ? { ...row, name: String(variables.name), description: String(variables.description ?? "") } : row);
    if (name === "CreateTicketType") ticketTypes.push({ ...ticket("created-type", String(variables.title)), price: Number(variables.price) });
    if (name === "UpdateTicketType") ticketTypes = ticketTypes.map((row) => row.id === variables.id ? { ...row, title: String(variables.title), price: Number(variables.price) } : row);
    if (name === "DeleteUserGroup") groups = groups.filter((row) => row.id !== variables.id);
    if (name === "DeleteTicketType") ticketTypes = ticketTypes.filter((row) => row.id !== variables.id);
    if (name === "DeleteEvent") eventExists = false;
    failingRead = failReadsAfterWrite;
    return { data: {}, extensions: {} };
  });
  (context.dc as DataConnect & { _transportClass: unknown })._transportClass = class {
    invokeQuery = read; invokeMutation = write; _setCallerSdkType() { /* local SDK metadata only */ }
  };
  vi.mocked(guestCall).mockImplementation(async () => ({ event: {}, guests: [], ticketTypes: [] }) as never);
});

afterEach(async () => { queryClient.clear(); await deleteApp(app); vi.restoreAllMocks(); });

async function openCreateGroup() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Create User Group" }));
  await user.type(screen.getByRole("textbox", { name: /Group Name/ }), "New Group");
  return user;
}
async function waitForDialogToClose() {
  // The saved rows may render behind MUI's exiting modal before its controls
  // become accessible. Wait for that real transition before the next action.
  await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument(), { timeout: 5000 });
}
async function openCreateTicket() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ticket types" }));
  await user.click(screen.getByRole("button", { name: "Add ticket type" }));
  await user.click(screen.getByRole("combobox", { name: /access group/i }));
  await user.click(await screen.findByRole("option", { name: "Members" }));
  fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "New ticket" } });
  return user;
}

describe("rendered administration freshness with the installed SDK cache", () => {
  it("creates, selects and edits a group immediately, and reads server state on a later visit", async () => {
    await executeQuery(listUserGroupsRef(context.dc));
    await executeQuery(getUserGroupByIdRef(context.dc, { id: "created-group" }));
    const rendered = render(view("groups"));
    const user = await openCreateGroup();
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("New Group")).toBeInTheDocument();
    await waitForDialogToClose();
    await user.click(await screen.findByRole("button", { name: "Expand New Group" }));
    expect((await screen.findAllByRole("button", { name: "Add User" })).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Edit New Group" }));
    expect(screen.getByRole("textbox", { name: /Group Name/ })).toHaveValue("New Group");
    fireEvent.change(screen.getByRole("textbox", { name: /Group Name/ }), { target: { value: "Edited Group" } });
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(await screen.findByText("Edited Group")).toBeInTheDocument();
    expect((await executeQuery(listUserGroupsRef(context.dc))).data.userGroups.map((row) => row.name)).toContain("Edited Group");
    rendered.unmount();
    groups = groups.map((row) => row.id === "created-group" ? { ...row, name: "Changed elsewhere" } : row);
    render(view("groups"));
    expect(await screen.findByText("Changed elsewhere")).toBeInTheDocument();
    expect(screen.queryByText("Edited Group")).not.toBeInTheDocument();
    expect(write.mock.calls.map(([name]) => name)).toEqual(["CreateUserGroup", "UpdateUserGroup"]);
  }, 30_000);

  it("keeps the newest list loading state and ignores an obsolete load failure when creating during the initial read", async () => {
    const originalRead = read.getMockImplementation()!;
    const pending: Array<(value: {data: unknown; extensions: object}) => void> = [];
    read.mockImplementation((name: string, variables: Record<string, unknown>) => name === "ListUserGroups"
      ? new Promise(resolve => { pending.push(resolve); }) : originalRead(name, variables));
    render(view("groups"));
    const user = await openCreateGroup();
    await waitFor(() => expect(pending).toHaveLength(1));
    await user.click(screen.getByRole("button", {name: "Create"}));
    await waitFor(() => expect(pending).toHaveLength(2));
    await waitForDialogToClose();
    const loadingWhileLatestPending = screen.queryByRole("progressbar") !== null;
    await act(async () => { pending[1]({data: {userGroups: copy(groups)}, extensions: {}}); });
    expect(await screen.findByText("New Group")).toBeInTheDocument();
    await act(async () => { pending[0]({data: {userGroups: [group("members", "Members")]}, extensions: {}}); });
    expect(screen.queryByText("We could not complete the user group operation. Please refresh and try again.")).not.toBeInTheDocument();
    expect(screen.getByText("New Group")).toBeInTheDocument();
    expect(loadingWhileLatestPending).toBe(true);
    expect(write).toHaveBeenCalledOnce();
  }, 30_000);

  it.each(["success", "failure"])("keeps the newest group detail spinner and truthful refresh state when an edit supersedes an expansion read, latest=%s", async latest => {
    const originalRead = read.getMockImplementation()!;
    const pending: Array<{resolve: (value: {data: unknown; extensions: object}) => void; reject: (error: Error) => void}> = [];
    read.mockImplementation((name: string, variables: Record<string, unknown>) => name === "GetUserGroupById"
      ? new Promise((resolve, reject) => { pending.push({resolve, reject}); }) : originalRead(name, variables));
    render(view("groups"));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", {name: "Expand Members"}));
    await waitFor(() => expect(pending).toHaveLength(1));
    await user.click(screen.getByRole("button", {name: "Edit Members"}));
    fireEvent.change(screen.getByRole("textbox", {name: /Group Name/}), {target: {value: "Updated Members"}});
    await user.click(screen.getByRole("button", {name: "Update"}));
    await waitFor(() => expect(pending).toHaveLength(2));
    await waitForDialogToClose();
    const loadingWhileLatestPending = (await screen.findByRole("button", {name: "Collapse Updated Members"}) as HTMLButtonElement).disabled;
    await act(async () => {
      if (latest === "success") pending[1].resolve({data: {userGroup: {...groups[0], users: [], purposeLinks: []}}, extensions: {}});
      else pending[1].reject(new Error("Newest detail read unavailable"));
    });
    if (latest === "success") expect(await screen.findByText("No users assigned to this group.")).toBeInTheDocument();
    else {
      expect(await screen.findByText(/User group updated.*already saved/)).toBeInTheDocument();
      expect(screen.queryByText("User group updated")).not.toBeInTheDocument();
    }
    await act(async () => { pending[0].resolve({data: {userGroup: {...group("members", "Obsolete Members"), users: [], purposeLinks: []}}, extensions: {}}); });
    expect(screen.queryByText("We could not complete the user group operation. Please refresh and try again.")).not.toBeInTheDocument();
    expect(loadingWhileLatestPending).toBe(true);
    if (latest === "failure") {
      expect(screen.getByText(/User group updated.*already saved/)).toBeInTheDocument();
      read.mockImplementation(originalRead);
      await user.click(screen.getByRole("button", {name: "Retry refresh"}));
      expect(await screen.findByText("No users assigned to this group.")).toBeInTheDocument();
      expect(screen.queryByText(/already saved/)).not.toBeInTheDocument();
    }
    expect(write).toHaveBeenCalledOnce();
  }, 30_000);

  it("retains a failed group draft and never adds a phantom group", async () => {
    render(view("groups")); const user = await openCreateGroup(); failingWrite = true;
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeEnabled());
    expect(screen.getByRole("textbox", { name: /Group Name/ })).toHaveValue("New Group");
    expect(groups.map((row) => row.name)).toEqual(["Members"]);
    expect(screen.queryByRole("button", { name: "Expand New Group" })).not.toBeInTheDocument();
    failingWrite = false;
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("New Group")).toBeInTheDocument();
  }, 30_000);

  it("reports a saved group whose refresh failed and retries only the read", async () => {
    render(view("groups")); const user = await openCreateGroup(); failReadsAfterWrite = "ListUserGroups";
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText(/User group created.*already saved/)).toBeInTheDocument();
    await waitForDialogToClose();
    expect(groups.some((row) => row.name === "New Group")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(await screen.findByText(/User group created.*already saved/)).toBeInTheDocument();
    expect(screen.queryByText(/Group data refreshed/)).not.toBeInTheDocument();
    expect(write).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry refresh" })).toBeEnabled());
    failingRead = null;
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(await screen.findByText("New Group")).toBeInTheDocument();
    expect(write).toHaveBeenCalledOnce();
  }, 30_000);

  it("renders ticket creation, update, reopened fields and deletion from confirmed server state across visits", async () => {
    await executeQuery(getEventByIdRef(context.dc, { id: event.id }));
    await executeQuery(getEventsForSectionRef(context.dc, { sectionId: "section-1" }));
    const rendered = render(view("event")); const user = await openCreateTicket();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitForDialogToClose();
    expect(await screen.findByText("New ticket")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Edit New ticket" }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Updated ticket" } });
    fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: "42" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitForDialogToClose();
    expect(await screen.findByText("Updated ticket")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Edit Updated ticket" }));
    expect(screen.getByLabelText(/^title/i)).toHaveValue("Updated ticket");
    expect(screen.getByLabelText(/^price/i)).toHaveValue(42);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitForDialogToClose();
    await user.click(await screen.findByRole("button", { name: "Delete Updated ticket" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete ticket type?" })).getByRole("button", { name: "Delete" }));
    await waitForDialogToClose();
    await waitFor(() => expect(screen.queryByText("Updated ticket")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Edit Dinner" })).toBeInTheDocument();
    rendered.rerender(view("events", "event-list"));
    expect(await screen.findByText("Annual Dinner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: "Ticket types" }));
    expect(screen.getByRole("button", { name: "Edit Dinner" })).toBeInTheDocument();
    expect(screen.queryByText("New ticket")).not.toBeInTheDocument();
    expect(screen.queryByText("Updated ticket")).not.toBeInTheDocument();
    expect(write.mock.calls.map(([name]) => name)).toEqual(["CreateTicketType", "UpdateTicketType", "DeleteTicketType"]);
    expect(read.mock.calls.filter(([name]) => name === "GetEventsForSection").length).toBeGreaterThanOrEqual(4);
    rendered.rerender(view("events", "delete-event-list"));
    const originalRead = read.getMockImplementation()!;
    let completeOldDetail!: (value: { data: unknown; extensions: object }) => void;
    let oldDetailStarted = false;
    read.mockImplementation((name: string, variables: Record<string, unknown>) => {
      if (name === "GetEventById" && !oldDetailStarted) {
        oldDetailStarted = true;
        return new Promise((resolve) => { completeOldDetail = resolve; });
      }
      return originalRead(name, variables);
    });
    const oldDetail = queryClient.fetchQuery({ ...dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })), staleTime: 0 }).catch(() => undefined);
    await waitFor(() => expect(oldDetailStarted).toBe(true));
    await user.click(await screen.findByRole("button", { name: "Delete Annual Dinner" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete event?" })).getByRole("button", { name: "Delete" }));
    await waitForDialogToClose();
    expect(await screen.findByText("No events yet. Add one to get started.")).toBeInTheDocument();
    await act(async () => {
      completeOldDetail({ data: { event: { ...event, ticketTypes } }, extensions: {} });
      await oldDetail;
    });
    expect(queryClient.getQueryState(["GetEventById", { id: event.id }])?.isInvalidated).toBe(true);
    rendered.rerender(view("event", "revisit-deleted-event"));
    expect(await screen.findByRole("heading", { name: "Event admin: Event" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Event admin: Annual Dinner" })).not.toBeInTheDocument();
  }, 30_000);

  it.each([
    { kind: "event", screenName: "events" as const, trigger: "Delete Annual Dinner", dialogTitle: "Delete event?", writeName: "DeleteEvent", readName: "GetEventsForSection", warning: /Event.*deleted.*already saved/ },
    { kind: "ticket type", screenName: "event" as const, trigger: "Delete Dinner", dialogTitle: "Delete ticket type?", writeName: "DeleteTicketType", readName: "GetEventById", warning: /Ticket type deleted.*already saved/ },
    { kind: "user group", screenName: "groups" as const, trigger: "Delete Members", dialogTitle: "Delete user group?", writeName: "DeleteUserGroup", readName: "ListUserGroups", warning: /User group.*deleted.*already saved/ },
  ])("closes a saved $kind deletion before its refresh finishes and retries only failed reads", async ({ kind, screenName, trigger, dialogTitle, writeName, readName, warning }) => {
    // Prime the installed SDK's lower cache before deletion, so recovery must
    // replace a real stale snapshot rather than merely rerender mocked hooks.
    if (screenName === "groups") await executeQuery(listUserGroupsRef(context.dc));
    else {
      await executeQuery(getEventsForSectionRef(context.dc, { sectionId: "section-1" }));
      if (screenName === "event") await executeQuery(getEventByIdRef(context.dc, { id: event.id }));
    }
    render(view(screenName));
    const user = userEvent.setup();
    if (screenName === "event") await user.click(await screen.findByRole("button", { name: "Ticket types" }));
    await user.click(await screen.findByRole("button", { name: trigger }));
    expect(write).not.toHaveBeenCalled();

    const originalRead = read.getMockImplementation()!;
    let rejectSavedRefresh!: (error: Error) => void;
    let refreshStarted = false;
    read.mockImplementation((name: string, variables: Record<string, unknown>) => {
      if (name === readName && failingRead === readName && !refreshStarted) {
        refreshStarted = true;
        return new Promise((_resolve, reject) => { rejectSavedRefresh = reject; });
      }
      return originalRead(name, variables);
    });
    failReadsAfterWrite = readName;
    await user.click(within(screen.getByRole("dialog", { name: dialogTitle })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(refreshStarted).toBe(true));
    await waitForDialogToClose();
    expect(write.mock.calls.map(([name]) => name)).toEqual([writeName]);

    await act(async () => { rejectSavedRefresh(new Error("Saved deletion read unavailable")); });
    expect(await screen.findByText(warning)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(await screen.findByText(warning)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry refresh" })).toBeEnabled());
    expect(write.mock.calls.map(([name]) => name)).toEqual([writeName]);

    failingRead = null;
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry refresh" })).not.toBeInTheDocument());
    if (kind === "event") {
      expect(screen.getByText("No events yet. Add one to get started.")).toBeInTheDocument();
      expect((await executeQuery(getEventsForSectionRef(context.dc, { sectionId: "section-1" }))).data.section?.events).toEqual([]);
    } else if (kind === "ticket type") {
      expect(screen.queryByRole("button", { name: "Edit Dinner" })).not.toBeInTheDocument();
      expect((await executeQuery(getEventByIdRef(context.dc, { id: event.id }))).data.event?.ticketTypes).toEqual([]);
    } else {
      expect(screen.getByText("No user groups found.")).toBeInTheDocument();
      expect((await executeQuery(listUserGroupsRef(context.dc))).data.userGroups).toEqual([]);
    }
    expect(write.mock.calls.map(([name]) => name)).toEqual([writeName]);
  }, 30_000);

  it("keeps failed ticket drafts and revalidates a failed confirmed-write refresh on a later visit", async () => {
    const rendered = render(view("event")); const user = await openCreateTicket(); failingWrite = true;
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/The previous save could not be confirmed/)).toBeInTheDocument();
    expect(screen.getByRole("button", {name:"Save"})).toBeDisabled();
    expect(screen.getByLabelText(/^title/i)).toHaveValue("New ticket");
    expect(ticketTypes.map((row) => row.title)).toEqual(["Dinner"]);
    await user.click(screen.getByRole("button",{name:"Check latest list"}));
    await user.click(within(await screen.findByRole("dialog",{name:"Start a new save request?"})).getByRole("button",{name:"I checked — start a new request"}));
    await waitFor(() => expect(screen.queryByRole("dialog",{name:"Start a new save request?",hidden:true})).not.toBeInTheDocument());
    failingWrite = false; failReadsAfterWrite = "GetEventById";
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText(/Ticket type created.*already saved/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
    await user.click(await screen.findByRole("button", { name: "Load saved change" }));
    expect((await screen.findAllByText(/Saved change loaded.*already saved/)).length).toBeGreaterThan(0);
    expect(write).toHaveBeenCalledTimes(2);
    failingRead = null;
    await user.click(screen.getByRole("button",{name:"Load saved change"}));
    await waitForDialogToClose();
    rendered.rerender(view("events", "revisit-list"));
    await user.click(await screen.findByRole("button", { name: /event admin/i }));
    await user.click(screen.getByRole("button", { name: "Ticket types" }));
    expect(await screen.findByText("New ticket")).toBeInTheDocument();
    expect(write).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("shows confirmed approval and attendance edits after callable writes against primed cached bookings", async () => {
    bookings = [booking(BookingApprovalStatus.PENDING)];
    bookings[0].booker.id = "admin";
    await queryClient.fetchQuery(dataConnectQueryOptions(getMyBookingsRef(context.dc)));
    await executeQuery(listEventBookingsForAdminRef(context.dc, { eventId: event.id }));
    vi.mocked(reviewBookingRevision).mockImplementation(async () => {
      bookings[0].approvalStatus = BookingApprovalStatus.APPROVED;
      return { success: true, bookingId: "booking-1", revisionNumber: 1, approvalStatus: "APPROVED", paymentDelta: null };
    });
    vi.mocked(guestCall).mockImplementation(async (name, request) => {
      if (name === "manageTicketAttendance") {
        bookings[0].lines[0].bookingPlace!.attendanceName = String((request as Record<string, unknown>).attendeeName);
        bookings[0].lines[0].bookingPlace!.attendanceDietaryNote = String((request as Record<string, unknown>).dietaryNote);
      }
      return { event: {}, guests: [], ticketTypes: [] } as never;
    });
    const rendered = render(view("event")); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Booking approvals" }));
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Booking revision approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Current attendee tickets" }));
    await user.click(await screen.findByRole("button", { name: "Edit ticket for Alex Member" }));
    fireEvent.change(screen.getByLabelText("Attendee name"), { target: { value: "Edited Attendee" } });
    fireEvent.change(screen.getByLabelText("Dietary requirements"), { target: { value: "After dietary" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Edited Attendee")).toBeInTheDocument();
    expect(screen.getByText("After dietary")).toBeInTheDocument();
    await waitForDialogToClose();
    expect(vi.mocked(guestCall).mock.calls.filter(([name]) => name === "manageTicketAttendance")).toHaveLength(1);
    rendered.rerender(<QueryClientProvider client={queryClient}><MemberBookingSnapshot /></QueryClientProvider>);
    expect(await screen.findByText("Member booking: APPROVED")).toBeInTheDocument();
    expect(read.mock.calls.filter(([name]) => name === "GetMyBookings")).toHaveLength(3);
  }, 30_000);

  it("retains the edited ticket draft and existing ticket when an update or deletion fails", async () => {
    render(view("event")); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ticket types" }));
    await user.click(await screen.findByRole("button", { name: "Edit Dinner" }));
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Unsaved title" } });
    failingWrite = true;
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/The previous save could not be confirmed/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Save"})).toBeDisabled();
    expect(screen.getByLabelText(/^title/i)).toHaveValue("Unsaved title");
    expect(ticketTypes[0].title).toBe("Dinner");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitForDialogToClose();
    await user.click(await screen.findByRole("button", { name: "Delete Dinner" }));
    const deletionDialog = screen.getByRole("dialog", { name: "Delete ticket type?" });
    await user.click(within(deletionDialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(within(deletionDialog).getByRole("alert")).toBeInTheDocument();
    await user.click(within(deletionDialog).getByRole("button", { name: "Cancel" }));
    await waitForDialogToClose();
    expect(screen.getByRole("button", { name: "Edit Dinner" })).toBeInTheDocument();
    expect(ticketTypes).toHaveLength(1);
    expect(screen.queryByText("Unsaved title")).not.toBeInTheDocument();
  }, 30_000);

  it("refreshes current and removed attendance counts immediately after delete and restore callables", async () => {
    bookings = [booking()];
    await executeQuery(listEventBookingsForAdminRef(context.dc, { eventId: event.id }));
    vi.mocked(guestCall).mockImplementation(async (name, request) => {
      if (name === "manageTicketAttendance") bookings[0].lines[0].bookingPlace!.attendanceRemoved =
        (request as Record<string, unknown>).action === "delete";
      return { event: {}, guests: [], ticketTypes: [] } as never;
    });
    render(view("event")); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Current attendee tickets" }));
    await user.click(await screen.findByRole("button", { name: "Delete ticket for Alex Member" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete ticket?" })).getByRole("button", { name: "Delete ticket" }));
    expect(await screen.findByText("No active attendee tickets in this list.")).toBeInTheDocument();
    await waitForDialogToClose();
    expect(screen.queryByRole("button", { name: "Edit ticket for Alex Member" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Removed tickets (1)" }));
    await user.click(await screen.findByRole("button", { name: "Restore ticket for Alex Member" }));
    await user.click(within(screen.getByRole("dialog", { name: "Restore ticket" })).getByRole("button", { name: "Restore ticket" }));
    await waitForDialogToClose();
    expect(await screen.findByRole("button", { name: "Edit ticket for Alex Member" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 attendees")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Removed tickets (1)" })).not.toBeInTheDocument();
    expect(vi.mocked(guestCall).mock.calls.filter(([name]) => name === "manageTicketAttendance")).toHaveLength(2);
  }, 30_000);

  it("distinguishes a failed approval from a confirmed approval whose read failed and never replays it on refresh", async () => {
    bookings = [booking(BookingApprovalStatus.PENDING)];
    vi.mocked(reviewBookingRevision).mockRejectedValueOnce(new Error("Review rejected"));
    render(view("event")); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Booking approvals" }));
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());
    expect(bookings[0].approvalStatus).toBe("PENDING");
    vi.mocked(reviewBookingRevision).mockImplementation(async () => {
      bookings[0].approvalStatus = BookingApprovalStatus.APPROVED; failingRead = "ListEventBookingsForAdmin";
      return { success: true, bookingId: "booking-1", revisionNumber: 1, approvalStatus: "APPROVED", paymentDelta: null };
    });
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText(/Booking revision approved.*already saved/)).toBeInTheDocument();
    expect(bookings[0].approvalStatus).toBe("APPROVED");
    failingRead = null;
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument());
    expect(reviewBookingRevision).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("closes a saved attendance edit and offers a read-only retry if bookings could not refresh", async () => {
    bookings = [booking()];
    let rejectAttendance = true;
    vi.mocked(guestCall).mockImplementation(async (name) => {
      if (name === "manageTicketAttendance") {
        if (rejectAttendance) throw new Error("Attendance write rejected");
        bookings[0].lines[0].bookingPlace!.attendanceDietaryNote = "Confirmed change";
        failingRead = "ListEventBookingsForAdmin";
      }
      return { event: {}, guests: [], ticketTypes: [] } as never;
    });
    render(view("event")); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Current attendee tickets" }));
    await user.click(await screen.findByRole("button", { name: "Edit ticket for Alex Member" }));
    fireEvent.change(screen.getByLabelText("Dietary requirements"), { target: { value: "Attendance draft" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(screen.getByLabelText("Dietary requirements")).toHaveValue("Attendance draft");
    expect(bookings[0].lines[0].bookingPlace!.attendanceDietaryNote).toBeUndefined();
    rejectAttendance = false;
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Ticket saved.*already saved/)).toBeInTheDocument();
    await waitForDialogToClose();
    failingRead = null;
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(await screen.findByText("Confirmed change")).toBeInTheDocument();
    expect(vi.mocked(guestCall).mock.calls.filter(([name]) => name === "manageTicketAttendance")).toHaveLength(2);
  }, 30_000);


  it("adds an attendee through the booking callable and renders the new cached-booking rows immediately", async () => {
    await executeQuery(listEventBookingsForAdminRef(context.dc, { eventId: event.id }));
    vi.mocked(guestCall).mockImplementation(async (name) => {
      if (name === "searchSectionMembers") return { members: [booking().booker], hasMore: false } as never;
      if (name === "getManagedBookingContext") return { user: booking().booker, ticketTypes, booking: null } as never;
      return { event: {}, guests: [], ticketTypes: [] } as never;
    });
    vi.mocked(submitEventBooking).mockImplementation(async () => { bookings = [booking()]; return { bookingId: "booking-1" } as never; });
    render(view("event")); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Current attendee tickets" }));
    expect(await screen.findByText("No active attendee tickets in this list.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add ticket" }));
    await user.type(screen.getByRole("combobox", { name: "Booking user" }), "Alex");
    await user.click(await screen.findByRole("option", { name: /Alex Member/ }));
    await user.click(await screen.findByRole("button", { name: "Add ticket" }));
    await waitForDialogToClose();
    expect(await screen.findByRole("button", { name: "Edit ticket for Alex Member" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 attendees")).toBeInTheDocument();
    expect(submitEventBooking).toHaveBeenCalledOnce();
  }, 30_000);

});
