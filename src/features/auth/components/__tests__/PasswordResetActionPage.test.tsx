import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import PasswordResetActionPage from "../PasswordResetActionPage";

vi.mock("firebase/auth", () => ({
  confirmPasswordReset: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
}));

function renderPage(search = "?mode=resetPassword&oobCode=valid-code") {
  return render(
    <MemoryRouter initialEntries={[`/auth/action${search}`]}>
      <PasswordResetActionPage />
    </MemoryRouter>,
  );
}

async function fillValidPasswords(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^New password/i), "a-secure-password");
  await user.type(screen.getByLabelText(/^Confirm new password/i), "a-secure-password");
}

describe("PasswordResetActionPage", () => {
  beforeEach(() => {
    vi.mocked(verifyPasswordResetCode).mockReset();
    vi.mocked(confirmPasswordReset).mockReset();
    vi.mocked(verifyPasswordResetCode).mockResolvedValue("member@example.com");
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined);
  });

  it("verifies the code before enabling password completion", async () => {
    renderPage();

    expect(screen.getByRole("status", { name: "Checking password reset link" })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^New password/i)).toBeInTheDocument();
    expect(verifyPasswordResetCode).toHaveBeenCalledWith(expect.anything(), "valid-code");
  });

  it.each([
    ["?mode=verifyEmail&oobCode=valid-code"],
    ["?mode=resetPassword"],
    ["?oobCode=valid-code"],
  ])("rejects malformed or wrong-mode action parameters: %s", async (search) => {
    renderPage(search);

    expect(await screen.findByText(/link is invalid/i)).toBeInTheDocument();
    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute(
      "href",
      "/account/password-reset",
    );
  });

  it("handles an expired or invalid code without exposing Firebase details", async () => {
    vi.mocked(verifyPasswordResetCode).mockRejectedValue({ code: "auth/expired-action-code" });
    renderPage();

    expect(await screen.findByText(/link is invalid, has expired, or has already been used/i)).toBeInTheDocument();
    expect(screen.queryByText(/auth\/expired-action-code/i)).not.toBeInTheDocument();
  });

  it("lets the user retry a network failure while verifying the code", async () => {
    vi.mocked(verifyPasswordResetCode)
      .mockRejectedValueOnce({ code: "auth/network-request-failed" })
      .mockResolvedValueOnce("member@example.com");
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/could not connect/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try checking the link again" }));

    expect(await screen.findByLabelText(/^New password/i)).toBeInTheDocument();
    expect(verifyPasswordResetCode).toHaveBeenCalledTimes(2);
  });

  it("uses the shared password policy and requires matching confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/^New password/i), "short");
    await user.type(screen.getByLabelText(/^Confirm new password/i), "short");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Password must be at least 12 characters");

    await user.clear(screen.getByLabelText(/^New password/i));
    await user.clear(screen.getByLabelText(/^Confirm new password/i));
    await user.type(screen.getByLabelText(/^New password/i), "a-secure-password");
    await user.type(screen.getByLabelText(/^Confirm new password/i), "different-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("completes the reset and ignores an attacker-controlled continue URL", async () => {
    const user = userEvent.setup();
    renderPage("?mode=resetPassword&oobCode=valid-code&continueUrl=https://evil.example/phish");
    await fillValidPasswords(user);

    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith(
      expect.anything(),
      "valid-code",
      "a-secure-password",
    ));
    expect(screen.getByText(/sign in again with your new password/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/account");
    expect(document.body).not.toHaveTextContent("evil.example");
  });

  it("moves a code rejected during confirmation to the recovery state", async () => {
    vi.mocked(confirmPasswordReset).mockRejectedValue({ code: "auth/invalid-action-code" });
    const user = userEvent.setup();
    renderPage();
    await fillValidPasswords(user);

    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText(/link is invalid/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toBeInTheDocument();
  });

  it("shows retryable completion errors safely", async () => {
    vi.mocked(confirmPasswordReset).mockRejectedValue({ code: "auth/network-request-failed" });
    const user = userEvent.setup();
    renderPage();
    await fillValidPasswords(user);

    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText(/could not connect/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
  });
});
