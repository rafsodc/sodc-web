import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  reload,
  verifyPasswordResetCode,
} from "firebase/auth";
import AuthActionPage from "../AuthActionPage";
import { reconcileMyEmail } from "../../../../shared/utils/firebaseFunctions";
import { auth } from "../../../../config/firebase";
import { createMockUser } from "../../../../test-utils/mocks/firebase";

const mutableAuth = auth as unknown as {
  currentUser: ReturnType<typeof createMockUser> | null;
};

vi.mock("firebase/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("firebase/auth")>();
  return {
    ...original,
    applyActionCode: vi.fn(),
    checkActionCode: vi.fn(),
    reload: vi.fn(),
    verifyPasswordResetCode: vi.fn(),
    confirmPasswordReset: vi.fn(),
  };
});

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reconcileMyEmail: vi.fn(),
}));

describe("AuthActionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableAuth.currentUser = null;
  });

  function renderAction(search: string) {
    return render(
      <MemoryRouter initialEntries={[`/auth/action${search}`]}>
        <AuthActionPage />
      </MemoryRouter>,
    );
  }

  it("verifies the code and completes a password reset", async () => {
    vi.mocked(verifyPasswordResetCode).mockResolvedValue("member@example.org");
    vi.mocked(confirmPasswordReset).mockResolvedValue();
    renderAction("?mode=resetPassword&oobCode=valid-code");

    expect(await screen.findByLabelText(/New password/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/New password/), {
      target: { value: "a-secure-password" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm new password/), {
      target: { value: "a-secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() =>
      expect(confirmPasswordReset).toHaveBeenCalledWith(
        expect.anything(),
        "valid-code",
        "a-secure-password",
      )
    );
    expect(await screen.findByText("Your password has been reset.")).toBeInTheDocument();
  });

  it("rejects unsupported action modes without calling Firebase", async () => {
    renderAction("?mode=recoverEmail&oobCode=some-code");

    expect(await screen.findByText("This email action link is invalid.")).toBeInTheDocument();
    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeInTheDocument();
  });

  it("offers a new link when the code has expired", async () => {
    vi.mocked(verifyPasswordResetCode).mockRejectedValue({
      code: "auth/expired-action-code",
    });
    renderAction("?mode=resetPassword&oobCode=expired-code");

    expect(
      await screen.findByText("This reset link has expired. Request a new one to continue."),
    ).toBeInTheDocument();
  });

  it("checks and applies an email verification code", async () => {
    vi.mocked(checkActionCode).mockResolvedValue({} as never);
    vi.mocked(applyActionCode).mockResolvedValue();
    vi.mocked(reload).mockResolvedValue();
    renderAction("?mode=verifyEmail&oobCode=verification-code");

    expect(
      await screen.findByText("Your email address has been verified."),
    ).toBeInTheDocument();
    expect(checkActionCode).toHaveBeenCalledWith(expect.anything(), "verification-code");
    expect(applyActionCode).toHaveBeenCalledWith(expect.anything(), "verification-code");
  });

  it("applies a verify-and-change-email code", async () => {
    mutableAuth.currentUser = createMockUser({ email: "new@example.org" });
    vi.mocked(checkActionCode).mockResolvedValue({} as never);
    vi.mocked(applyActionCode).mockResolvedValue();
    vi.mocked(reload).mockResolvedValue();
    vi.mocked(reconcileMyEmail).mockResolvedValue("new@example.org");
    renderAction("?mode=verifyAndChangeEmail&oobCode=change-code");

    expect(
      await screen.findByText("Your email address has been changed."),
    ).toBeInTheDocument();
    expect(checkActionCode).toHaveBeenCalledWith(expect.anything(), "change-code");
    expect(applyActionCode).toHaveBeenCalledWith(expect.anything(), "change-code");
    expect(reconcileMyEmail).toHaveBeenCalledOnce();
  });
});
