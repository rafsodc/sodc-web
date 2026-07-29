import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import { requestEmailVerification } from "../../../../shared/utils/firebaseFunctions";
import EmailVerificationMessage from "../EmailVerificationMessage";

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
});
