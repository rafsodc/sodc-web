import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { applyActionCode, checkActionCode, reload, type User } from "firebase/auth";
import { render, screen, waitFor } from "../../../../test-utils";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import EmailVerificationActionPage from "../EmailVerificationActionPage";

let currentUser: User | null = null;

vi.mock("firebase/auth", () => ({
  applyActionCode: vi.fn(),
  checkActionCode: vi.fn(),
  reload: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
}));

function renderPage(
  search = "?mode=verifyEmail&oobCode=valid-code",
  strict = false,
) {
  const page = (
    <MemoryRouter initialEntries={[`/auth/action${search}`]}>
      <EmailVerificationActionPage />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

describe("EmailVerificationActionPage", () => {
  beforeEach(() => {
    currentUser = null;
    vi.mocked(checkActionCode).mockReset().mockResolvedValue({
      data: { email: "test@example.com" },
    } as never);
    vi.mocked(applyActionCode).mockReset().mockResolvedValue(undefined);
    vi.mocked(reload).mockReset().mockResolvedValue(undefined);
  });

  it("checks and applies a valid action code in order", async () => {
    const callOrder: string[] = [];
    vi.mocked(checkActionCode).mockImplementation(async () => {
      callOrder.push("check");
      return { data: { email: "test@example.com" } } as never;
    });
    vi.mocked(applyActionCode).mockImplementation(async () => {
      callOrder.push("apply");
    });

    renderPage();

    expect(screen.getByRole("status", { name: "Verifying email address" })).toBeInTheDocument();
    expect(await screen.findByText("Your email address has been verified.")).toBeInTheDocument();
    expect(callOrder).toEqual(["check", "apply"]);
    expect(checkActionCode).toHaveBeenCalledWith(expect.anything(), "valid-code");
    expect(applyActionCode).toHaveBeenCalledWith(expect.anything(), "valid-code");
  });

  it("deduplicates completion when React StrictMode repeats the effect", async () => {
    renderPage("?mode=verifyEmail&oobCode=strict-code", true);

    expect(await screen.findByText("Your email address has been verified.")).toBeInTheDocument();
    expect(checkActionCode).toHaveBeenCalledTimes(1);
    expect(applyActionCode).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["?mode=resetPassword&oobCode=valid-code"],
    ["?mode=verifyEmail"],
    ["?oobCode=valid-code"],
  ])("rejects malformed or wrong-mode parameters: %s", async (search) => {
    renderPage(search);

    expect(await screen.findByText(/link is invalid, has expired, or has already been used/i)).toBeInTheDocument();
    expect(checkActionCode).not.toHaveBeenCalled();
    expect(applyActionCode).not.toHaveBeenCalled();
  });

  it("shows a safe invalid state for expired and already-used codes", async () => {
    vi.mocked(checkActionCode).mockRejectedValue({
      code: "auth/expired-action-code",
      message: "sensitive Firebase detail",
    });
    renderPage();

    expect(await screen.findByText(/link is invalid, has expired, or has already been used/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("sensitive Firebase detail");
    expect(applyActionCode).not.toHaveBeenCalled();
  });

  it("lets the user retry a transient check failure", async () => {
    vi.mocked(checkActionCode)
      .mockRejectedValueOnce({ code: "auth/network-request-failed" })
      .mockResolvedValueOnce({ data: { email: "test@example.com" } } as never);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/could not connect/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try verifying again" }));

    expect(await screen.findByText("Your email address has been verified.")).toBeInTheDocument();
    expect(checkActionCode).toHaveBeenCalledTimes(2);
    expect(applyActionCode).toHaveBeenCalledTimes(1);
  });

  it("handles a code rejected while applying it", async () => {
    vi.mocked(applyActionCode).mockRejectedValue({ code: "auth/invalid-action-code" });
    renderPage();

    expect(await screen.findByText(/link is invalid, has expired, or has already been used/i)).toBeInTheDocument();
  });

  it("refreshes a matching signed-in session and continues account setup", async () => {
    const signedInUser = createMockUser({ emailVerified: false });
    currentUser = signedInUser;
    vi.mocked(reload).mockImplementation(async () => {
      Object.defineProperty(signedInUser, "emailVerified", { value: true, configurable: true });
    });
    renderPage();

    expect(await screen.findByText("Your email address has been verified.")).toBeInTheDocument();
    expect(reload).toHaveBeenCalledWith(signedInUser);
    expect(signedInUser.getIdToken).toHaveBeenCalledWith(true);
    expect(screen.getByRole("link", { name: "Continue account setup" })).toHaveAttribute(
      "href",
      "/profile-completion",
    );
  });

  it("supports signed-out completion and ignores an attacker-controlled continue URL", async () => {
    renderPage("?mode=verifyEmail&oobCode=valid-code&continueUrl=https://evil.example/phish&email=victim@example.com");

    expect(await screen.findByText("Your email address has been verified.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/account");
    expect(document.body).not.toHaveTextContent("evil.example");
    expect(document.body).not.toHaveTextContent("victim@example.com");
  });

  it("does not continue onboarding for a different signed-in account", async () => {
    currentUser = createMockUser({ email: "other@example.com", emailVerified: true });
    renderPage();

    expect(await screen.findByText("Your email address has been verified.")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/account");
  });

  it("falls back to sign-in if the current session cannot be refreshed", async () => {
    currentUser = createMockUser({ emailVerified: false });
    vi.mocked(reload).mockRejectedValue(new Error("offline"));
    renderPage();

    await waitFor(() => expect(screen.getByRole("link", { name: "Continue to sign in" })).toBeInTheDocument());
  });
});
