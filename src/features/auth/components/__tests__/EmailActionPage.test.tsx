import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../../test-utils";
import EmailActionPage from "../EmailActionPage";

vi.mock("../PasswordResetActionPage", () => ({
  default: () => <h1>Password reset handler</h1>,
}));

vi.mock("../EmailVerificationActionPage", () => ({
  default: () => <h1>Email verification handler</h1>,
}));

function renderPage(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/action${search}`]}>
      <EmailActionPage />
    </MemoryRouter>,
  );
}

describe("EmailActionPage", () => {
  it("dispatches password reset actions", () => {
    renderPage("?mode=resetPassword&oobCode=code");
    expect(screen.getByRole("heading", { name: "Password reset handler" })).toBeInTheDocument();
  });

  it("dispatches email verification actions", () => {
    renderPage("?mode=verifyEmail&oobCode=code");
    expect(screen.getByRole("heading", { name: "Email verification handler" })).toBeInTheDocument();
  });

  it.each(["", "?mode=recoverEmail&oobCode=code", "?mode=unknown"])(
    "rejects unsupported action modes: %s",
    (search) => {
      renderPage(search);
      expect(screen.getByText("This email action link is invalid or is not supported.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/account");
    },
  );
});
