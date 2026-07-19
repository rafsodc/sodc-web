import { act, fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmailVerification } from "firebase/auth";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import EmailVerificationMessage from "../EmailVerificationMessage";

vi.mock("firebase/auth", () => ({
  sendEmailVerification: vi.fn(),
}));

describe("EmailVerificationMessage", () => {
  beforeEach(() => {
    vi.mocked(sendEmailVerification).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resends with fixed application-owned action settings", async () => {
    const user = createMockUser({ emailVerified: false });
    render(<EmailVerificationMessage user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    await waitFor(() => expect(sendEmailVerification).toHaveBeenCalledWith(
      user,
      {
        url: `${window.location.origin}/profile-completion`,
        handleCodeInApp: false,
      },
    ));
    expect(screen.getByText(/link will open this application/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /I've clicked the link/i })).not.toBeInTheDocument();
  });

  it("prevents repeated sends during a 60-second cooldown", async () => {
    vi.useFakeTimers();
    const user = createMockUser({ emailVerified: false });
    render(<EmailVerificationMessage user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Resend available in 60s" }));
    expect(sendEmailVerification).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeEnabled();
  });

  it.each([
    ["auth/too-many-requests", /too many verification emails/i],
    ["auth/network-request-failed", /could not connect/i],
    ["auth/unauthorized-continue-uri", /not configured for this site/i],
    ["auth/internal-error", /could not send a verification email/i],
  ])("shows a safe resend error for %s", async (code, expectedMessage) => {
    vi.mocked(sendEmailVerification).mockRejectedValue({ code, message: "raw Firebase detail" });
    render(<EmailVerificationMessage user={createMockUser({ emailVerified: false })} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("raw Firebase detail");
  });
});
