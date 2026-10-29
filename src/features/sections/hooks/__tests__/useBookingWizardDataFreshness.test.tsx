import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getDataConnect, type DataConnect } from "firebase/data-connect";
import { useBookingWizardData } from "../useBookingWizardData";

// Exercise both real query caches; only the SDK's network transport is local.
vi.unmock("firebase/data-connect");
const context = vi.hoisted(() => ({ dc: undefined as unknown as DataConnect }));
vi.mock("../../../../config/firebase", () => ({
  get dataConnect() { return context.dc; }, auth: { currentUser: null },
}));

let app: FirebaseApp;
let client: QueryClient;
let revision: number;
let failRead: boolean;
let nextApp = 0;
const reads = vi.fn();
const args = { section: { id: "section-1", purposeLinks: [] } as never,
  event: { id: "event-1", ticketTypes: [] } as never, postSubmitFlow: false };
function open() {
  return renderHook(() => useBookingWizardData(args), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}
beforeEach(() => {
  revision = 1; failRead = false; reads.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
  app = initializeApp({ projectId: "offline-booking-return", apiKey: "fake" }, `booking-return-${nextApp++}`);
  context.dc = getDataConnect(app, { service: "offline", connector: "offline", location: "europe-west2" });
  reads.mockImplementation(async (name: string) => {
    if (name === "GetMyBookingsForEvent") {
      if (failRead) throw new Error("Return read unavailable");
      return { data: { user: { id: "member", bookingTicketOrders: [], bookings: [{
        id: `booking-${revision}`, status: "SUBMITTED", revisionNumber: revision,
        supersededAt: null, clientSubmissionKey: `saved-${revision}`, lines: [], accommodationRequested: false,
      }] } }, extensions: {} };
    }
    const data = name === "GetCurrentUser" ? { user: { id: "member", membershipStatus: "REGULAR" } }
      : name === "GetUserAccessGroups" ? { user: { userGroups: [] } }
      : name === "GetMyTicketOrders" ? { user: { ticketOrders: [] } }
      : name === "GetMyBookingPaymentAdjustments" ? { user: { bookings: [] } }
      : undefined;
    if (!data) throw new Error(`Unexpected read ${name}`);
    return { data, extensions: {} };
  });
  (context.dc as DataConnect & { _transportClass: unknown })._transportClass = class {
    invokeQuery = reads;
    _setCallerSdkType() { /* SDK-local metadata only */ }
  };
});
afterEach(async () => { cleanup(); client.clear(); await deleteApp(app); });

describe("booking return reads with fresh query caches", () => {
  it("loads the saved revision on return even while both caches contain a fresh earlier revision", async () => {
    const first = open();
    await waitFor(() => expect(first.result.current.existingTerminalBooking?.revisionNumber).toBe(1));
    first.unmount();
    revision = 2;
    const returned = open();
    await waitFor(() => expect(returned.result.current.existingTerminalBooking?.revisionNumber).toBe(2));
    expect(returned.result.current.bookingRevisions[0]?.clientSubmissionKey).toBe("saved-2");
    expect(reads.mock.calls.filter(([name]) => name === "GetMyBookingsForEvent")).toHaveLength(2);
  });

  it("reports a failed return read instead of presenting cached data as a successful reconciliation", async () => {
    const first = open();
    await waitFor(() => expect(first.result.current.existingTerminalBooking?.revisionNumber).toBe(1));
    first.unmount(); failRead = true;
    const returned = open();
    await waitFor(() => expect(returned.result.current.bookingsError).toBe(true));
    expect(returned.result.current.refreshingBookings).toBe(false);
    expect(reads.mock.calls.filter(([name]) => name === "GetMyBookingsForEvent")).toHaveLength(2);
  });
});
