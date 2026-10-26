import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { getDataConnect, executeQuery, type DataConnect } from "firebase/data-connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listOpenPaymentReconciliationExceptionsRef, PaymentReconciliationExceptionType } from "@dataconnect/generated";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, render, screen, waitFor } from "../../../../test-utils";
import PaymentReconciliationDashboard from "../PaymentReconciliationDashboard";

vi.unmock("firebase/data-connect");
const context = vi.hoisted(() => ({ dc: undefined as unknown as DataConnect }));
vi.mock("../../../../config/firebase", () => ({ get dataConnect() { return context.dc; } }));
const exception = { id: "exception-1", exceptionType: PaymentReconciliationExceptionType.MISSING_PAYMENT_INTENT,
  note: "Needs review", updatedAt: "2026-01-01T00:00:00Z", ticketOrder: null };
let app: FirebaseApp;
let client: QueryClient;
let openRows: typeof exception[];
let failRead: boolean;
let failWrite: boolean;
let nextApp = 0;
const reads = vi.fn();
const writes = vi.fn();

beforeEach(() => {
  vi.clearAllMocks(); openRows = [exception]; failRead = false; failWrite = false;
  app = initializeApp({ projectId: "offline-payment-review", apiKey: "fake" }, `review-${nextApp++}`);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  context.dc = getDataConnect(app, { connector: "offline", service: "offline", location: "europe-west2" });
  reads.mockImplementation(async () => {
    if (failRead) throw new Error("Read unavailable");
    return { data: { paymentReconciliationExceptions: [...openRows] }, extensions: {} };
  });
  writes.mockImplementation(async () => {
    if (failWrite) throw new Error("Write rejected");
    openRows = []; failRead = true;
    return { data: {}, extensions: {} };
  });
  (context.dc as DataConnect & { _transportClass: unknown })._transportClass = class {
    invokeQuery = reads; invokeMutation = writes; _setCallerSdkType() { /* generated SDK metadata */ }
  };
});
afterEach(async () => { client.clear(); await deleteApp(app); });

const dashboard = () => render(<QueryClientProvider client={client}><PaymentReconciliationDashboard onBack={vi.fn()} /></QueryClientProvider>);

describe("confirmed payment-exception reviews", () => {
  it("keeps a confirmed review guarded across failed reads and clears it only after a successful read-only refresh", async () => {
    await executeQuery(listOpenPaymentReconciliationExceptionsRef(context.dc));
    dashboard(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Mark reviewed" }));
    expect(await screen.findByText(/Exception marked reviewed, but the latest list could not be loaded/)).toBeInTheDocument();
    expect(openRows).toEqual([]);
    expect(writes).toHaveBeenCalledOnce();

    // Another stale cache publisher must not turn a confirmed write into an
    // available write action again, even if the error message is dismissed.
    await act(async () => { client.setQueryData(["ListOpenPaymentReconciliationExceptions", null], { paymentReconciliationExceptions: [exception] }); });
    expect(await screen.findByRole("button", { name: "Mark reviewed" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/Exception marked reviewed, but the latest list could not be loaded/)).toBeInTheDocument();
    expect(writes).toHaveBeenCalledOnce();

    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
    failRead = false;
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("No open reconciliation exceptions match current filters.")).toBeInTheDocument();
    expect(screen.queryByText(/Exception marked reviewed, but/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
    expect(writes).toHaveBeenCalledOnce();
    expect(reads.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps a failed write actionable without claiming it was reviewed or removing the row", async () => {
    failWrite = true; dashboard(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeEnabled());
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText(/Exception marked reviewed/)).not.toBeInTheDocument();
    expect(openRows).toEqual([exception]);
    expect(writes).toHaveBeenCalledOnce();
  });
});
