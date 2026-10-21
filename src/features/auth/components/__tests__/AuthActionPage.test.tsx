import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  reload,
  verifyPasswordResetCode,
  validatePassword,
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
    validatePassword: vi.fn(),
  };
});

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  reconcileMyEmail: vi.fn(),
}));

describe("AuthActionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reconcileMyEmail).mockResolvedValue("verified@example.org");
    mutableAuth.currentUser = null;
    vi.mocked(validatePassword).mockResolvedValue({
      isValid: true,
      passwordPolicy: {
        customStrengthOptions: { minPasswordLength: 12 },
        enforcementState: "ENFORCE",
        forceUpgradeOnSignin: true,
        allowedNonAlphanumericCharacters: "",
      },
    });
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

  it.each(["verifyEmail", "verifyAndChangeEmail"])("reconciles %s holds and refreshes the new version before completion", async mode => {
    const order: string[] = [];
    const user = createMockUser({ uid: "A", emailVerified: false }); mutableAuth.currentUser = user;
    vi.mocked(checkActionCode).mockImplementation(async () => { order.push("check"); return {} as never; });
    vi.mocked(applyActionCode).mockImplementation(async () => { order.push("apply"); });
    vi.mocked(reload).mockImplementation(async () => { order.push("reload"); Object.assign(user, { emailVerified: true }); });
    vi.mocked(reconcileMyEmail).mockImplementation(async () => { order.push("reconcile"); return "verified@example.org"; });
    vi.mocked(user.getIdToken).mockImplementation(async () => { order.push("token"); return "new-access-version"; });
    renderAction(`?mode=${mode}&oobCode=verification-code`);
    await screen.findByText(mode === "verifyEmail" ? "Your email address has been verified." : "Your email address has been changed.");
    expect(order).toEqual(["check", "apply", "reload", "token", "reconcile", "token"]);
  });

  it("offers explicit account retry without reapplying a successful one-time code", async () => {
    const user = createMockUser({ uid: "A", emailVerified: true }); mutableAuth.currentUser = user;
    vi.mocked(checkActionCode).mockResolvedValue({} as never); vi.mocked(applyActionCode).mockResolvedValue(); vi.mocked(reload).mockResolvedValue();
    vi.mocked(reconcileMyEmail).mockRejectedValueOnce({ code: "functions/unavailable" }).mockResolvedValue("verified@example.org");
    renderAction("?mode=verifyEmail&oobCode=verification-code");
    fireEvent.click(await screen.findByRole("button", { name: "Retry account check" }));
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledTimes(3));
    expect(reconcileMyEmail).toHaveBeenCalledTimes(2); expect(applyActionCode).toHaveBeenCalledOnce(); expect(checkActionCode).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry account check" })).not.toBeInTheDocument());
  });

  it("does not reconcile or publish old completion after actual Auth changes during reload", async () => {
    const user = createMockUser({ uid: "A", emailVerified: true }); mutableAuth.currentUser = user;
    let resolve!: () => void;
    vi.mocked(checkActionCode).mockResolvedValue({} as never); vi.mocked(applyActionCode).mockResolvedValue();
    vi.mocked(reload).mockReturnValue(new Promise(done => { resolve = done; }));
    renderAction("?mode=verifyEmail&oobCode=verification-code");
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    mutableAuth.currentUser = createMockUser({ uid: "B" });
    await act(async () => resolve());
    expect(reconcileMyEmail).not.toHaveBeenCalled(); expect(user.getIdToken).not.toHaveBeenCalled();
    expect(screen.queryByText("Your email address has been verified.")).not.toBeInTheDocument();
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
