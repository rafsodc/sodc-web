import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasswordResetRequestPage from "../PasswordResetRequestPage";
import { requestPasswordResetEmail } from "../../../../shared/utils/firebaseFunctions";

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  requestPasswordResetEmail: vi.fn(),
}));

describe("PasswordResetRequestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the neutral confirmation after requesting a reset", async () => {
    vi.mocked(requestPasswordResetEmail).mockResolvedValue();
    render(
      <MemoryRouter>
        <PasswordResetRequestPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
      target: { value: "Member@Example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(requestPasswordResetEmail).toHaveBeenCalledWith("Member@Example.org")
    );
    expect(
      screen.getByText(
        "If an account exists for that address, we’ll send a password reset link.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Email/ })).not.toBeInTheDocument();
  });

  it("shows a safe rate-limit message", async () => {
    vi.mocked(requestPasswordResetEmail).mockRejectedValue({
      code: "functions/resource-exhausted",
    });
    render(
      <MemoryRouter>
        <PasswordResetRequestPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), {
      target: { value: "member@example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText("Too many reset requests. Please wait before trying again."),
    ).toBeInTheDocument();
  });
});
