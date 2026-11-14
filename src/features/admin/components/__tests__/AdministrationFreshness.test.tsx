import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, type DataConnect } from "firebase/data-connect";
import { BookingApprovalStatus, BookingStatus, MembershipStatus, TicketAudience, getMyBookingsRef, getEventByIdRef, getEventsForSectionRef, getUserGroupByIdRef, listUserGroupsRef, listEventBookingsForAdminRef } from "@dataconnect/generated";
import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test-utils";
import UserGroups from "../UserGroups";
import SectionEventsManager from "../SectionEventsManager";
import type { EventBookingAdminRow, TicketTypeRow } from "../sectionEventsManagerTypes";
import { reviewBookingRevision, submitEventBooking } from "../../../../shared/utils/firebaseFunctions";
import { dataConnectQueryOptions, refreshDataConnectQuery } from "../../../../shared/query/authoritativeDataConnect";
import { captureEventSaveCacheWrite, retireCommittedEventSave } from "../../../../shared/query/eventSaveCache";
import { useGetMyBookings } from "../../../../shared/query/authoritativeHooks";
import { guestCall } from "../../../guests/api";
import { captureSession, createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { beginAuthorizationUpdate } from "../../../../shared/auth/authorizationUpdate";
import { idsEqual } from "../../../../shared/utils/uuid";

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
let navigateManager: ReturnType<typeof useNavigate>;
const read = vi.fn();
const write = vi.fn();
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function view(screenName: "groups" | "event" | "events", key: string = screenName) {
  return <QueryClientProvider client={queryClient}><MemoryRouter>
    {screenName === "groups" ? <UserGroups key={key} onBack={vi.fn()} /> : <SectionEventsManager key={key}
      sectionId="section-1" sectionName="Events" initialEventId={screenName === "event" ? "event-1" : undefined} onBack={vi.fn()} />}
  </MemoryRouter></QueryClientProvider>;
}

function RoutedEventManager() {
  const { eventId } = useParams();
  return <SectionEventsManager sectionId="section-1" sectionName="Events" initialEventId={eventId} routeControlled onBack={vi.fn()} />;
}

function ManagerNavigationProbe() {
  const navigate = useNavigate();
  useEffect(() => { navigateManager = navigate; }, [navigate]);
  return null;
}

function routedEventView(path = "/sections/section-1/manage/events/event-1?task=details") {
  return <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}>
    <ManagerNavigationProbe />
    <Routes><Route path="/sections/:sectionId/manage/events/:eventId" element={<RoutedEventManager />} /><Route path="/sections/:sectionId/manage/events" element={<RoutedEventManager />} /><Route path="/elsewhere" element={<p>Elsewhere</p>} /></Routes>
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
      case "GetEventById": data = { event: eventExists ? { ...event, section: { id: "section-1" }, ticketTypes } : null }; break;
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
    const ticketResult = name === "CreateTicketType" || name === "UpdateTicketType" ? commitTicketCatalog(name, variables) : null;
    if (name === "DeleteUserGroup") groups = groups.filter((row) => row.id !== variables.id);
    if (name === "DeleteTicketType") ticketTypes = ticketTypes.filter((row) => row.id !== variables.id);
    if (name === "DeleteEvent") eventExists = false;
    failingRead = failReadsAfterWrite;
    return ticketResult ?? { data: {}, extensions: {} };
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

// Event-save tests retain the actual SDK, query observers and canonical cache
// helper. The fake transport models committed rows, not client-submitted drafts.
function eventServer(initiallyPresent = true, serverEventId = event.id) {
  let saved = initiallyPresent ? { ...copy(event), id: serverEventId, section: { id: "section-1" }, ticketTypes: copy(ticketTypes), updatedAt: "2026-11-01T12:00:00Z" } : null;
  const originalRead = read.getMockImplementation()!;
  read.mockImplementation(async (name: string, variables: Record<string, unknown>) => {
    if (name === failingRead) throw new Error("Event recovery read unavailable");
    if (name === "GetEventsForSection") return { data: { section: { id: "section-1", events: saved ? [copy(saved)] : [] } }, extensions: {} };
    if (name === "GetEventById") return { data: { event: saved && idsEqual(saved.id, String(variables.id)) ? copy(saved) : null }, extensions: {} };
    return originalRead(name, variables);
  });
  const commit = (name: string, variables: Record<string, unknown>) => {
    const prior = saved ?? { ...copy(event), section: { id: "section-1" }, ticketTypes: [], updatedAt: "2026-11-01T12:00:00Z" };
    saved = { ...prior, ...variables, id: String(variables.id), title: String(variables.title).trim(), updatedAt: "2026-11-01T12:01:00Z" } as typeof prior;
    return { data: { [name === "CreateEvent" ? "event_insert" : "event_update"]: { id: saved.id }, saved: { event: copy(saved) } }, extensions: {} };
  };
  write.mockImplementation(async (name: string, variables: Record<string, unknown>) => commit(name, variables));
  return { commit, current: () => saved };
}
function eventSession() {
  const owner = createSessionLifecycle(); owner.observe("admin");
  const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
  return () => { owner.retire(); uninstall(); };
}

const eventReadCount = () => read.mock.calls.filter(([name]) => name === "GetEventsForSection" || name === "GetEventById").length;

function commitTicketCatalog(name: string, variables: Record<string, unknown>, parent = {
  ...copy(event), section: { id: "section-1" }, ticketTypes: copy(ticketTypes), updatedAt: "2026-11-02T12:00:00Z",
}) {
  const id = String(variables.id ?? "created-type");
  const committed = {
    ...ticket(id, String(variables.title).trim()), description: variables.description == null ? null : String(variables.description),
    price: Number(variables.price), sortOrder: Number(variables.sortOrder ?? 0), audience: variables.audience as TicketAudience,
    includesDinner: Boolean(variables.includesDinner), includesSymposium: Boolean(variables.includesSymposium),
    userGroup: { id: String(variables.userGroupId), name: "Members", membershipStatuses: [] },
    updatedAt: "2026-11-02T12:01:00Z",
  };
  ticketTypes = [...ticketTypes.filter(row => !idsEqual(row.id, id)), committed].sort((a, b) => a.sortOrder - b.sortOrder);
  parent.ticketTypes = copy(ticketTypes);
  return { data: {
    [name === "CreateTicketType" ? "ticketType_insert" : "ticketType_update"]: { id },
    saved: { ticketType: { ...copy(committed), event: { id: parent.id, section: copy(parent.section) } }, event: copy(parent) },
  }, extensions: {} };
}

function ticketCatalogServer() {
  const server = eventServer();
  const commit = (name: string, variables: Record<string, unknown>) => commitTicketCatalog(name, variables, server.current()!);
  write.mockImplementation(async (name: string, variables: Record<string, unknown>) => commit(name, variables));
  return { ...server, commit };
}

async function ticketEditor(kind: "create" | "update") {
  const rendered = render(routedEventView(`/sections/section-1/manage/events/event-1?task=tickets&ticket=${kind === "create" ? "new" : "type-1"}`));
  const user = userEvent.setup();
  await screen.findByLabelText(/^title/i);
  if (kind === "create") {
    await user.click(screen.getByRole("combobox", { name: /access group/i }));
    await user.click(await screen.findByRole("option", { name: "Members" }));
  } else {
    await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue("Dinner"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  }
  return { rendered, user };
}

async function pendingDepartedEventSave(kind: "event" | "ticket" = "event") {
  const server = eventServer();
  let complete!: () => void;
  write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
    complete = () => resolve(kind === "event" ? server.commit(name, variables) : commitTicketCatalog(name, variables, server.current()!));
  }));
  const rendered = render(routedEventView(kind === "event" ? undefined : "/sections/section-1/manage/events/event-1?task=tickets&ticket=type-1"));
  const user = userEvent.setup();
  const title = await screen.findByLabelText(/^title/i);
  await waitFor(() => expect(title).toHaveValue(kind === "event" ? event.title : "Dinner"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  fireEvent.change(title, { target: { value: "Saved after task change" } });
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(write).toHaveBeenCalledOnce());
  await act(async () => navigateManager(kind === "event" ? "?task=tickets" : "?task=details"));
  if (kind === "ticket") await waitForDialogToClose();
  return { server, complete, rendered, user };
}

describe("overlapping routed catalogue saves", () => {
  it("turns a retired cold detail read into an explicit retry instead of leaving the editor loading", async () => {
    const endSession = eventSession();
    const server = eventServer();
    const capturedWrite = captureEventSaveCacheWrite(queryClient, context.dc, { sectionId: "section-1", eventId: event.id });
    const originalRead = read.getMockImplementation()!;
    let completeOldRead!: () => void;
    let held = false;
    read.mockImplementation((name: string, variables: Record<string, unknown>) => {
      if (name === "GetEventById" && !held) {
        held = true;
        const previous = copy(server.current());
        return new Promise(resolve => { completeOldRead = () => resolve({ data: { event: previous }, extensions: {} }); });
      }
      return originalRead(name, variables);
    });
    const rendered = render(routedEventView());
    const user = userEvent.setup();
    try {
      await screen.findByText("Loading event details…");
      await waitFor(() => expect(completeOldRead).toBeTypeOf("function"));
      const readsBeforeRetirement = read.mock.calls.length;
      const detailReadsBeforeRetirement = read.mock.calls.filter(([name]) => name === "GetEventById").length;
      expect(detailReadsBeforeRetirement).toBe(1);
      server.commit("UpdateEvent", { ...copy(event), title: "Committed while detail was loading" });
      await act(async () => { await retireCommittedEventSave(capturedWrite, server.current()!); });
      const retry = await screen.findByRole("button", { name: "Retry loading" });
      expect(screen.queryByText("Loading event details…")).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument();
      const detailKey = dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey;
      expect(queryClient.getQueryState(detailKey)?.status).toBe("error");
      expect(queryClient.getQueryState(detailKey)?.fetchStatus).toBe("idle");
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
      expect(read).toHaveBeenCalledTimes(readsBeforeRetirement);
      expect(write).not.toHaveBeenCalled();
      await user.click(retry);
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Committed while detail was loading");
      expect(screen.getByRole("heading", { level: 1, name: "Committed while detail was loading" })).toBeInTheDocument();
      expect(read.mock.calls.filter(([name]) => name === "GetEventById")).toHaveLength(2);
      expect(read).toHaveBeenCalledTimes(readsBeforeRetirement + 1);
      await act(async () => completeOldRead());
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Committed while detail was loading");
      expect(queryClient.getQueryData<{ event: { title: string } }>(detailKey)?.event.title).toBe("Committed while detail was loading");
      expect(read).toHaveBeenCalledTimes(readsBeforeRetirement + 1);
      expect(write).not.toHaveBeenCalled();
    } finally { completeOldRead?.(); rendered.unmount(); endSession(); }
  });

  it.each(["event", "ticket"] as const)("retires incomplete projections when a confirmed late %s save finishes after changing editor", async firstKind => {
    const endSession = eventSession();
    const server = eventServer();
    const commit = (name: string, variables: Record<string, unknown>) => name === "UpdateTicketType"
      ? commitTicketCatalog(name, variables, server.current()!)
      : server.commit(name, variables);
    let completeFirst!: () => void;
    write.mockImplementation(async (name: string, variables: Record<string, unknown>) => commit(name, variables));
    // Hold the first operation before its commit, not merely its response. The
    // second operation can therefore return a full snapshot missing that save.
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      completeFirst = () => resolve(commit(name, variables));
    }));
    const detailsPath = "/sections/section-1/manage/events/event-1?task=details";
    const ticketPath = "/sections/section-1/manage/events/event-1?task=tickets&ticket=type-1";
    const rendered = render(routedEventView(firstKind === "event" ? detailsPath : ticketPath));
    const user = userEvent.setup();
    try {
      await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue(firstKind === "event" ? event.title : "Dinner"));
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: firstKind === "event" ? "Late event title" : "Late ticket title" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      await act(async () => navigateManager(firstKind === "event" ? ticketPath : detailsPath));
      if (firstKind === "ticket") await waitForDialogToClose();
      await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue(firstKind === "event" ? "Dinner" : event.title));
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: firstKind === "event" ? "Saved ticket B" : "Saved event B" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
      if (firstKind === "event") {
        await waitForDialogToClose();
        await user.click(await screen.findByRole("link", { name: "Edit Saved ticket B" }));
        await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue("Saved ticket B"));
        fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Newer unsaved ticket B" } });
      } else {
        await waitFor(() => expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument());
        await user.click(screen.getByRole("tab", { name: "Event details" }));
        await waitFor(() => expect(screen.getByLabelText(/^title/i)).toHaveValue("Saved event B"));
        fireEvent.change(screen.getByLabelText(/^location/i), { target: { value: "Newer unsaved location B" } });
      }
      const detailKey = dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey;
      const listKey = dataConnectQueryOptions(getEventsForSectionRef(context.dc, { sectionId: "section-1" })).queryKey;
      const memberKey = dataConnectQueryOptions(getMyBookingsRef(context.dc)).queryKey;
      const joinedKey = dataConnectQueryOptions(listEventBookingsForAdminRef(context.dc, { eventId: event.id })).queryKey;
      const historicalKey = ["ListBookingPaymentAdjustmentsForAdmin", { eventId: event.id }];
      const unrelatedKey = ["GetEventById", { id: "unrelated-event" }];
      queryClient.setQueryData(memberKey, { user: { id: "admin", bookings: [{
        ...booking(), event: { ...copy(server.current()!), section: { id: "section-1", name: "Events" } },
      }] } });
      queryClient.setQueryData(joinedKey, { event: { id: event.id, bookings: [], bookingTicketOrders: [] } });
      queryClient.setQueryData(historicalKey, { paidAmountMinor: 2500 });
      queryClient.setQueryData(unrelatedKey, { event: { id: "unrelated-event", title: "Unrelated" } });
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
      const activeInput = screen.getByLabelText(firstKind === "event" ? /^title/i : /^location/i);
      act(() => activeInput.focus());
      const beforeLateCommit = read.mock.calls.length;
      await act(async () => completeFirst());
      await waitFor(() => expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(memberKey)?.isInvalidated).toBe(true);
      if (firstKind === "ticket") expect(queryClient.getQueryState(joinedKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(historicalKey)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
      expect(read).toHaveBeenCalledTimes(beforeLateCommit);
      expect(write.mock.calls.map(([name]) => name)).toEqual(firstKind === "event"
        ? ["UpdateEvent", "UpdateTicketType"] : ["UpdateTicketType", "UpdateEvent"]);
      if (firstKind === "event") {
        expect(screen.getByRole("dialog", { name: "Edit ticket type" })).toBeInTheDocument();
        expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer unsaved ticket B");
      } else expect(screen.getByLabelText(/^location/i)).toHaveValue("Newer unsaved location B");
      expect(activeInput).toHaveFocus();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      const refresh = await screen.findByRole("button", { name: "Refresh saved change" });
      if (firstKind === "event") expect(within(screen.getByRole("dialog", { name: "Edit ticket type" })).getByRole("button", { name: "Refresh saved change" })).toBe(refresh);
      await user.click(refresh);
      await waitFor(() => expect(screen.queryByRole("button", { name: /^(Refresh|Refreshing|Retry) saved change/ })).not.toBeInTheDocument());
      expect(read.mock.calls.slice(beforeLateCommit).map(([name]) => name).sort()).toEqual(["GetEventById", "GetEventsForSection"]);
      const result = queryClient.getQueryData<{ event: { title: string; ticketTypes: TicketTypeRow[] } }>(detailKey)!;
      expect(result.event.title).toBe(firstKind === "event" ? "Late event title" : "Saved event B");
      expect(result.event.ticketTypes[0].title).toBe(firstKind === "event" ? "Saved ticket B" : "Late ticket title");
      expect(queryClient.getQueryData<{ section: { events: Array<{ title: string }> } }>(listKey)?.section.events[0].title).toBe(result.event.title);
      expect(screen.getByRole("heading", { level: 1, name: result.event.title, hidden: true })).toBeInTheDocument();
      expect((await executeQuery(getEventByIdRef(context.dc, { id: event.id }))).data.event?.ticketTypes[0].title).toBe(result.event.ticketTypes[0].title);
      expect(queryClient.getQueryState(memberKey)?.isInvalidated).toBe(true);
      if (firstKind === "ticket") expect(queryClient.getQueryState(joinedKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryData(historicalKey)).toEqual({ paidAmountMinor: 2500 });
      expect(queryClient.getQueryState(historicalKey)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryData(unrelatedKey)).toEqual({ event: { id: "unrelated-event", title: "Unrelated" } });
      expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
      if (firstKind === "event") expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer unsaved ticket B");
      else expect(screen.getByLabelText(/^location/i)).toHaveValue("Newer unsaved location B");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(write).toHaveBeenCalledTimes(2);
      await act(async () => navigateManager(firstKind === "event" ? detailsPath : ticketPath));
      if (firstKind === "event") await waitForDialogToClose();
      expect(await screen.findByText(/The previous save completed/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Load saved change" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["event", "ticket"] as const)("keeps a failed departed %s refresh retryable in the active editor without changing its draft, focus or saved receipt", async kind => {
    const endSession = eventSession();
    const { server, complete, rendered, user } = await pendingDepartedEventSave(kind);
    let completeDetail!: () => void;
    try {
      const beforeConfirmation = read.mock.calls.length;
      await act(async () => complete());
      await screen.findByRole("button", { name: "Refresh saved change" });
      expect(read).toHaveBeenCalledTimes(beforeConfirmation);
      if (kind === "event") await user.click(screen.getByRole("link", { name: "Edit Dinner" }));
      const currentDraft = await screen.findByLabelText(kind === "event" ? /^title/i : /^location/i);
      const newerDraft = kind === "event" ? "Newer ticket draft" : "Newer event location";
      fireEvent.change(currentDraft, { target: { value: "Draft before refresh" } });
      act(() => currentDraft.focus());
      const beforeRefresh = read.mock.calls.length;
      failingRead = "GetEventById";
      const originalRead = read.getMockImplementation()!;
      read.mockImplementation((name: string, variables: Record<string, unknown>) => name === "GetEventById"
        ? new Promise(resolve => { completeDetail = () => resolve(originalRead(name, variables)); })
        : originalRead(name, variables));
      await user.click(screen.getByRole("button", { name: "Refresh saved change" }));
      await waitFor(() => expect(completeDetail).toBeTypeOf("function"));
      expect(screen.getByRole("button", { name: "Refreshing saved change…" })).toBeDisabled();
      fireEvent.change(currentDraft, { target: { value: newerDraft } });
      act(() => currentDraft.focus());
      const completeFailure = completeDetail;
      await act(async () => completeFailure());
      const retry = await screen.findByRole("button", { name: "Retry saved change refresh" });
      expect(screen.getByText(/Your change is saved. The latest event data could not be loaded/)).toBeInTheDocument();
      expect(currentDraft).toHaveFocus();
      expect(currentDraft).toHaveValue(newerDraft);
      expect(screen.getByLabelText(kind === "event" ? /^title/i : /^location/i)).toBe(currentDraft);
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(read.mock.calls.slice(beforeRefresh).map(([name]) => name).sort()).toEqual(["GetEventById", "GetEventsForSection"]);
      expect(write).toHaveBeenCalledOnce();

      failingRead = null;
      server.commit("UpdateEvent", { ...server.current()!, title: "Newer remote event title" });
      await user.click(retry);
      await waitFor(() => expect(completeDetail).not.toBe(completeFailure));
      expect(screen.getByRole("button", { name: "Refreshing saved change…" })).toBeDisabled();
      act(() => currentDraft.focus());
      await act(async () => completeDetail());
      await waitFor(() => expect(screen.queryByRole("button", { name: /^(Refresh|Refreshing|Retry) saved change/ })).not.toBeInTheDocument());
      expect(currentDraft).toHaveFocus();
      expect(currentDraft).toHaveValue(newerDraft);
      if (kind === "event") expect(screen.getByRole("dialog", { name: "Edit ticket type" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("heading", { level: 1, name: "Newer remote event title", hidden: true })).toBeInTheDocument();
      expect(screen.queryByText(/Your change is saved. The latest event data could not be loaded/)).not.toBeInTheDocument();
      expect(screen.queryByText("We could not complete the event operation. Please refresh and try again.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry loading" })).not.toBeInTheDocument();
      expect(read.mock.calls.slice(beforeRefresh).map(([name]) => name).sort()).toEqual(["GetEventById", "GetEventById", "GetEventsForSection", "GetEventsForSection"]);
      expect(write).toHaveBeenCalledOnce();
      await act(async () => navigateManager(kind === "event" ? "?task=details" : "?task=tickets&ticket=type-1"));
      if (kind === "event") await waitForDialogToClose();
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Saved after task change");
      expect(screen.getByText(/The previous save completed/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    } finally { completeDetail?.(); rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["event", "account", "epoch", "blocked"] as const)("does not offer an old saved change after the %s context changes before confirmation", async change => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const { complete, rendered } = await pendingDepartedEventSave();
    const replacement = createSessionLifecycle(); replacement.observe("replacement-admin");
    let uninstallReplacement: (() => void) | undefined;
    let authority: ReturnType<typeof beginAuthorizationUpdate> | undefined;
    try {
      await act(async () => {
        if (change === "event") navigateManager("/sections/section-1/manage/events/another-event?task=tickets");
        else if (change === "account") {
          owner.retire();
          uninstallReplacement = installSessionRuntime({ lifecycle: replacement, retire: () => replacement.retire(), signOut: async () => replacement.retire() });
        } else {
          authority = beginAuthorizationUpdate(captureSession());
          authority.finish(true, change === "blocked");
        }
      });
      const beforeConfirmation = read.mock.calls.length;
      await act(async () => complete());
      expect(screen.queryByRole("button", { name: /^(Refresh|Refreshing|Retry) saved change/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Your change was saved after you changed tasks/)).not.toBeInTheDocument();
      expect(read).toHaveBeenCalledTimes(beforeConfirmation);
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); authority?.finish(true); replacement.retire(); uninstallReplacement?.(); owner.retire(); uninstall(); }
  }, 20_000);

  it.each(["event", "account", "epoch", "blocked"] as const)("discards an in-flight saved-change refresh after its %s context changes", async change => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const { server, complete, rendered, user } = await pendingDepartedEventSave();
    const replacement = createSessionLifecycle(); replacement.observe("replacement-admin");
    let uninstallReplacement: (() => void) | undefined;
    let authority: ReturnType<typeof beginAuthorizationUpdate> | undefined;
    let completeRead!: () => void;
    try {
      await act(async () => complete());
      const refresh = await screen.findByRole("button", { name: "Refresh saved change" });
      const originalRead = read.getMockImplementation()!;
      read.mockImplementation((name: string, variables: Record<string, unknown>) => name === "GetEventById"
        ? new Promise(resolve => { const response = originalRead(name, variables); completeRead = () => resolve(response); })
        : originalRead(name, variables));
      await user.click(refresh);
      await waitFor(() => expect(completeRead).toBeTypeOf("function"));
      expect(screen.getByRole("button", { name: "Refreshing saved change…" })).toBeDisabled();
      await act(async () => {
        if (change === "event") navigateManager("/sections/section-1/manage/events/another-event?task=tickets");
        else if (change === "account") {
          owner.retire();
          uninstallReplacement = installSessionRuntime({ lifecycle: replacement, retire: () => replacement.retire(), signOut: async () => replacement.retire() });
        } else {
          authority = beginAuthorizationUpdate(captureSession());
          authority.finish(true, change === "blocked");
        }
      });
      const detailKey = dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey;
      if (change !== "event") queryClient.setQueryData(detailKey, { event: { ...server.current()!, title: "Replacement context data" } });
      const beforeOldCompletion = read.mock.calls.length;
      await act(async () => completeRead());
      expect(screen.queryByRole("button", { name: /^(Refresh|Refreshing|Retry) saved change/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Your change was saved after you changed tasks/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Your change is saved. The latest event data could not be loaded/)).not.toBeInTheDocument();
      if (change !== "event") expect(queryClient.getQueryData<{ event: { title: string } }>(detailKey)?.event.title).toBe("Replacement context data");
      expect(read).toHaveBeenCalledTimes(beforeOldCompletion);
      expect(write).toHaveBeenCalledOnce();
    } finally { completeRead?.(); rendered.unmount(); authority?.finish(true); replacement.retire(); uninstallReplacement?.(); owner.retire(); uninstall(); }
  }, 20_000);

  it.each(["account", "epoch"] as const)("does not start either saved-change read when summary removal changes the %s owner", async change => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const { server, complete, rendered, user } = await pendingDepartedEventSave();
    const replacement = createSessionLifecycle(); replacement.observe("replacement-admin");
    let uninstallReplacement: (() => void) | undefined;
    let unsubscribe: (() => void) | undefined;
    try {
      await act(async () => complete());
      const refresh = await screen.findByRole("button", { name: "Refresh saved change" });
      const detailKey = dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey;
      const listKey = dataConnectQueryOptions(getEventsForSectionRef(context.dc, { sectionId: "section-1" })).queryKey;
      const replacementEvent = { ...server.current()!, title: "Replacement owner's event" };
      queryClient.setQueryData(["sectionEventSummaries", "late-save"], { old: true });
      unsubscribe = queryClient.getQueryCache().subscribe(notification => {
        if (notification.type !== "removed" || notification.query.queryKey[0] !== "sectionEventSummaries") return;
        unsubscribe?.();
        if (change === "account") {
          owner.retire();
          uninstallReplacement = installSessionRuntime({ lifecycle: replacement, retire: () => replacement.retire(), signOut: async () => replacement.retire() });
        } else beginAuthorizationUpdate(captureSession()).finish(true);
        queryClient.setQueryData(detailKey, { event: replacementEvent });
        queryClient.setQueryData(listKey, { section: { id: "section-1", events: [replacementEvent] } });
      });
      const beforeRefresh = read.mock.calls.length;
      await user.click(refresh);
      await waitFor(() => expect(screen.queryByRole("button", { name: /^(Refresh|Refreshing|Retry) saved change/ })).not.toBeInTheDocument());
      expect(read).toHaveBeenCalledTimes(beforeRefresh);
      expect(queryClient.getQueryData(detailKey)).toEqual({ event: replacementEvent });
      expect(queryClient.getQueryData(listKey)).toEqual({ section: { id: "section-1", events: [replacementEvent] } });
      expect(write).toHaveBeenCalledOnce();
    } finally { unsubscribe?.(); rendered.unmount(); replacement.retire(); uninstallReplacement?.(); owner.retire(); uninstall(); }
  }, 20_000);

  it("retains a newer late-save notice when the previous notice's refresh is superseded", async () => {
    const endSession = eventSession();
    const server = eventServer();
    const completeWrites: Array<() => void> = [];
    write.mockImplementation((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      completeWrites.push(() => resolve(name === "UpdateTicketType"
        ? commitTicketCatalog(name, variables, server.current()!)
        : server.commit(name, variables)));
    }));
    const rendered = render(routedEventView());
    const user = userEvent.setup();
    let completeOldRead!: () => void;
    try {
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "First late event save" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await act(async () => navigateManager("?task=tickets&ticket=type-1"));
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Second late ticket save" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(completeWrites).toHaveLength(2));
      await act(async () => navigateManager("?task=details"));
      await waitForDialogToClose();
      await act(async () => completeWrites[0]());
      const firstRefresh = await screen.findByRole("button", { name: "Refresh saved change" });
      const originalRead = read.getMockImplementation()!;
      let held = false;
      read.mockImplementation((name: string, variables: Record<string, unknown>) => {
        if (name === "GetEventById" && !held) {
          held = true;
          const previous = originalRead(name, variables);
          return new Promise(resolve => { completeOldRead = () => resolve(previous); });
        }
        return originalRead(name, variables);
      });
      await user.click(firstRefresh);
      await waitFor(() => expect(completeOldRead).toBeTypeOf("function"));
      await act(async () => completeWrites[1]());
      const newerRefresh = await screen.findByRole("button", { name: "Refresh saved change" });
      const beforeOldCompletion = read.mock.calls.length;
      await act(async () => completeOldRead());
      expect(screen.getByRole("button", { name: "Refresh saved change" })).toBe(newerRefresh);
      expect(screen.queryByRole("button", { name: "Retry saved change refresh" })).not.toBeInTheDocument();
      expect(read).toHaveBeenCalledTimes(beforeOldCompletion);
      expect(screen.getByLabelText(/^title/i)).toHaveValue("First late event save");
      await user.click(newerRefresh);
      await waitFor(() => expect(screen.queryByRole("button", { name: /^(Refresh|Refreshing|Retry) saved change/ })).not.toBeInTheDocument());
      const detailKey = dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey;
      const current = queryClient.getQueryData<{ event: { title: string; ticketTypes: TicketTypeRow[] } }>(detailKey)!;
      expect(current.event.title).toBe("First late event save");
      expect(current.event.ticketTypes[0].title).toBe("Second late ticket save");
      expect(screen.getByText(/The previous save completed/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(write.mock.calls.map(([name]) => name)).toEqual(["UpdateEvent", "UpdateTicketType"]);
    } finally { completeOldRead?.(); rendered.unmount(); endSession(); }
  }, 20_000);
});

describe("canonical committed ticket catalogue saves", () => {
  it.each(["create", "update"] as const)("publishes the canonical %s record and sorted catalogue without any follow-up query", async kind => {
    const endSession = eventSession();
    ticketTypes.push({ ...ticket("type-later", "Later ticket"), sortOrder: 9 });
    const server = ticketCatalogServer();
    const { rendered, user } = await ticketEditor(kind);
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "  Canonical ticket  " } });
      fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: "42" } });
      fireEvent.change(screen.getByLabelText(/^sort order/i), { target: { value: "-1" } });
      const before = read.mock.calls.length;
      const eventReadsBefore = eventReadCount();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      expect(read).toHaveBeenCalledTimes(before);
      expect(write.mock.calls.map(([name]) => name)).toEqual([kind === "create" ? "CreateTicketType" : "UpdateTicketType"]);
      if (kind === "create") expect(write.mock.calls[0][1].id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(await screen.findByText("Canonical ticket", { exact: true })).toBeInTheDocument();
      const cached = queryClient.getQueryData<{ event: typeof event & { ticketTypes: TicketTypeRow[] } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey);
      expect(cached?.event).toEqual(server.current());
      expect(cached?.event.ticketTypes.map(row => row.title)).toEqual(kind === "create" ? ["Canonical ticket", "Dinner", "Later ticket"] : ["Canonical ticket", "Later ticket"]);
      await user.click(screen.getByRole("link", { name: "Edit Canonical ticket" }));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Canonical ticket");
      expect(screen.getByLabelText(/^price/i)).toHaveValue(42);
      expect(eventReadCount()).toBe(eventReadsBefore);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["create", "update"] as const)("keeps newer inputs during a pending %s and next updates the same ticket ID", async kind => {
    const endSession = eventSession(); const server = ticketCatalogServer();
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      const result = server.commit(name, variables); complete = () => resolve(result);
    }));
    const { rendered, user } = await ticketEditor(kind);
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Submitted ticket" } });
      const before = read.mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      const firstId = String(write.mock.calls[0][1].id);
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Newer unsaved ticket" } });
      fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: "53" } });
      await act(async () => complete());
      expect(await screen.findByText(/These newer edits have not been saved/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer unsaved ticket");
      expect(screen.getByLabelText(/^price/i)).toHaveValue(53);
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(read).toHaveBeenCalledTimes(before);
      expect(server.current()!.ticketTypes.find(row => idsEqual(row.id, firstId))?.title).toBe("Submitted ticket");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      expect(write.mock.calls.map(([name]) => name)).toEqual([kind === "create" ? "CreateTicketType" : "UpdateTicketType", "UpdateTicketType"]);
      expect(write.mock.calls[1][1].id).toBe(firstId);
      expect(server.current()!.ticketTypes.find(row => idsEqual(row.id, firstId))?.title).toBe("Newer unsaved ticket");
      expect(read).toHaveBeenCalledTimes(before);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["null ticket", "null event", "missing timestamp", "missing catalogue", "null write key", "wrong write key"])("keeps the draft uncertain for a 200 response with %s", async variant => {
    const endSession = eventSession(); const server = ticketCatalogServer();
    write.mockImplementationOnce(async (name: string, variables: Record<string, unknown>) => {
      const result = server.commit(name, variables);
      if (variant === "null ticket") result.data.saved.ticketType = null as never;
      if (variant === "null event") result.data.saved.event = null as never;
      if (variant === "missing timestamp") delete (result.data.saved.ticketType as { updatedAt?: string }).updatedAt;
      if (variant === "missing catalogue") delete (result.data.saved.event as { ticketTypes?: TicketTypeRow[] }).ticketTypes;
      if (variant === "null write key") result.data.ticketType_update = null as never;
      if (variant === "wrong write key") result.data.ticketType_update = { id: "other-ticket" };
      return result;
    });
    const { rendered, user } = await ticketEditor("update");
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Retained ticket draft" } });
      const before = read.mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText(/The previous save could not be confirmed/)).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Edit ticket type" })).toBeInTheDocument();
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Retained ticket draft");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(read).toHaveBeenCalledTimes(before);
      expect(write).toHaveBeenCalledOnce();
      expect(queryClient.getQueryData<{ event: { ticketTypes: TicketTypeRow[] } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey)?.event.ticketTypes[0].title).toBe("Dinner");
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("recovers a lost create by its exact ticket ID, retains newer edits and never inserts twice", async () => {
    const endSession = eventSession(); const server = ticketCatalogServer();
    write.mockImplementationOnce(async (name: string, variables: Record<string, unknown>) => {
      server.commit(name, variables); throw new Error("Response lost after ticket insert committed");
    });
    const { rendered, user } = await ticketEditor("create");
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Original create title" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText(/The previous save could not be confirmed/);
      const createdId = String(write.mock.calls[0][1].id);
      expect(createdId).toMatch(/^[0-9a-f-]{36}$/i);
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Newer title after lost response" } });
      failingRead = "GetEventById";
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Check latest list" })).toBeEnabled());
      expect(screen.queryByRole("dialog", { name: "Start a new save request?" })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer title after lost response");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      failingRead = null;
      const before = write.mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      const review = await screen.findByRole("dialog", { name: "Start a new save request?" });
      expect(within(review).getByRole("button", { name: "I checked — start a new request" })).toBeDisabled();
      await user.click(within(review).getByRole("button", { name: "I found the saved change — close this draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Start a new save request?", hidden: true })).not.toBeInTheDocument());
      expect(write).toHaveBeenCalledTimes(before);
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer title after lost response");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      expect(write.mock.calls.map(([name]) => name)).toEqual(["CreateTicketType", "UpdateTicketType"]);
      expect(write.mock.calls[1][1].id).toBe(createdId);
      expect(server.current()!.ticketTypes.filter(row => idsEqual(row.id, createdId))).toHaveLength(1);
      expect(server.current()!.ticketTypes.find(row => idsEqual(row.id, createdId))?.title).toBe("Newer title after lost response");
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("does not mistake an identically named ticket for a failed create and retains its ID for an explicit retry", async () => {
    const endSession = eventSession(); const server = ticketCatalogServer();
    ticketTypes.push(ticket("unrelated-ticket", "Same title"));
    server.current()!.ticketTypes = copy(ticketTypes);
    write.mockRejectedValueOnce(new Error("Ticket insert rejected before commit"));
    const { rendered, user } = await ticketEditor("create");
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Same title" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText(/The previous save could not be confirmed/);
      const createId = String(write.mock.calls[0][1].id);
      expect(createId).toMatch(/^[0-9a-f-]{36}$/i);
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      const review = await screen.findByRole("dialog", { name: "Start a new save request?" });
      expect(within(review).getByRole("button", { name: "I found the saved change — close this draft" })).toBeDisabled();
      await user.click(within(review).getByRole("button", { name: "I checked — start a new request" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Start a new save request?", hidden: true })).not.toBeInTheDocument());
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Same title");
      expect(write).toHaveBeenCalledOnce();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      expect(write.mock.calls.map(([name]) => name)).toEqual(["CreateTicketType", "CreateTicketType"]);
      expect(write.mock.calls[1][1].id).toBe(createId);
      expect(server.current()!.ticketTypes.filter(row => idsEqual(row.id, createId))).toHaveLength(1);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("rejects a pre-save late detail result instead of overwriting the committed ticket catalogue", async () => {
    const endSession = eventSession(); const server = ticketCatalogServer();
    const { rendered, user } = await ticketEditor("update");
    try {
      const previous = copy(server.current());
      const originalRead = read.getMockImplementation()!;
      let complete!: () => void;
      let held = false;
      read.mockImplementation((name: string, variables: Record<string, unknown>) => {
        if (name === "GetEventById" && !held) {
          held = true;
          return new Promise(resolve => { complete = () => resolve({ data: { event: previous }, extensions: {} }); });
        }
        return originalRead(name, variables);
      });
      let oldRead!: Promise<unknown>;
      act(() => { oldRead = queryClient.fetchQuery({ ...dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })), staleTime: 0 }).catch(() => undefined); });
      await waitFor(() => expect(complete).toBeTypeOf("function"));
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Committed ticket after old read" } });
      const before = read.mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      await act(async () => { complete(); await oldRead; });
      expect(read).toHaveBeenCalledTimes(before);
      expect(await screen.findByText("Committed ticket after old read", { exact: true })).toBeInTheDocument();
      const cached = queryClient.getQueryData<{ event: { ticketTypes: TicketTypeRow[] } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey);
      expect(cached?.event.ticketTypes[0].title).toBe("Committed ticket after old read");
      // A cancelled SDK operation can still populate its private cache. App
      // readers use SERVER_ONLY, so the next real authoritative refresh must
      // obtain the committed record instead of trusting that SDK snapshot.
      const fresh = await refreshDataConnectQuery(queryClient, getEventByIdRef(context.dc, { id: event.id }));
      expect(fresh.event?.ticketTypes[0].title).toBe("Committed ticket after old read");
      expect((await executeQuery(getEventByIdRef(context.dc, { id: event.id }))).data.event?.ticketTypes[0].title).toBe("Committed ticket after old read");
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["route", "logout", "account"] as const)("does not publish a late committed ticket after %s retirement", async retirement => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    const server = ticketCatalogServer();
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      const result = server.commit(name, variables); complete = () => resolve(result);
    }));
    const { rendered, user } = await ticketEditor("update");
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Old session ticket save" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      await act(async () => {
        if (retirement === "logout") owner.retire();
        if (retirement === "account") owner.observe("replacement-user");
        navigateManager("/elsewhere");
      });
      const before = read.mock.calls.length;
      await act(async () => complete());
      expect(screen.getByText("Elsewhere")).toBeInTheDocument();
      expect(screen.queryByText("Old session ticket save", { exact: true })).not.toBeInTheDocument();
      const cached = queryClient.getQueryData<{ event: { ticketTypes: TicketTypeRow[] } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey);
      expect(cached?.event.ticketTypes[0].title).not.toBe("Old session ticket save");
      expect(read).toHaveBeenCalledTimes(before);
      expect(write).toHaveBeenCalledOnce();
      if (retirement === "route") {
        await act(async () => navigateManager(-1));
        expect(await screen.findByLabelText(/^title/i)).toHaveValue("Old session ticket save");
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        expect(screen.getByText(/The previous save completed/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Load saved change" }));
        await waitForDialogToClose();
        expect(await screen.findByText("Old session ticket save", { exact: true })).toBeInTheDocument();
        expect(write).toHaveBeenCalledOnce();
      }
    } finally { rendered.unmount(); owner.retire(); uninstall(); }
  }, 20_000);
});

describe("canonical committed event saves", () => {
  it.each(["create", "update"] as const)("renders the committed %s result without post-save event reads", async kind => {
    const endSession = eventSession();
    const server = eventServer(kind === "update");
    const rendered = render(routedEventView(kind === "create" ? "/sections/section-1/manage/events?edit=new-event" : undefined));
    try {
      const user = userEvent.setup();
      const input = await screen.findByLabelText(/^title/i);
      fireEvent.change(input, { target: { value: "  Canonical saved title  " } });
      const before = eventReadCount();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument());
      expect(write.mock.calls.map(([name]) => name)).toEqual([kind === "create" ? "CreateEvent" : "UpdateEvent"]);
      expect(eventReadCount()).toBe(before);
      const committed = server.current()!;
      expect(queryClient.getQueryData(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: committed.id })).queryKey)).toEqual({ event: committed });
      const list = queryClient.getQueryData<{ section: { events: Array<{ title: string }> } }>(dataConnectQueryOptions(getEventsForSectionRef(context.dc, { sectionId: "section-1" })).queryKey);
      expect(list?.section.events.map(row => row.title)).toEqual(["Canonical saved title"]);
      if (kind === "update") {
        expect(screen.getByRole("heading", { level: 1, name: "Canonical saved title" })).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Event details" }));
        expect(await screen.findByLabelText(/^title/i)).toHaveValue("Canonical saved title");
        expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
        expect(eventReadCount()).toBe(before);
      }
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["create", "update"] as const)("preserves newer input during a pending %s and the next save updates the same event", async kind => {
    const endSession = eventSession();
    const server = eventServer(kind === "update");
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      const result = server.commit(name, variables);
      complete = () => resolve(result);
    }));
    const rendered = render(routedEventView(kind === "create" ? "/sections/section-1/manage/events?edit=new-event" : undefined));
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Submitted title" } });
      const before = eventReadCount();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Newer unsaved title" } });
      await act(async () => { complete(); });
      expect(await screen.findByText(/These newer edits have not been saved/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer unsaved title");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(eventReadCount()).toBe(before);
      const firstId = server.current()!.id;
      expect(queryClient.getQueryData<{ event: { title: string } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: firstId })).queryKey)?.event.title).toBe("Submitted title");
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument());
      expect(write.mock.calls.map(([name]) => name)).toEqual([kind === "create" ? "CreateEvent" : "UpdateEvent", "UpdateEvent"]);
      expect(write.mock.calls[1][1].id).toBe(firstId);
      expect(server.current()!.title).toBe("Newer unsaved title");
      expect(eventReadCount()).toBe(before);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("preserves a newer revision restored to the submitted values without claiming it is unsaved", async () => {
    const endSession = eventSession();
    const server = eventServer();
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      const result = server.commit(name, variables); complete = () => resolve(result);
    }));
    const rendered = render(routedEventView());
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Submitted title" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Temporary newer edit" } });
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Submitted title" } });
      await act(async () => { complete(); });
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Submitted title");
      expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
      expect(screen.queryByText("Unsaved changes", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByText(/These newer edits have not been saved/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each(["null saved event", "null write key", "wrong write key"])("retains the draft and uncertain receipt for a 200 response with %s", async variant => {
    const endSession = eventSession();
    const server = eventServer();
    write.mockImplementationOnce(async (name: string, variables: Record<string, unknown>) => {
      const result = server.commit(name, variables);
      if (variant === "null saved event") result.data.saved.event = null as never;
      else result.data.event_update = variant === "null write key" ? null as never : { id: "different-event" };
      return result;
    });
    const rendered = render(routedEventView());
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Unconfirmed result" } });
      const before = eventReadCount();
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText(/The previous save could not be confirmed/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Unconfirmed result");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByRole("heading", { level: 1, name: event.title })).toBeInTheDocument();
      expect(write).toHaveBeenCalledOnce();
      expect(eventReadCount()).toBe(before);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("labels a confirmed save awaiting a newer read truthfully and recovers read-only after a failed detail refresh", async () => {
    const endSession = eventSession();
    const server = eventServer();
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      const result = server.commit(name, variables); complete = () => resolve(result);
    }));
    const rendered = render(routedEventView());
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Confirmed saved title" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      // A newer full read may include child/remote edits, so an older response
      // must not replace it even though that response confirms our commit.
      server.current()!.title = "Newer remote title";
      await act(async () => { await refreshDataConnectQuery(queryClient, getEventByIdRef(context.dc, { id: event.id })); });
      const before = eventReadCount();
      await act(async () => { complete(); });
      expect(await screen.findByText(/The previous save completed/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Newer remote title" })).toBeInTheDocument();
      expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
      expect(screen.queryByText("Unsaved changes", { exact: true })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(eventReadCount()).toBe(before);
      failingRead = "GetEventById";
      await user.click(screen.getByRole("button", { name: "Load saved change" }));
      expect((await screen.findAllByText(/The event is already saved.*latest event data could not be loaded/) ).length).toBeGreaterThan(0);
      // The existing failed-detail boundary hides the editor until a verified
      // read succeeds; its session draft and successful receipt are retained.
      expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument();
      expect(write).toHaveBeenCalledOnce();
      failingRead = null;
      await user.click(screen.getByRole("button", { name: "Retry refresh" }));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Confirmed saved title");
      expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
      expect(screen.queryByText(/We could not complete the event operation/)).not.toBeInTheDocument();
      expect(screen.queryByText(/The event was saved. Load the saved change/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByText(/The previous save completed/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Load saved change" }));
      await waitFor(() => expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument());
      expect(screen.getByRole("heading", { level: 1, name: "Newer remote title" })).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Event details" }));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue("Newer remote title");
      expect(screen.queryByText(/The event was saved. Load the saved change/)).not.toBeInTheDocument();
      expect(screen.queryByText(/already saved/)).not.toBeInTheDocument();
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("recovers a lost create response by its stable identity, preserves newer edits and never inserts it twice", async () => {
    const endSession = eventSession();
    const server = eventServer(false);
    write.mockImplementationOnce(async (name: string, variables: Record<string, unknown>) => {
      server.commit(name, variables); throw new Error("Response lost after insert committed");
    });
    const rendered = render(routedEventView("/sections/section-1/manage/events?edit=new-event"));
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Created before lost response" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText(/The previous save could not be confirmed/);
      const createdId = server.current()!.id;
      expect(write.mock.calls[0][1].id).toBe(createdId);
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Newer edits after uncertain save" } });
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      const review = await screen.findByRole("dialog", { name: "Start a new save request?" });
      expect(within(review).getByText(/Your event is present/)).toBeInTheDocument();
      expect(within(review).getByRole("button", { name: "I checked — start a new request" })).toBeDisabled();
      expect(write).toHaveBeenCalledOnce();
      await user.click(within(review).getByRole("button", { name: "I found the saved change — close this draft" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Start a new save request?", hidden: true })).not.toBeInTheDocument());
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Newer edits after uncertain save");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByText(/These newer edits have not been saved/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument());
      expect(write.mock.calls.map(([name]) => name)).toEqual(["CreateEvent", "UpdateEvent"]);
      expect(write.mock.calls[1][1].id).toBe(createdId);
      expect(server.current()!.title).toBe("Newer edits after uncertain save");
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("keeps a confirmed title after a pre-save detail read completes late", async () => {
    const endSession = eventSession();
    eventServer();
    const rendered = render(routedEventView());
    try {
      const user = userEvent.setup();
      await screen.findByLabelText(/^title/i);
      const originalRead = read.getMockImplementation()!;
      let complete!: () => void;
      read.mockImplementation((name: string, variables: Record<string, unknown>) => name === "GetEventById"
        ? new Promise(resolve => { complete = () => resolve({ data: { event: { ...copy(event), section: { id: "section-1" }, ticketTypes: copy(ticketTypes) } }, extensions: {} }); })
        : originalRead(name, variables));
      let oldRead!: Promise<unknown>;
      act(() => { oldRead = queryClient.fetchQuery({ ...dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })), staleTime: 0 }); });
      await waitFor(() => expect(complete).toBeTypeOf("function"));
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Committed newer title" } });
      const before = eventReadCount();
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByRole("heading", { level: 1, name: "Committed newer title" })).toBeInTheDocument();
      await act(async () => { complete(); await oldRead.catch(() => {}); });
      expect(screen.getByRole("heading", { level: 1, name: "Committed newer title" })).toBeInTheDocument();
      expect(queryClient.getQueryData<{ event: { title: string } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey)?.event.title).toBe("Committed newer title");
      expect(eventReadCount()).toBe(before);
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);
});

describe("rendered administration freshness with the installed SDK cache", () => {
  it.each([
    { mode: "uncertain", spelling: "dashed", routeId: "182a30a9-7cb1-46eb-a5dc-83a54d6dc503" },
    { mode: "uncertain", spelling: "uppercase", routeId: "182A30A9-7CB1-46EB-A5DC-83A54D6DC503" },
    { mode: "retained", spelling: "dashed", routeId: "182a30a9-7cb1-46eb-a5dc-83a54d6dc503" },
    { mode: "retained", spelling: "uppercase", routeId: "182A30A9-7CB1-46EB-A5DC-83A54D6DC503" },
  ] as const)("refreshes the observed event key for $mode recovery from a $spelling URL and compact server IDs", async ({ mode, routeId }) => {
    const endSession = eventSession();
    const compactId = "182a30a97cb146eba5dc83a54d6dc503";
    const canonicalId = "182a30a9-7cb1-46eb-a5dc-83a54d6dc503";
    const server = eventServer(true, compactId);
    const path = `/sections/section-1/manage/events/${routeId}?task=details`;
    // Real generated refs retain spelling in their variables and query keys.
    // Prime every relevant key in both TanStack and the installed SDK so a
    // successful read of only the compact key cannot mask a stale URL observer.
    for (const id of new Set([routeId, canonicalId, compactId])) {
      await queryClient.fetchQuery(dataConnectQueryOptions(getEventByIdRef(context.dc, { id })));
    }
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => {
      const response = server.commit(name, variables);
      if (mode === "uncertain") return Promise.reject(new Error("Response lost after the event committed"));
      return new Promise(resolve => { complete = () => resolve(response); });
    });
    let rendered = render(routedEventView(path));
    try {
      const user = userEvent.setup();
      expect(await screen.findByRole("heading", { level: 1, name: event.title })).toBeInTheDocument();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Committed event before recovery" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      if (mode === "retained") {
        rendered.unmount();
        await act(async () => { complete(); });
        rendered = render(routedEventView(path));
        await screen.findByText(/The previous save completed/);
      } else {
        await screen.findByText(/The previous save could not be confirmed/);
      }
      // Reconciliation must read the latest full detail, not reinstall the
      // mutation receipt or patch a title into an incomplete/stale projection.
      const latestTitle = `Latest ${mode} event from server`;
      server.current()!.title = latestTitle;
      server.current()!.ticketTypes[0].title = "Ticket changed before reconciliation";
      const before = read.mock.calls.length;
      if (mode === "retained") {
        await user.click(screen.getByRole("button", { name: "Load saved change" }));
      } else {
        await user.click(screen.getByRole("button", { name: "Check latest list" }));
        const review = await screen.findByRole("dialog", { name: "Start a new save request?" });
        expect(within(review).getByText(latestTitle)).toBeInTheDocument();
        await user.click(within(review).getByRole("button", { name: "I found the saved change — close this draft" }));
        await waitForDialogToClose();
      }
      const canonicalRef = getEventByIdRef(context.dc, { id: canonicalId });
      await waitFor(() => expect(queryClient.getQueryData(dataConnectQueryOptions(canonicalRef).queryKey)).toEqual({ event: server.current() }));
      expect(await screen.findByRole("heading", { level: 1, name: latestTitle })).toBeInTheDocument();
      const recoveryDetailReads = read.mock.calls.slice(before).filter(([name]) => name === "GetEventById");
      expect(recoveryDetailReads.map(([, variables]) => variables.id)).toEqual([canonicalId]);
      expect((await executeQuery(canonicalRef)).data.event).toEqual(server.current());
      await user.click(screen.getByRole("tab", { name: "Event details" }));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue(latestTitle);
      expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
      expect(write.mock.calls.map(([name]) => name)).toEqual(["UpdateEvent"]);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it("publishes the observed ticket detail without a read after saving from an uppercase event URL", async () => {
    const endSession = eventSession();
    const canonicalId = "182a30a9-7cb1-46eb-a5dc-83a54d6dc503";
    const server = eventServer(true, canonicalId.replaceAll("-", ""));
    for (const id of [canonicalId, canonicalId.toUpperCase()]) {
      await queryClient.fetchQuery(dataConnectQueryOptions(getEventByIdRef(context.dc, { id })));
    }
    write.mockImplementationOnce(async (name: string, variables: Record<string, unknown>) => {
      expect(name).toBe("UpdateTicketType");
      return commitTicketCatalog(name, variables, server.current()!);
    });
    const rendered = render(routedEventView(`/sections/section-1/manage/events/${canonicalId.toUpperCase()}?task=tickets&ticket=type-1`));
    try {
      const user = userEvent.setup();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: "Updated ticket through canonical detail" } });
      const before = read.mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      expect(await screen.findByText("Updated ticket through canonical detail", { exact: true })).toBeInTheDocument();
      expect(queryClient.getQueryData(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: canonicalId })).queryKey)).toEqual({ event: server.current() });
      expect(read.mock.calls.slice(before).filter(([name]) => name === "GetEventById")).toEqual([]);
      expect(write.mock.calls.map(([name]) => name)).toEqual(["UpdateTicketType"]);
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

  it.each([false, true])("refreshes a found uncertain event update before reopening saved details, retry=%s", async (retry) => {
    const owner = createSessionLifecycle(); owner.observe("admin");
    const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
    let serverEvent = copy(event);
    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (name: string, variables: Record<string, unknown>) => {
      if (name === "GetEventsForSection") return { data: { section: { id: "section-1", events: [copy(serverEvent)] } }, extensions: {} };
      if (name === "GetEventById") {
        if (failingRead === name) throw new Error("Saved event detail unavailable");
        return { data: { event: { ...copy(serverEvent), section: { id: "section-1" }, ticketTypes: copy(ticketTypes) } }, extensions: {} };
      }
      return originalRead(name, variables);
    });
    // Both app and installed SDK caches contain the previous saved title.
    await queryClient.fetchQuery(dataConnectQueryOptions(getEventsForSectionRef(context.dc, { sectionId: "section-1" })));
    await queryClient.fetchQuery(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })));
    const savedTitle = "Updated event with a lost response";
    write.mockImplementationOnce(async (name: string, variables: Record<string, unknown>) => {
      expect(name).toBe("UpdateEvent");
      serverEvent = { ...serverEvent, title: String(variables.title) };
      throw new Error("Response lost after server commit");
    });
    const rendered = render(routedEventView());
    try {
      const user = userEvent.setup();
      expect(await screen.findByRole("heading", { level: 1, name: event.title })).toBeInTheDocument();
      fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: savedTitle } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText(/The previous save could not be confirmed/);
      expect(serverEvent.title).toBe(savedTitle);
      expect((await executeQuery(getEventByIdRef(context.dc, { id: event.id }))).data.event?.title).toBe(event.title);
      await user.click(screen.getByRole("button", { name: "Check latest list" }));
      let review = await screen.findByRole("dialog", { name: "Start a new save request?" });
      expect(within(review).getByText(savedTitle)).toBeInTheDocument();
      if (retry) {
        failingRead = "GetEventById";
        await user.click(within(review).getByRole("button", { name: "I found the saved change — close this draft" }));
        await waitFor(() => expect(read.mock.calls.filter(([name]) => name === "GetEventById").length).toBeGreaterThan(1));
        review = screen.getByRole("dialog", { name: "Start a new save request?" });
        expect(within(review).getByRole("alert")).toBeInTheDocument();
        const unload = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(unload);
        expect(unload.defaultPrevented).toBe(true);
        expect(write).toHaveBeenCalledOnce();
        failingRead = null;
      }
      await user.click(within(review).getByRole("button", { name: "I found the saved change — close this draft" }));
      await waitForDialogToClose();
      expect(await screen.findByRole("heading", { level: 1, name: savedTitle })).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Event details" }));
      expect(await screen.findByLabelText(/^title/i)).toHaveValue(savedTitle);
      expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
      expect((await executeQuery(getEventByIdRef(context.dc, { id: event.id }))).data.event?.title).toBe(savedTitle);
      expect(write.mock.calls.map(([name]) => name)).toEqual(["UpdateEvent"]);
      const unload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(false);
    } finally { rendered.unmount(); owner.retire(); uninstall(); }
  }, 30_000);

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
    expect(read.mock.calls.filter(([name]) => name === "GetEventsForSection").length).toBeGreaterThanOrEqual(2);
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
    // The invalidated entry is revalidated asynchronously by the installed SDK.
    // Wait for that authoritative result before asserting the committed UI.
    await waitFor(() => expect(queryClient.getQueryData(["GetEventById", { id: event.id }])).toEqual({ event: null }), { timeout: 5000 });
    expect(await screen.findByRole("heading", { name: "Event admin: Event" }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Event admin: Annual Dinner" })).not.toBeInTheDocument();
  }, 30_000);

  it("publishes a ticket edit without dependent reads and refreshes joined reports only when reopened", async () => {
    const endSession = eventSession(); bookings = [booking()];
    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (name: string, variables: Record<string, unknown>) => {
      if (name === "ListEventBookingsForAdmin") return { data: copy({ event: {
        id: event.id, bookings: bookings.map(current => ({ ...current, lines: current.lines.map(line => ({ ...line,
          ticketType: ticketTypes.find(type => type.id === line.ticketType.id) ?? line.ticketType,
        })) })), bookingTicketOrders: [],
      } }), extensions: {} };
      return originalRead(name, variables);
    });
    ticketCatalogServer();
    await queryClient.fetchQuery(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })));
    await queryClient.fetchQuery(dataConnectQueryOptions(listEventBookingsForAdminRef(context.dc, { eventId: event.id })));
    const rendered = render(routedEventView("/sections/section-1/manage/events/event-1"));
    try {
      const user = userEvent.setup();
      expect(await screen.findByText("£25.00")).toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Tickets & attendees" }));
      await user.click(screen.getByRole("tab", { name: "Ticket types" }));
      await user.click(await screen.findByRole("link", { name: "Edit Dinner" }));
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Updated dinner" } });
      fireEvent.change(screen.getByLabelText(/^price/i), { target: { value: "42" } });
      const readsBefore = read.mock.calls.length;
      const bookingReadsBefore = read.mock.calls.filter(([name]) => name === "ListEventBookingsForAdmin").length;
      const guestReadsBefore = vi.mocked(guestCall).mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitForDialogToClose();
      expect(await screen.findByText("Updated dinner", { exact: true })).toBeInTheDocument();
      expect(read).toHaveBeenCalledTimes(readsBefore);
      expect(vi.mocked(guestCall)).toHaveBeenCalledTimes(guestReadsBefore);
      expect(write.mock.calls.map(([name]) => name)).toEqual(["UpdateTicketType"]);
      expect(queryClient.getQueryState(dataConnectQueryOptions(listEventBookingsForAdminRef(context.dc, { eventId: event.id })).queryKey)?.isInvalidated).toBe(true);
      await user.click(screen.getByRole("tab", { name: "Overview" }));
      expect(await screen.findByText("£42.00")).toBeInTheDocument();
      expect(screen.queryByText("£25.00")).not.toBeInTheDocument();
      expect(read.mock.calls.filter(([name]) => name === "ListEventBookingsForAdmin").length).toBeGreaterThan(bookingReadsBefore);
      expect(vi.mocked(guestCall).mock.calls.length).toBeGreaterThan(guestReadsBefore);
      await user.click(screen.getByRole("tab", { name: "Tickets & attendees" }));
      expect(await screen.findByRole("cell", { name: "Updated dinner" })).toBeInTheDocument();
      const sdkReport = (await executeQuery(listEventBookingsForAdminRef(context.dc, { eventId: event.id }))).data.event;
      expect(sdkReport?.bookings[0].lines[0].ticketType.title).toBe("Updated dinner");
      expect(sdkReport?.bookings[0].lines[0].ticketType.price).toBe(42);
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); endSession(); }
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

  it("keeps a confirmed ticket receipt truthful when a newer read blocks publication and retries recovery without writing", async () => {
    const endSession = eventSession(); const server = ticketCatalogServer();
    let complete!: () => void;
    write.mockImplementationOnce((name: string, variables: Record<string, unknown>) => new Promise(resolve => {
      const result = server.commit(name, variables); complete = () => resolve(result);
    }));
    const { rendered, user } = await ticketEditor("update");
    try {
      fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Confirmed submitted ticket" } });
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(write).toHaveBeenCalledOnce());
      server.current()!.ticketTypes[0].title = "Newer remote catalogue title";
      await act(async () => { await refreshDataConnectQuery(queryClient, getEventByIdRef(context.dc, { id: event.id })); });
      const before = read.mock.calls.length;
      await act(async () => complete());
      expect(await screen.findByText(/The previous save completed/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Confirmed submitted ticket");
      expect(screen.queryByText(/We could not complete the ticket operation/)).not.toBeInTheDocument();
      expect(screen.queryByText("Unsaved changes", { exact: true })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(read).toHaveBeenCalledTimes(before);
      expect(queryClient.getQueryData<{ event: { ticketTypes: TicketTypeRow[] } }>(dataConnectQueryOptions(getEventByIdRef(context.dc, { id: event.id })).queryKey)?.event.ticketTypes[0].title).toBe("Newer remote catalogue title");
      failingRead = "GetEventById";
      await user.click(screen.getByRole("button", { name: "Load saved change" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Load saved change" })).toBeEnabled());
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Confirmed submitted ticket");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(write).toHaveBeenCalledOnce();
      failingRead = null;
      await user.click(screen.getByRole("button", { name: "Load saved change" }));
      await waitForDialogToClose();
      expect(await screen.findByText("Newer remote catalogue title", { exact: true })).toBeInTheDocument();
      expect(screen.queryByText(/We could not complete the ticket operation/)).not.toBeInTheDocument();
      expect(screen.queryByText(/The ticket type was saved. Load/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry refresh" })).not.toBeInTheDocument();
      expect(write).toHaveBeenCalledOnce();
    } finally { rendered.unmount(); endSession(); }
  }, 20_000);

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
