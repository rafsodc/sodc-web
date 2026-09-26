import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { signOut } from "firebase/auth";
import { auth } from "../../../../config/firebase";
import { updateUserEmail } from "../../../../shared/utils/firebaseFunctions";
import ChangeUserEmailDialog from "../ChangeUserEmailDialog";

vi.mock("firebase/auth", () => ({ signOut: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ auth: { currentUser: { uid: "admin" } }, functions: {} }));
vi.mock("../../../../shared/utils/firebaseFunctions", async (original) => {
  const actual = await original<typeof import("../../../../shared/utils/firebaseFunctions")>();
  return { ...actual, updateUserEmail: vi.fn() };
});

const result = { success: true as const, email: "new@example.org", verificationRequired: true, verificationEmailSent: true };
function setup(userId = "member", onChanged = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(<ChangeUserEmailDialog userId={userId} currentEmail="old@example.org" onClose={onClose} onChanged={onChanged} />);
  return { onClose, onChanged };
}
function confirmAndSubmit() {
  fireEvent.change(screen.getByLabelText(/New email address/), { target: { value: " NEW@EXAMPLE.ORG " } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
}

describe("ChangeUserEmailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateUserEmail).mockResolvedValue(result);
  });

  it("requires confirmation, submits both addresses and shows verification instructions", async () => {
    const { onChanged, onClose } = setup();
    expect(screen.getByRole("button", { name: "Change email" })).toBeDisabled();
    confirmAndSubmit();
    await screen.findByText(/profile and sign-in email are now new@example.org/);
    expect(updateUserEmail).toHaveBeenCalledWith("member", "new@example.org", "old@example.org");
    expect(onChanged).toHaveBeenCalledWith("new@example.org");
    expect(screen.getByText(/A verification email has been sent/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("clears confirmation if the address changes again", () => {
    setup();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText(/New email address/), { target: { value: "changed@example.org" } });
    expect(screen.getByRole("button", { name: "Change email" })).toBeDisabled();
  });

  it("allows cancellation without writing", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(updateUserEmail).not.toHaveBeenCalled();
  });

  it("preserves the new address and allows retry after a partial failure", async () => {
    vi.mocked(updateUserEmail).mockRejectedValueOnce({ details: { code: "EMAIL_CHANGE_INCOMPLETE" } });
    setup();
    confirmAndSubmit();
    await screen.findByText(/sign-in email may already have changed/);
    expect(screen.getByLabelText(/New email address/)).toHaveValue("NEW@EXAMPLE.ORG");
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    await screen.findByText(/profile and sign-in email are now/);
    expect(updateUserEmail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(updateUserEmail).mock.calls[0]).toEqual(vi.mocked(updateUserEmail).mock.calls[1]);
  });

  it("reports duplicate addresses without closing", async () => {
    vi.mocked(updateUserEmail).mockRejectedValue({ code: "functions/already-exists" });
    const { onClose } = setup();
    confirmAndSubmit();
    await screen.findByText("This email address is already linked to another account.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("distinguishes delivery failure from an unsuccessful email update", async () => {
    vi.mocked(updateUserEmail).mockResolvedValue({ ...result, verificationEmailSent: false });
    setup();
    confirmAndSubmit();
    await screen.findByText(/verification email could not be sent/);
    expect(screen.getByText(/profile and sign-in email are now/)).toBeInTheDocument();
  });

  it("retains a successful result when refreshing the user list fails", async () => {
    setup("member", vi.fn().mockRejectedValue(new Error("offline")));
    confirmAndSubmit();
    await screen.findByText(/user list could not refresh/);
    expect(screen.getByText(/profile and sign-in email are now/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change email" })).not.toBeInTheDocument();
  });

  it("signs out an administrator who changes their own address after showing next steps", async () => {
    const { onClose } = setup("admin");
    confirmAndSubmit();
    await screen.findByText("You will be signed out when you select Done.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeEnabled());
    expect(signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledWith(auth));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
