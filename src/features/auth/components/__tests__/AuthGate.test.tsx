import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { render, screen } from "../../../../test-utils";
import AuthGate from "../AuthGate";

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({ auth: {} }));
vi.mock("../../../users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: () => ({ isEnabled: false, isEnabledClaimResolved: true }),
}));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ reconcileMyEmail: vi.fn() }));

function renderGate() {
  return render(
    <MemoryRouter>
      <AuthGate />
    </MemoryRouter>,
  );
}

async function enterCredentials(password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "member@example.org");
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("AuthGate sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
      if (typeof observer === "function") observer(null);
      return vi.fn();
    });
  });

  it("routes a member to reset when Firebase rejects their password under the policy", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
      code: "auth/password-does-not-meet-requirements",
      message: "Password does not meet requirements",
    });
    renderGate();
    await enterCredentials("legacy-password");
    expect(await screen.findByText(/Reset your password to continue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/account/reset-password",
    );
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      "member@example.org",
      "legacy-password",
    );
  });

  it("does not misreport an ordinary invalid credential as a policy failure", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue({
      code: "auth/invalid-credential",
      message: "Firebase: Error (auth/invalid-credential).",
    });
    renderGate();
    await enterCredentials("mistyped-password");
    expect(await screen.findByText(/auth\/invalid-credential/)).toBeInTheDocument();
    expect(screen.queryByText(/password no longer meets/i)).not.toBeInTheDocument();
  });

  it("signs in when Firebase accepts the submitted password", async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: {
        emailVerified: false,
        getIdToken: vi.fn().mockResolvedValue("token"),
      },
    } as never);
    renderGate();
    await enterCredentials("compliant-password");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      "member@example.org",
      "compliant-password",
    );
  });
});
