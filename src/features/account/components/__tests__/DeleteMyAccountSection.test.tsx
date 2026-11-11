import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { authorizationUpdatePending, privateReadsBlocked, resumeAuthorizationReads } from "../../../../shared/auth/authorizationUpdate";
import { captureSession } from "../../../../shared/appShell/sessionLifecycle";
import DeleteMyAccountSection from "../DeleteMyAccountSection";

const mocks = vi.hoisted(() => ({ call: vi.fn(), credential: vi.fn(() => ({})), reauthenticate: vi.fn(), signOut: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ functions: {}, auth: {} }));
vi.mock("../../../../shared/utils/sessionCallable", () => ({ httpsCallable: () => mocks.call }));
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: mocks.credential },
  reauthenticateWithCredential: mocks.reauthenticate,
  signOut: mocks.signOut,
}));

const member = () => createMockUser({ uid: "member-1", email: "member@example.com", providerData: [{ providerId: "password", uid: "member@example.com", displayName: null, email: "member@example.com", phoneNumber: null, photoURL: null }] });
async function openAndCheck() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete my account" }));
  await user.click(screen.getByRole("button", { name: "Check account" }));
  await screen.findByRole("button", { name: "Permanently delete my account" });
  return user;
}
async function confirmDeletion(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Type your account email to confirm"), "member@example.com");
  const password = screen.queryByLabelText("Current password for account deletion");
  if (password) await user.type(password, "existing-password");
  await user.click(screen.getByRole("checkbox", { name: /I understand that deleting my account will end my membership/ }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("DeleteMyAccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.call.mockReset();
    mocks.reauthenticate.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it("warns membership ends and cancelling makes no deletion request", async () => {
    render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(screen.getByText(/Deleting your account will end your SODC membership/)).toHaveTextContent("This action cannot be undone");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it("previews without UID or retention attestations and requires all confirmations", async () => {
    mocks.call.mockResolvedValue({ data: { eligible: true } });
    render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
    const user = await openAndCheck();
    expect(mocks.call).toHaveBeenCalledWith({ email: "member@example.com", operationId: expect.any(String), apply: false, confirmMembershipEnd: false });
    expect(mocks.reauthenticate).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Permanently delete my account" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Type your account email to confirm"), "wrong@example.com");
    await user.type(screen.getByLabelText("Current password for account deletion"), "existing-password");
    await user.click(screen.getByRole("checkbox"));
    expect(confirm).toBeDisabled();
    await user.clear(screen.getByLabelText("Type your account email to confirm"));
    await user.type(screen.getByLabelText("Type your account email to confirm"), "MEMBER@example.com");
    expect(confirm).toBeEnabled();
  });

  it("routes blocked accounts to administrator review without changing membership", async () => {
    mocks.call.mockResolvedValue({ data: { eligible: false } });
    render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Check account" }));
    expect(await screen.findByText(/Your account needs administrator review/)).toHaveTextContent("Your membership has not been changed");
    expect(screen.queryByRole("button", { name: "Permanently delete my account" })).not.toBeInTheDocument();
    expect(mocks.reauthenticate).not.toHaveBeenCalled();
  });

  it("reauthenticates, refreshes the token and signs out only after confirmed deletion", async () => {
    const result = deferred<{ data: { deleted: boolean } }>();
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } }).mockReturnValueOnce(result.promise);
    const account = member();
    render(<DeleteMyAccountSection user={account} isAdmin={false} />);
    const user = await openAndCheck();
    await confirmDeletion(user);
    await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
    await screen.findByRole("status");
    expect(mocks.credential).toHaveBeenCalledWith("member@example.com", "existing-password");
    expect(mocks.reauthenticate).toHaveBeenCalledWith(account, {});
    expect(account.getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.call).toHaveBeenLastCalledWith({ email: "member@example.com", operationId: expect.any(String), apply: true, confirmMembershipEnd: true });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => result.resolve({ data: { deleted: true } }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });

  it("does not submit deletion after an incorrect password", async () => {
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } });
    mocks.reauthenticate.mockRejectedValueOnce(new Error("wrong-password"));
    render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
    const user = await openAndCheck(); await confirmDeletion(user);
    await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
    expect(await screen.findByText(/We couldn’t verify your sign-in/)).toBeInTheDocument();
    expect(mocks.call).toHaveBeenCalledOnce();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("allows a failed read-only check to be retried without starting deletion", async () => {
    mocks.call.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { eligible: true } });
    render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Check account" }));
    expect(await screen.findByText(/We couldn’t check your account/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check account" }));
    expect(await screen.findByRole("button", { name: "Permanently delete my account" })).toBeDisabled();
    expect(mocks.call.mock.calls.every(([request]) => request.apply === false)).toBe(true);
    expect(mocks.reauthenticate).not.toHaveBeenCalled();
  });

  it("does not describe confirmed deletion as failed when signout fails", async () => {
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } }).mockResolvedValueOnce({ data: { deleted: true } });
    mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
    const user = await openAndCheck(); await confirmDeletion(user);
    await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
    expect(await screen.findByText(/Your account was deleted, but we couldn’t sign you out/)).toBeInTheDocument();
    expect(screen.queryByText(/Deletion could not be confirmed/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
  });

  it("never submits or signs out a replacement session after reauthentication", async () => {
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } });
    const reauth = deferred<void>();
    mocks.reauthenticate.mockReturnValueOnce(reauth.promise);
    const lifecycle = createSessionLifecycle(); lifecycle.observe("member-1");
    const signOut = vi.fn();
    const uninstall = installSessionRuntime({ lifecycle, retire: vi.fn(), signOut });
    try {
      render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
      const user = await openAndCheck(); await confirmDeletion(user);
      await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
      lifecycle.retire();
      await act(async () => reauth.resolve());
      expect(mocks.call).toHaveBeenCalledOnce();
      expect(signOut).not.toHaveBeenCalled();
    } finally { uninstall(); }
  });

  it("holds private reads during apply and keeps uncertain deletion blocked until signout", async () => {
    const result = deferred<never>();
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } }).mockReturnValueOnce(result.promise);
    const lifecycle = createSessionLifecycle(); lifecycle.observe("member-1");
    const signOut = vi.fn().mockResolvedValue(undefined);
    const uninstall = installSessionRuntime({ lifecycle, retire: vi.fn(), signOut });
    const session = captureSession("member-1");
    try {
      render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
      const user = await openAndCheck(); await confirmDeletion(user);
      await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
      await screen.findByRole("status");
      expect(authorizationUpdatePending(session)).toBe(true);
      expect(privateReadsBlocked(session)).toBe(true);
      await act(async () => result.reject(new Error("network timeout")));
      expect(await screen.findByText(/Deletion could not be confirmed/)).toHaveTextContent("contact an administrator");
      expect(screen.queryByRole("button", { name: "Permanently delete my account" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
      expect(privateReadsBlocked(session)).toBe(true);
      await user.click(screen.getByRole("button", { name: "Sign out" }));
      expect(signOut).toHaveBeenCalledOnce();
    } finally { resumeAuthorizationReads(session); uninstall(); }
  });

  it.each([false, true])("signs out the same session if the dialog unmounts during apply, failure=%s", async fails => {
    const result = deferred<{ data: { deleted: boolean } }>();
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } }).mockReturnValueOnce(result.promise);
    const lifecycle = createSessionLifecycle(); lifecycle.observe("member-1");
    const signOut = vi.fn().mockResolvedValue(undefined);
    const uninstall = installSessionRuntime({ lifecycle, retire: vi.fn(), signOut });
    const session = captureSession("member-1");
    try {
      const view = render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
      const user = await openAndCheck(); await confirmDeletion(user);
      await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
      await screen.findByRole("status");
      view.unmount();
      await act(async () => { if (fails) result.reject(new Error("timeout")); else result.resolve({ data: { deleted: true } }); });
      await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
      expect(privateReadsBlocked(session)).toBe(true);
    } finally { resumeAuthorizationReads(session); uninstall(); }
  });

  it("resumes private reads if navigation interrupts cancellation before deletion is submitted", async () => {
    const cancellation = deferred<void>();
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } });
    const lifecycle = createSessionLifecycle(); lifecycle.observe("member-1");
    const signOut = vi.fn().mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "cancelQueries").mockReturnValueOnce(cancellation.promise);
    const uninstall = installSessionRuntime({ lifecycle, retire: vi.fn(), signOut, queryClient });
    const session = captureSession("member-1");
    try {
      const view = render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
      const user = await openAndCheck(); await confirmDeletion(user);
      await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
      await waitFor(() => expect(queryClient.cancelQueries).toHaveBeenCalledOnce());
      expect(privateReadsBlocked(session)).toBe(true);
      view.unmount();
      await act(async () => cancellation.resolve());
      expect(mocks.call).toHaveBeenCalledOnce();
      expect(signOut).not.toHaveBeenCalled();
      expect(privateReadsBlocked(session)).toBe(false);
      expect(authorizationUpdatePending(session)).toBe(false);
    } finally { resumeAuthorizationReads(session); uninstall(); }
  });

  it("never signs out a replacement session after the deletion response arrives", async () => {
    const result = deferred<{ data: { deleted: boolean } }>();
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } }).mockReturnValueOnce(result.promise);
    const lifecycle = createSessionLifecycle(); lifecycle.observe("member-1");
    const signOut = vi.fn().mockResolvedValue(undefined);
    const uninstall = installSessionRuntime({ lifecycle, retire: vi.fn(), signOut });
    const session = captureSession("member-1");
    try {
      render(<DeleteMyAccountSection user={member()} isAdmin={false} />);
      const user = await openAndCheck(); await confirmDeletion(user);
      await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
      await screen.findByRole("status");
      act(() => lifecycle.retire());
      await act(async () => result.resolve({ data: { deleted: true } }));
      expect(signOut).not.toHaveBeenCalled();
    } finally { resumeAuthorizationReads(session); uninstall(); }
  });

  it("requires a recent sign-in for other providers without guessing a password", async () => {
    mocks.call.mockResolvedValueOnce({ data: { eligible: true } }).mockRejectedValueOnce({ details: { code: "RECENT_LOGIN_REQUIRED" } });
    render(<DeleteMyAccountSection user={createMockUser({ uid: "member-1", email: "member@example.com" })} isAdmin={false} />);
    const user = await openAndCheck();
    expect(screen.getByText(/must have signed in within the last five minutes/)).toBeInTheDocument();
    await confirmDeletion(user);
    await user.click(screen.getByRole("button", { name: "Permanently delete my account" }));
    expect(await screen.findByText(/Please sign out and sign in again/)).toBeInTheDocument();
    expect(mocks.reauthenticate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("keeps administrator self-deletion unavailable", () => {
    render(<DeleteMyAccountSection user={member()} isAdmin />);
    expect(screen.getByText(/Administrator accounts need a separate review/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete my account" })).not.toBeInTheDocument();
  });

  it("directs accounts with no email to an administrator", () => {
    render(<DeleteMyAccountSection user={createMockUser({ email: null })} isAdmin={false} />);
    expect(screen.getByText("Contact an administrator to request deletion of this account.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete my account" })).not.toBeInTheDocument();
  });
});
