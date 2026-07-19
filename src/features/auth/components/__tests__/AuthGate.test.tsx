import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "../../../../test-utils";
import AuthGate from "../AuthGate";

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, callback: (user: null) => void) => {
    callback(null);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock("../../../users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: () => ({ isEnabled: false, isEnabledClaimResolved: true }),
}));

describe("AuthGate", () => {
  it("links signed-out users to password recovery", async () => {
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/account/password-reset",
    );
  });
});
