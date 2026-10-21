import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import PrivateSessionBoundary from "../shared/appShell/PrivateSessionBoundary";
import { consumeLogoutConfirmation, sessionRestartPath } from "../shared/appShell/sessionBrowser";
import { StrictMode, useLayoutEffect } from "react";
import { useAppAuthSession } from "../shared/appShell/useAppAuthSession";
import { runSessionOperation, signOutPrivateSession } from "../shared/appShell/sessionLifecycle";
import { createMockUser } from "../test-utils/mocks/firebase";

const mocks = vi.hoisted(() => ({ listeners: new Set<(user: User | null) => void>(), current: null as User | null, signOut: vi.fn() }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, listener) => {
    mocks.listeners.add(listener);
    listener(mocks.current);
    return () => mocks.listeners.delete(listener);
  }),
  signOut: mocks.signOut,
  reload: vi.fn(),
}));
let client: QueryClient;
let resolveMutation: (() => void) | undefined;
const followOn = vi.fn();
function PrivateView() {
  const { user } = useAppAuthSession();
  const mountedClient = useQueryClient();
  useLayoutEffect(() => { client = mountedClient; }, [mountedClient]);
  const profile = useQuery({ queryKey: ["GetCurrentUser", null], enabled: Boolean(user), queryFn: async () => ({ name: `${user?.uid} private profile` }) });
  const mutate = async () => {
    try {
      await runSessionOperation(() => new Promise<void>((resolve) => { resolveMutation = resolve; }));
      client.setQueryData(["GetMyBookings", null], "late private data");
      followOn();
    } catch { /* A retired request must not progress. */ }
  };
  return <>
    <span>{profile.data?.name ?? "Anonymous"}</span>
    <input aria-label="Private draft" defaultValue="A confidential draft" />
    <button onClick={() => void signOutPrivateSession()}>Logout</button>
    <button onClick={() => void mutate()}>Start mutation</button>
  </>;
}
function observe(user: User | null) {
  mocks.current = user;
  [...mocks.listeners].forEach((listener) => listener(user));
}
beforeEach(() => {
  mocks.listeners.clear();
  mocks.current = createMockUser({ uid: "A" });
  mocks.signOut.mockReset().mockResolvedValue(undefined);
  followOn.mockReset();
  resolveMutation = undefined;
  sessionStorage.clear();
  window.history.replaceState(null, "", "/sections/example");
});
afterEach(() => { window.history.replaceState(null, "", "/"); });

describe("application document session isolation", () => {
  it.each([null, "B"])("removes populated private state before accepting replacement %s", async (uid) => {
    const replace = vi.fn();
    render(<PrivateSessionBoundary replaceDocument={replace}><PrivateView /></PrivateSessionBoundary>);
    expect(await screen.findByText("A private profile")).toBeInTheDocument();
    for (const key of ["GetMyBookings", "GetMyTicketOrders", "GetSectionsForUser", "GetMyAnnouncementPreferences"]) {
      client.setQueryData([key, null], { privateOwner: "A" });
    }
    fireEvent.click(screen.getByText("Start mutation"));
    act(() => observe(uid ? createMockUser({ uid }) : null));
    expect(screen.queryByText("A private profile")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Private draft")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account session ending" })).toBeInTheDocument();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    act(() => observe(createMockUser({ uid: "B" })));
    await act(async () => resolveMutation?.());
    expect(followOn).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/account");
  });
  it("keeps first sign-in and same-UID updates in a pristine anonymous document", async () => {
    mocks.current = null;
    const replace = vi.fn();
    render(<PrivateSessionBoundary replaceDocument={replace}><PrivateView /></PrivateSessionBoundary>);
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(client.getQueryCache().getAll().every((query) => query.state.data === undefined)).toBe(true);
    act(() => observe(createMockUser({ uid: "B" })));
    expect(await screen.findByText("B private profile")).toBeInTheDocument();
    act(() => observe(createMockUser({ uid: "B" })));
    expect(replace).not.toHaveBeenCalled();
  });
  it("hides before awaiting logout, reports failure and retries without a false notice", async () => {
    mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    const replace = vi.fn();
    render(<PrivateSessionBoundary replaceDocument={replace}><PrivateView /></PrivateSessionBoundary>);
    await screen.findByText("A private profile");
    fireEvent.click(screen.getByText("Logout"));
    expect(screen.queryByText("A private profile")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not sign you out");
    expect(replace).not.toHaveBeenCalled();
    expect(consumeLogoutConfirmation()).toBe(false);
    expect(screen.queryByRole("button", { name: "Reload safely" })).not.toBeInTheDocument();
    act(() => observe(createMockUser({ uid: "A" })));
    expect(screen.queryByText("A private profile")).not.toBeInTheDocument();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    fireEvent.click(screen.getByText("Try signing out again"));
    await waitFor(() => expect(replace).toHaveBeenCalledOnce());
    expect(consumeLogoutConfirmation()).toBe(true);
    expect(consumeLogoutConfirmation()).toBe(false);
  });
  it("masks pagehide and restarts persisted pages at their current local URL", async () => {
    const replace = vi.fn();
    document.cookie = "sodc-color-mode-preference=dark; path=/";
    render(<PrivateSessionBoundary replaceDocument={replace}><PrivateView /></PrivateSessionBoundary>);
    await screen.findByText("A private profile");
    act(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    expect(screen.queryByText("A private profile")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    expect(replace).toHaveBeenCalledExactlyOnceWith(window.location.href);
    expect(document.cookie).toContain("sodc-color-mode-preference=dark");
  });
  it("keeps public capability URLs and validates private return targets", () => {
    expect(sessionRestartPath({ pathname: "/guest-ticket", search: "", hash: "#secret" })).toBe("/guest-ticket#secret");
    expect(sessionRestartPath({ pathname: "/auth/action", search: "?mode=verifyEmail", hash: "" })).toBe("/auth/action?mode=verifyEmail");
    expect(sessionRestartPath(window.location, "https://example.com")).toBe("/account");
  });
  it("does not duplicate logout or document replacement under StrictMode", async () => {
    let resolveSignOut!: () => void;
    mocks.signOut.mockImplementation(() => new Promise<void>((resolve) => { resolveSignOut = resolve; }));
    const replace = vi.fn();
    render(<StrictMode><PrivateSessionBoundary replaceDocument={replace}><PrivateView /></PrivateSessionBoundary></StrictMode>);
    await screen.findByText("A private profile");
    let first!: Promise<void>;
    let repeated!: Promise<void>;
    act(() => { first = signOutPrivateSession(); repeated = signOutPrivateSession(); });
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    await act(async () => { resolveSignOut(); await Promise.all([first, repeated]); });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/account");
  });

});
