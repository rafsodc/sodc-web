import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import { sendPasswordResetEmail } from "firebase/auth";
import PasswordResetRequestPage from "../PasswordResetRequestPage";

vi.mock("firebase/auth", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PasswordResetRequestPage />
    </MemoryRouter>,
  );
}

describe("PasswordResetRequestPage", () => {
  beforeEach(() => {
    vi.mocked(sendPasswordResetEmail).mockReset();
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
  });

  it("normalises the email and sends fixed application-owned action settings", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/i), "  MEMBER@Example.COM  ");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      "member@example.com",
      {
        url: `${window.location.origin}/account`,
        handleCodeInApp: false,
      },
    ));
    expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
  });

  it("shows the same neutral response when Firebase reports an unknown account", async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue({ code: "auth/user-not-found" });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/i), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });

  it("rejects a malformed email before calling Firebase", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["auth/too-many-requests", /too many reset requests/i],
    ["auth/network-request-failed", /could not connect/i],
    ["auth/internal-error", /could not send a password reset email/i],
  ])("maps %s to a safe error", async (code, expectedMessage) => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue({ code });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/i), "member@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
  });

  it("disables repeat submission while the request is in flight", async () => {
    let finishRequest!: () => void;
    vi.mocked(sendPasswordResetEmail).mockImplementation(() => new Promise<void>((resolve) => {
      finishRequest = resolve;
    }));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^Email/i), "member@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByRole("button", { name: "Sending reset link" })).toBeDisabled();
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
    finishRequest();
    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
  });
});
