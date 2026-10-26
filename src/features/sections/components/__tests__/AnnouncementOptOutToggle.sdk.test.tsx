import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, type DataConnect } from "firebase/data-connect";
import { connectorConfig, getSectionAnnouncementOptOutRef } from "@dataconnect/generated";
import AnnouncementOptOutToggle from "../AnnouncementOptOutToggle";

// Keep the actual app-owned hook, generated mutation and installed SDK cache.
// Only the final SDK transport is synthetic; no session or provider is used.
vi.unmock("firebase/data-connect");
const state = vi.hoisted(() => ({ dc: null as DataConnect | null }));
vi.mock("../../../../config/firebase", () => ({get dataConnect() { return state.dc; }}));
type TestDataConnect = DataConnect & {_transportClass: new () => {
  invokeQuery: () => Promise<unknown>; invokeMutation: () => Promise<unknown>;
}};
let app: FirebaseApp | undefined;
let client: QueryClient | undefined;
afterEach(async () => {cleanup(); client?.clear(); if (app) await deleteApp(app); state.dc = null;});

it.each([false, true])("renders confirmed preferences from the server after a real generated write, refresh retry=%s", async failFirstRefresh => {
  let optedOut = false, failRead = false, queryCount = 0, mutationCount = 0;
  app = initializeApp({projectId: "preference-cache-test", apiKey: "fake"});
  const dc = getDataConnect(app, connectorConfig) as TestDataConnect;
  dc._transportClass = class {
    _setCallerSdkType() {}
    async invokeQuery() {
      queryCount++;
      if (failRead) { failRead = false; throw new Error("offline"); }
      return {data: {sectionAnnouncementOptOut: optedOut ? {createdAt: "2026-10-26T00:00:00Z"} : null}, extensions: {}};
    }
    async invokeMutation() {
      mutationCount++; optedOut = true; failRead = failFirstRefresh;
      return {data: {}, extensions: {}};
    }
  };
  state.dc = dc;
  client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 30_000}, mutations: {retry: false}}});
  const ref = getSectionAnnouncementOptOutRef(dc, {sectionId: "section-1"});
  await executeQuery(ref); // Warm the SDK cache before mounting the real reader.
  render(<QueryClientProvider client={client}><AnnouncementOptOutToggle sectionId="section-1" /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", {name: "Turn Off Emails"}));
  if (failFirstRefresh) {
    expect(await screen.findByText(/Your email preference was saved, but/)).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Turn On Emails"})).toBeDisabled();
    await user.click(screen.getByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Your email preference was saved, but/)).not.toBeInTheDocument());
  }
  await waitFor(() => expect(screen.getByRole("button", {name: "Turn On Emails"})).toBeEnabled());
  expect(mutationCount).toBe(1);
  expect(queryCount).toBe(failFirstRefresh ? 4 : 3);
  const readsBeforeCachedLookup = queryCount;
  expect((await executeQuery(ref)).data.sectionAnnouncementOptOut).not.toBeNull();
  expect(queryCount).toBe(readsBeforeCachedLookup);
  expect(client.getQueryData(["GetSectionAnnouncementOptOut", {sectionId: "section-1"}])).toMatchObject({sectionAnnouncementOptOut: {createdAt: "2026-10-26T00:00:00Z"}});
});
