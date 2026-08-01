import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword, validatePassword } from "firebase/auth";
import { render, screen } from "../../../../test-utils";
import AuthGate from "../AuthGate";

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  validatePassword: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({ auth: {} }));
vi.mock("../../../users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: () => ({ isEnabled: false, isEnabledClaimResolved: true }),
}));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ reconcileMyEmail: vi.fn() }));

const policy = {
  customStrengthOptions: { minPasswordLength: 12 },
  enforcementState: "ENFORCE",
  forceUpgradeOnSignin: true,
  allowedNonAlphanumericCharacters: "",
};

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

describe("AuthGate password policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
      if (typeof observer === "function") observer(null);
      return vi.fn();
    });
  });

  it("checks every submitted password and routes a non-compliant member to reset", async () => {
    vi.mocked(validatePassword).mockResolvedValue({
      isValid: false,
      meetsMinPasswordLength: false,
      passwordPolicy: policy,
    });
    renderGate();
    await enterCredentials("legacy-password");
    expect(await screen.findByText(/Reset your password to continue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/account/reset-password",
    );
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("signs in when the submitted password meets the deployed policy", async () => {
    vi.mocked(validatePassword).mockResolvedValue({ isValid: true, passwordPolicy: policy });
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
