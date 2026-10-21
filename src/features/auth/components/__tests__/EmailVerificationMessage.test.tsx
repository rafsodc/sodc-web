import { reload } from "firebase/auth";
import { createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { act, fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { requestEmailVerification } from "../../../../shared/utils/firebaseFunctions";
import EmailVerificationMessage from "../EmailVerificationMessage";

vi.mock("firebase/auth", () => ({ reload: vi.fn() }));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  requestEmailVerification: vi.fn(),
}));

describe("EmailVerificationMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  it.each(["reload", "token"])("does not continue after a retired session's delayed %s", async (stage) => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    vi.mocked(reload).mockReturnValue(stage === "reload" ? pending : Promise.resolve());
    const user = createMockUser({ uid: "A", emailVerified: true, getIdToken: vi.fn().mockReturnValue(stage === "token" ? pending.then(() => "token") : Promise.resolve("token")) });
    const lifecycle = createSessionLifecycle();
    lifecycle.observe("A");
    const uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => lifecycle.retire() });
    const onVerified = vi.fn();
    const view = render(<EmailVerificationMessage user={user} onVerified={onVerified} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: "I've clicked the link" }));
      await waitFor(() => expect(stage === "reload" ? reload : user.getIdToken).toHaveBeenCalled());
      lifecycle.retire();
      await act(async () => resolve());
      if (stage === "reload") expect(user.getIdToken).not.toHaveBeenCalled();
      expect(onVerified).not.toHaveBeenCalled();
    } finally { view.unmount(); uninstall(); }
  });

});
