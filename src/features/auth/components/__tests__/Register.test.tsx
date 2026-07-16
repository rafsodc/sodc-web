import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent } from "../../../../test-utils";
import Register from "../Register";
import { REGISTRATION_MIN_PASSWORD_LENGTH } from "../../../../constants/auth";

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  syncPendingUserClaims: vi.fn(),
}));

async function fillForm(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText(/email/i), "new@example.com");
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.type(screen.getByLabelText(/confirm password/i), password);
}

describe("Register", () => {
  it(`shows the ${REGISTRATION_MIN_PASSWORD_LENGTH}-character minimum in the password helper text`, () => {
    render(<Register />);

    expect(
      screen.getByText(`Must be at least ${REGISTRATION_MIN_PASSWORD_LENGTH} characters`)
    ).toBeInTheDocument();
  });

  it("keeps Create account disabled when the password is below the minimum", async () => {
    const user = userEvent.setup();
    render(<Register />);

    await fillForm(user, "a".repeat(REGISTRATION_MIN_PASSWORD_LENGTH - 1));

    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  it("enables Create account once the password meets the minimum and matches confirmation", async () => {
    const user = userEvent.setup();
    render(<Register />);

    await fillForm(user, "a".repeat(REGISTRATION_MIN_PASSWORD_LENGTH));

    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("shows validateForm's own rejection message when the form is submitted directly with a too-short password", async () => {
    const user = userEvent.setup();
    render(<Register />);

    await fillForm(user, "short");
    // The submit button is disabled at this password length, but the form's own onSubmit
    // validation (validateForm) is a second line of defense — exercise it directly.
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(
      await screen.findByText(`Password must be at least ${REGISTRATION_MIN_PASSWORD_LENGTH} characters`)
    ).toBeInTheDocument();
  });
});
