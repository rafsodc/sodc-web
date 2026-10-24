import { reload } from "firebase/auth";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { act, fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { auth } from "../../../../config/firebase";
import { requestEmailVerification, reconcileMyEmail } from "../../../../shared/utils/firebaseFunctions";
import EmailVerificationMessage from "../EmailVerificationMessage";

vi.mock("firebase/auth", () => ({ reload: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ auth: { currentUser: null } }));
const mutableAuth = auth as unknown as { currentUser: ReturnType<typeof createMockUser> | null };

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  requestEmailVerification: vi.fn(),
  reconcileMyEmail: vi.fn(),
}));

describe("EmailVerificationMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableAuth.currentUser = null;
    vi.mocked(reconcileMyEmail).mockResolvedValue("verified@example.org");
    vi.mocked(reload).mockResolvedValue();
  });

  it("requests a backend-delivered verification email", async () => {
    vi.mocked(requestEmailVerification).mockResolvedValue();
    render(<EmailVerificationMessage user={createMockUser({ emailVerified: false })} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));

    await waitFor(() => expect(requestEmailVerification).toHaveBeenCalledOnce());
    expect(screen.getByText("Verification email sent!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend email" })).toBeDisabled();
  });

  it("maps rate limiting to a safe message", async () => {
    vi.mocked(requestEmailVerification).mockRejectedValue({
      code: "functions/resource-exhausted",
    });
    render(<EmailVerificationMessage user={createMockUser({ emailVerified: false })} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));

    expect(
      await screen.findByText(
        "Too many verification emails requested. Please wait before trying again.",
      ),
    ).toBeInTheDocument();
  });
  it("reconciles an ordinary verified email before refreshing access claims and continuing", async () => {
    const order: string[] = [];
    const user = createMockUser({ uid: "A", emailVerified: false });
    mutableAuth.currentUser = user;
    vi.mocked(reload).mockImplementation(async () => { order.push("reload"); Object.assign(user, { emailVerified: true }); });
    vi.mocked(reconcileMyEmail).mockImplementation(async () => { order.push("reconcile"); return "verified@example.org"; });
    vi.mocked(user.getIdToken).mockImplementation(async () => { order.push("token"); return "new-version"; });
    const onVerified = vi.fn(() => { order.push("continue"); });
    render(<EmailVerificationMessage user={user} onVerified={onVerified} />);
    fireEvent.click(screen.getByRole("button", { name: "I've clicked the link" }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
    expect(order).toEqual(["reload", "token", "reconcile", "token", "continue"]);
  });

  it("does not reconcile or refresh an email that is still unverified", async () => {
    const user = createMockUser({ uid: "A", emailVerified: false }); mutableAuth.currentUser = user;
    render(<EmailVerificationMessage user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "I've clicked the link" }));
    expect(await screen.findByText(/Email not yet verified/)).toBeInTheDocument();
    expect(reconcileMyEmail).not.toHaveBeenCalled(); expect(user.getIdToken).not.toHaveBeenCalled();
  });

  it.each(["reload", "reconcile", "token", "post-token"])("does not continue after a retired session's delayed %s", async (stage) => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    vi.mocked(reload).mockReturnValue(stage === "reload" ? pending : Promise.resolve());
    const user = createMockUser({ uid: "A", emailVerified: true, getIdToken: vi.fn().mockReturnValue(stage === "token" ? pending.then(() => "token") : Promise.resolve("token")) });
    mutableAuth.currentUser = user;
    if (stage === "post-token") vi.mocked(user.getIdToken).mockResolvedValueOnce("hold-version").mockReturnValueOnce(pending.then(() => "released-version"));
    if (stage === "reconcile") vi.mocked(reconcileMyEmail).mockReturnValue(pending.then(() => "verified@example.org"));
    const lifecycle = createSessionLifecycle();
    lifecycle.observe("A");
    const uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
    const onVerified = vi.fn();
    const view = render(<EmailVerificationMessage user={user} onVerified={onVerified} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: "I've clicked the link" }));
      await waitFor(() => stage === "post-token" ? expect(user.getIdToken).toHaveBeenCalledTimes(2) : expect(stage === "reload" ? reload : stage === "reconcile" ? reconcileMyEmail : user.getIdToken).toHaveBeenCalled());
      lifecycle.retire();
      await act(async () => resolve());
      if (stage === "reload") expect(user.getIdToken).not.toHaveBeenCalled();
      if (stage === "reconcile") expect(user.getIdToken).toHaveBeenCalledOnce();
      expect(onVerified).not.toHaveBeenCalled();
    } finally { view.unmount(); uninstall(); }
  });

});
