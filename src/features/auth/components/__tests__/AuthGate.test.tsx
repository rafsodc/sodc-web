import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from "firebase/auth";
import { act, render, screen, waitFor, fireEvent } from "../../../../test-utils";
import AuthGate from "../AuthGate";
import { auth } from "../../../../config/firebase";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { reconcileMyEmail } from "../../../../shared/utils/firebaseFunctions";

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock("../../../../config/firebase", () => ({ auth: { currentUser: null } }));
vi.mock("../../../users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: () => ({ isEnabled: false, isEnabledClaimResolved: true }),
}));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({ reconcileMyEmail: vi.fn() }));

const mutableAuth = auth as unknown as { currentUser: User | null };
let notifyAuth: (user: User | null) => void;
function renderGate(onComplete?: () => void) {
  return render(
    <MemoryRouter>
      <AuthGate onRegisterComplete={onComplete} />
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
    mutableAuth.currentUser = null;
    vi.mocked(reconcileMyEmail).mockResolvedValue("member@example.org");
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
      if (typeof observer === "function") { notifyAuth = observer; observer(null); }
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
      auth,
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
    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText(/auth\/invalid-credential/)).not.toBeInTheDocument();
    expect(screen.queryByText(/password no longer meets/i)).not.toBeInTheDocument();
  });

  it("signs in when Firebase accepts the submitted password", async () => {
    const owner = createMockUser({ uid: "A", emailVerified: false });
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      mutableAuth.currentUser = owner;
      return { user: owner } as never;
    });
    renderGate();
    await enterCredentials("compliant-password");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "member@example.org",
      "compliant-password",
    );
  });
  it("refreshes a stale disabled sign-in token after reconciliation releases its access hold", async () => {
    const order: string[] = [];
    let backendEnabled = false;
    let tokenEnabled = false;
    const owner = createMockUser({ uid: "A", emailVerified: true });
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      mutableAuth.currentUser = owner; notifyAuth(owner); return { user: owner } as never;
    });
    vi.mocked(reconcileMyEmail).mockImplementation(async () => { order.push("reconcile"); backendEnabled = true; return "member@example.org"; });
    vi.mocked(owner.getIdToken).mockImplementation(async force => { expect(force).toBe(true); tokenEnabled = backendEnabled; order.push(`token:${tokenEnabled}`); return "new-security-version"; });
    const complete = vi.fn(() => { expect(tokenEnabled).toBe(true); order.push("continue"); });
    renderGate(complete);
    await enterCredentials("compliant-password");
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(order).toEqual(["token:false", "reconcile", "token:true", "continue"]);
    expect(owner.getIdToken).toHaveBeenCalledTimes(2);
  });

  it("offers explicit reconciliation retry without automatically replaying sign-in", async () => {
    const owner = createMockUser({ uid: "A", emailVerified: true });
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      mutableAuth.currentUser = owner; notifyAuth(owner); return { user: owner } as never;
    });
    vi.mocked(reconcileMyEmail).mockRejectedValueOnce({ code: "functions/unavailable" }).mockResolvedValue("member@example.org");
    const complete = vi.fn();
    renderGate(complete); await enterCredentials("compliant-password");
    fireEvent.click(await screen.findByRole("button", { name: "Retry account check" }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(signInWithEmailAndPassword).toHaveBeenCalledOnce();
    expect(reconcileMyEmail).toHaveBeenCalledTimes(2);
    expect(owner.getIdToken).toHaveBeenCalledTimes(3);
  });

  it("ignores old sign-in reconciliation success when actual Auth is already B", async () => {
    const owner = createMockUser({ uid: "A", emailVerified: true });
    let resolve!: (email: string) => void;
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      mutableAuth.currentUser = owner; notifyAuth(owner); return { user: owner } as never;
    });
    vi.mocked(reconcileMyEmail).mockReturnValue(new Promise(done => { resolve = done; }));
    const complete = vi.fn(); renderGate(complete); await enterCredentials("compliant-password");
    await waitFor(() => expect(reconcileMyEmail).toHaveBeenCalledOnce());
    mutableAuth.currentUser = createMockUser({ uid: "B" });
    await act(async () => resolve("old@example.org"));
    expect(owner.getIdToken).toHaveBeenCalledOnce(); expect(complete).not.toHaveBeenCalled();
    expect(screen.queryByText(/could not be updated/)).not.toBeInTheDocument();
  });

});
