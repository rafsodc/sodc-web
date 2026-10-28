import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { DataConnect } from "firebase/data-connect";

const server = vi.hoisted(() => ({
  status: "PENDING", fail: false, reads: [] as string[],
  holdNextRead: false, release: null as (() => void) | null,
  reconciliation: vi.fn(async () => undefined),
}));
vi.mock("firebase/data-connect", async () => vi.importActual("firebase/data-connect"));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reconcileMyCheckoutSessionOrders: server.reconciliation,
}));
vi.mock("../../../../config/firebase", async () => {
  const appSdk = await vi.importActual<typeof import("firebase/app")>("firebase/app");
  const sdk = await vi.importActual<typeof import("firebase/data-connect")>("firebase/data-connect");
  const app = appSdk.initializeApp({ projectId: "demo-checkout-freshness", apiKey: "fake" }, "checkout-freshness");
  const dc = sdk.getDataConnect(app, { connector: "api", service: "test", location: "europe-west2" });
  // Test transport only; production uses only the SDK's public query API.
  (dc as DataConnect & { _transportClass: unknown })._transportClass = class {
    async invokeQuery(name: string, variables?: { id?: string }) {
      server.reads.push(name);
      if (server.fail) throw new Error("Synthetic server unavailable");
      const order = { id: variables?.id ?? "11111111-1111-1111-1111-111111111111", status: server.status,
        ticketType: { title: "Member Ticket" }, event: { title: "Spring Gala" }, quantity: 1,
        totalAmountMinor: 2500, currency: "gbp" };
      if (server.holdNextRead) {
        server.holdNextRead = false;
        await new Promise<void>(resolve => { server.release = resolve; });
      }
      return { data: name === "GetMyTicketOrderById" ? { user: { ticketOrders: [order] } } :
        name === "GetMyTicketOrders" ? { user: { id: "member", ticketOrders: [order] } } :
        { user: { id: "member", bookings: [] } }, extensions: {} };
    }
  };
  return { dataConnect: dc, firebaseApp: app };
});

import { deleteApp } from "firebase/app";
import { executeQuery, QueryFetchPolicy } from "firebase/data-connect";
import { getMyTicketOrderByIdRef } from "@dataconnect/generated";
import { dataConnect, firebaseApp } from "../../../../config/firebase";
import { createAppQueryClient } from "../../../../shared/query/queryClient";
import { dataConnectQueryOptions } from "../../../../shared/query/authoritativeDataConnect";
import CheckoutStatusNotice from "../CheckoutStatusNotice";

const orderId = "11111111-1111-1111-1111-111111111111";
const clients: ReturnType<typeof createAppQueryClient>[] = [];
function mount(id = orderId) {
  const client = createAppQueryClient(); clients.push(client);
  return { client, ...render(<QueryClientProvider client={client}>
    <CheckoutStatusNotice checkoutState="success" orderId={id} onDismiss={() => undefined} />
  </QueryClientProvider>) };
}
beforeEach(() => {
  server.status = "PENDING"; server.fail = false; server.reads = [];
  server.holdNextRead = false; server.release = null;
  server.reconciliation.mockReset(); server.reconciliation.mockResolvedValue(undefined);
});
afterEach(async () => {
  cleanup();
  for (const client of clients.splice(0)) { await client.cancelQueries(); client.clear(); }
  vi.useRealTimers();
});
afterAll(async () => { await deleteApp(firebaseApp); });

describe("checkout authoritative payment state with the installed SDK", () => {
  it("shows the confirmed payment after reconciliation despite a primed pending SDK cache", async () => {
    const ref = getMyTicketOrderByIdRef(dataConnect, { id: orderId });
    await executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
    server.reconciliation.mockImplementation(async () => { server.status = "PAID"; });
    mount();
    expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
    expect(screen.getByText("Amount: £25.00")).toBeInTheDocument();
    expect(server.reads.filter(name => name === "GetMyTicketOrderById").length).toBeGreaterThanOrEqual(2);
    expect((await executeQuery(ref)).data.user?.ticketOrders[0]?.status).toBe("PAID");
    expect(server.reconciliation).toHaveBeenCalledTimes(1);
  });

  it("cancels a pre-reconciliation load and keeps the confirmed state when its old response arrives late", async () => {
    server.holdNextRead = true;
    server.reconciliation.mockImplementation(async () => {
      await vi.waitFor(() => expect(server.release).not.toBeNull());
      server.status = "PAID";
    });
    mount();
    expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
    await act(async () => { server.release!(); await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Payment processing")).not.toBeInTheDocument();
    expect(server.reconciliation).toHaveBeenCalledTimes(1);
  });

  it("polls the actual server and reaches refunded state rather than reusing pending data", async () => {
    mount();
    expect(await screen.findByText("Payment processing")).toBeInTheDocument();
    await waitFor(() => expect(server.reads.filter(name => name === "GetMyTicketOrderById").length).toBeGreaterThanOrEqual(2));
    server.status = "REFUNDED";
    expect(await screen.findByText("Payment refunded", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(server.reconciliation).toHaveBeenCalledTimes(1);
  });

  it.each(["PAID", "REFUNDED"])("refreshes inactive member views when a later poll observes %s", async status => {
    const { getMyTicketOrdersRef } = await import("@dataconnect/generated");
    const client = createAppQueryClient(); clients.push(client);
    const options = dataConnectQueryOptions(getMyTicketOrdersRef(dataConnect));
    await client.fetchQuery(options);
    render(<QueryClientProvider client={client}>
      <CheckoutStatusNotice checkoutState="success" orderId={orderId} onDismiss={() => undefined} />
    </QueryClientProvider>);
    await screen.findByText("Payment processing");
    // Reconciliation completes while the provider still reports PENDING.
    await waitFor(() => expect(server.reads.filter(name => name === "GetMyTicketOrders").length).toBeGreaterThanOrEqual(2));
    expect(client.getQueryData(options.queryKey)?.user?.ticketOrders[0]?.status).toBe("PENDING");
    server.status = status;
    await screen.findByText(status === "PAID" ? "Payment confirmed" : "Payment refunded", {}, { timeout: 5000 });
    await waitFor(() => expect(client.getQueryData(options.queryKey)?.user?.ticketOrders[0]?.status).toBe(status));
    const reads = server.reads.length;
    expect((await client.fetchQuery(options)).user?.ticketOrders[0]?.status).toBe(status);
    expect(server.reads.length).toBe(reads);
    expect(server.reconciliation).toHaveBeenCalledTimes(1);
  }, 15000);

  it("reports a failed fresh read and retries only the read without replaying reconciliation", async () => {
    server.status = "PAID";
    await executeQuery(getMyTicketOrderByIdRef(dataConnect, { id: orderId }), { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
    server.fail = true;
    const { client } = mount();
    client.setDefaultOptions({ queries: { retry: false } });
    expect(await screen.findByText("Unable to load order status", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
    server.fail = false;
    const reconciliations = server.reconciliation.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
    expect(server.reconciliation).toHaveBeenCalledTimes(reconciliations);
  });

  it("refreshes an inactive booking view from the server after a confirmed checkout", async () => {
    const { getMyTicketOrdersRef } = await import("@dataconnect/generated");
    const client = createAppQueryClient(); clients.push(client);
    const options = dataConnectQueryOptions(getMyTicketOrdersRef(dataConnect));
    await client.fetchQuery(options);
    expect(client.getQueryData(options.queryKey)?.user?.ticketOrders[0]?.status).toBe("PENDING");
    server.reconciliation.mockImplementation(async () => { server.status = "PAID"; });
    render(<QueryClientProvider client={client}>
      <CheckoutStatusNotice checkoutState="success" orderId={orderId} onDismiss={() => undefined} />
    </QueryClientProvider>);
    await screen.findByText("Payment confirmed");
    await waitFor(() => expect(client.getQueryData(options.queryKey)?.user?.ticketOrders[0]?.status).toBe("PAID"));
    const reads = server.reads.length;
    expect((await client.fetchQuery(options)).user?.ticketOrders[0]?.status).toBe("PAID");
    expect(server.reads.length).toBe(reads);
  });
});
