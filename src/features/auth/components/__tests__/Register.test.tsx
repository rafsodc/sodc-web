import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../../test-utils";
import Register from "../Register";
import { createUserWithEmailAndPassword, validatePassword } from "firebase/auth";

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  validatePassword: vi.fn(),
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  syncPendingUserClaims: vi.fn(),
  requestEmailVerification: vi.fn(),
}));

const policy = {
  customStrengthOptions: { minPasswordLength: 12 },
  enforcementState: "ENFORCE",
  forceUpgradeOnSignin: true,
  allowedNonAlphanumericCharacters: "",
};

async function fillForm(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText(/email/i), "new@example.com");
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.type(screen.getByLabelText(/confirm password/i), password);
}

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains that password requirements come from the current policy", () => {
    render(<Register />);
    expect(
      screen.getByText(/Requirements are checked against the current account security policy/),
    ).toBeInTheDocument();
  });

  it("keeps Create account disabled when the confirmation differs", async () => {
    const user = userEvent.setup();
    render(<Register />);
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password/i), "one-password");
    await user.type(screen.getByLabelText(/confirm password/i), "another-password");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  it("asks Firebase to validate before creating an account", async () => {
    const user = userEvent.setup();
    vi.mocked(validatePassword).mockResolvedValue({
      isValid: false,
      meetsMinPasswordLength: false,
      passwordPolicy: policy,
    });
    render(<Register />);
    await fillForm(user, "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Password must be at least 12 characters.")).toBeInTheDocument();
    expect(validatePassword).toHaveBeenCalled();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("uses the shared safe fallback instead of rendering an unknown technical message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    vi.mocked(validatePassword).mockResolvedValue({
      isValid: true,
      passwordPolicy: policy,
    });
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValue(
      new Error("SQL user insert failed with internal identifier 42"),
    );

    render(<Register />);
    await fillForm(user, "compliant-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("The account request could not be completed. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SQL user insert/)).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
