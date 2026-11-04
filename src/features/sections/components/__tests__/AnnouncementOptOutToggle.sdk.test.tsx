import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { executeQuery, getDataConnect, type DataConnect } from "firebase/data-connect";
import { connectorConfig, getMyAnnouncementPreferencesRef, getSectionAnnouncementOptOutRef, MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/generated";
import AnnouncementOptOutToggle from "../AnnouncementOptOutToggle";
import AccountSettingsPage from "../../../account/components/AccountSettingsPage";
import { MemoryRouter } from "react-router-dom";
import { ColorModeProvider } from "../../../../shared/appShell/ColorModeProvider";
import { CookiePreferencesProvider } from "../../../../shared/cookies/CookiePreferencesProvider";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { dataConnectQueryOptions } from "../../../../shared/query/authoritativeDataConnect";
import { captureSession, createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../../../shared/auth/authorizationUpdate";

// Keep the actual app-owned hook, generated mutation and installed SDK cache.
// Only the final SDK transport is synthetic; no session or provider is used.
vi.unmock("firebase/data-connect");
const state = vi.hoisted(() => ({ dc: null as DataConnect | null }));
vi.mock("../../../../config/firebase", () => ({auth: {currentUser: null}, get dataConnect() { return state.dc; }}));
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

function preferenceTransport(options: { failWrite?: boolean; pauseWrite?: Promise<void> } = {}) {
  const optedOut = new Set<string>(); let mutationCount = 0, queryCount = 0;
  const preferences = () => ({ user: { membershipStatus: MembershipStatus.REGULAR, announcementOptOutAll: false,
    userGroups: [{ userGroup: { membershipStatuses: null, purposeLinks: [{ purposes: [SectionUserGroupPurpose.ACCESS], section: { id: "section-1", name: "Alpha Section" } }] } }],
    optOuts: [...optedOut].map(id => ({ section: { id } })) }, allUserGroups: [] });
  const transport = class {
    _setCallerSdkType() {}
    async invokeQuery(name?: string, variables?: { sectionId: string }) {
      queryCount++;
      if (name === "GetMyAnnouncementPreferences") return { data: preferences(), extensions: {} };
      if (name === "GetSectionAnnouncementOptOut") return { data: { sectionAnnouncementOptOut: optedOut.has(variables!.sectionId) ? { createdAt: "2026-11-03T00:00:00Z" } : null }, extensions: {} };
      throw new Error("Unexpected synthetic preference read");
    }
    async invokeMutation(name?: string, variables?: { sectionId: string }) {
      mutationCount++;
      if (options.failWrite && mutationCount === 1) throw new Error("offline");
      await options.pauseWrite;
      if (name === "OptOutSectionAnnouncement") optedOut.add(variables!.sectionId);
      else if (name === "OptInSectionAnnouncement") optedOut.delete(variables!.sectionId);
      else throw new Error("Unexpected synthetic preference write");
      return { data: {}, extensions: {} };
    }
  };
  return { transport, get mutationCount() { return mutationCount; }, get queryCount() { return queryCount; } };
}
function mountAccount(children?: React.ReactNode) {
  const user = createMockUser({ uid: "preference-member", providerData: [] });
  return render(<QueryClientProvider client={client!}><CookiePreferencesProvider><ColorModeProvider><MemoryRouter>
    <AccountSettingsPage user={user} userData={null} isAdmin={false} />{children}
  </MemoryRouter></ColorModeProvider></CookiePreferencesProvider></QueryClientProvider>);
}

it("a rejected account section save rolls back accessibly; explicit retry refreshes the real section reader and both SDK caches", async () => {
  app = initializeApp({ projectId: "preference-cache-test", apiKey: "fake" });
  const dc = getDataConnect(app, connectorConfig) as TestDataConnect, fake = preferenceTransport({ failWrite: true });
  dc._transportClass = fake.transport; state.dc = dc;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } });
  mountAccount(<AnnouncementOptOutToggle sectionId="section-1" />);
  const user = userEvent.setup(), alpha = await screen.findByRole("switch", { name: "Alpha Section" });
  await screen.findByRole("button", { name: "Turn Off Emails" });
  await user.click(alpha);
  expect(await screen.findByText(/We couldn’t save your email preferences/)).toBeInTheDocument();
  expect(alpha).toBeChecked(); expect(alpha).toBeEnabled();
  expect(screen.getByRole("button", { name: "Turn Off Emails" })).toBeEnabled();
  await user.click(alpha);
  await waitFor(() => { expect(alpha).not.toBeChecked(); expect(alpha).toBeEnabled(); });
  expect(await screen.findByRole("button", { name: "Turn On Emails" })).toBeEnabled();
  expect(fake.mutationCount).toBe(2);
  expect(client.getQueryData(["GetMyAnnouncementPreferences", null])).toMatchObject({ user: { optOuts: [{ section: { id: "section-1" } }] } });
  const count = fake.queryCount;
  expect((await executeQuery(getSectionAnnouncementOptOutRef(dc, { sectionId: "section-1" }))).data.sectionAnnouncementOptOut).not.toBeNull();
  expect((await executeQuery(getMyAnnouncementPreferencesRef(dc))).data.user?.optOuts).toHaveLength(1);
  expect(fake.queryCount).toBe(count);
});

it("a same-session write completing after navigation still refreshes the inactive account preference view", async () => {
  let resolve!: () => void; const pauseWrite = new Promise<void>(done => { resolve = done; });
  app = initializeApp({ projectId: "preference-cache-test", apiKey: "fake" });
  const dc = getDataConnect(app, connectorConfig) as TestDataConnect, fake = preferenceTransport({ pauseWrite });
  dc._transportClass = fake.transport; state.dc = dc;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } });
  await client.fetchQuery(dataConnectQueryOptions(getMyAnnouncementPreferencesRef(dc)));
  const view = render(<QueryClientProvider client={client}><AnnouncementOptOutToggle sectionId="section-1" /></QueryClientProvider>);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Turn Off Emails" }));
  view.unmount();
  await act(async () => { resolve(); await pauseWrite; });
  await waitFor(() => expect(client!.getQueryData(["GetMyAnnouncementPreferences", null])).toMatchObject({ user: { optOuts: [{ section: { id: "section-1" } }] } }));
  mountAccount();
  expect(await screen.findByRole("switch", { name: "Alpha Section" })).not.toBeChecked();
  expect(fake.mutationCount).toBe(1);
});

it("an authorization interruption retires unverified caches and resumes with only authoritative reads", async () => {
  let resolve!: () => void; const pauseWrite = new Promise<void>(done => { resolve = done; });
  app = initializeApp({ projectId: "preference-cache-test", apiKey: "fake" });
  const dc = getDataConnect(app, connectorConfig) as TestDataConnect, fake = preferenceTransport({ pauseWrite });
  dc._transportClass = fake.transport; state.dc = dc;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } });
  const owner = createSessionLifecycle(); owner.observe("preference-member");
  const uninstall = installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() });
  const token = captureSession(); let update: ReturnType<typeof beginAuthorizationUpdate> | undefined;
  try {
    mountAccount(<AnnouncementOptOutToggle sectionId="section-1" />);
    const user = userEvent.setup(); await screen.findByRole("switch", { name: "Alpha Section" });
    await user.click(await screen.findByRole("button", { name: "Turn Off Emails" }));
    act(() => { update = beginAuthorizationUpdate(token); });
    const readsBeforeCommit = fake.queryCount;
    await act(async () => { resolve(); await pauseWrite; });
    expect(await screen.findByText(/Your account changed while updating email preferences/)).toBeInTheDocument();
    expect(fake.queryCount).toBe(readsBeforeCommit);
    expect(client.getQueryState(["GetMyAnnouncementPreferences", null])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["GetSectionAnnouncementOptOut", { sectionId: "section-1" }])?.isInvalidated).toBe(true);
    expect(client.getQueryData(["GetMyAnnouncementPreferences", null])).toMatchObject({ user: { optOuts: [] } });
    expect(screen.getByRole("button", { name: "Reload preferences" })).toBeDisabled();
    act(() => update!.finish(true, true));
    act(() => resumeAuthorizationReads(token));
    await user.click(screen.getByRole("button", { name: "Reload preferences" }));
    await waitFor(() => expect(screen.queryByText(/Your account changed while updating email preferences/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Turn On Emails" })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Alpha Section" })).not.toBeChecked();
    expect(client.getQueryState(["GetMyAnnouncementPreferences", null])?.isInvalidated).toBe(false);
    expect(fake.mutationCount).toBe(1);
    expect(fake.queryCount).toBe(readsBeforeCommit + 2);
  } finally { update?.finish(true); resumeAuthorizationReads(token); uninstall(); }
});
