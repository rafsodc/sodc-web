import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../../../test-utils";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import Header from "../Header";
import { createMockUser } from "../../../test-utils/mocks/firebase";

const enabledUser = createMockUser({ uid: "user-1" });

vi.mock("firebase/auth", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../features/users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: vi.fn((user: User | null) => Boolean(user)),
}));

describe("Header account menu", () => {
  it("shows My Payments for enabled users and invokes callback", async () => {
    const user = userEvent.setup();
    const onMyPaymentsClick = vi.fn();

    render(
      <Header
        user={enabledUser}
        userData={null}
        onAccountClick={vi.fn()}
        onMyPaymentsClick={onMyPaymentsClick}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "My Payments" }));

    expect(onMyPaymentsClick).toHaveBeenCalledTimes(1);
  });

  it("does not show My Payments when user is not enabled", async () => {
    const { useEnabledClaim } = await import("../../../features/users/hooks/useEnabledClaim");
    vi.mocked(useEnabledClaim).mockReturnValue(false);

    const user = userEvent.setup();

    render(
      <Header
        user={enabledUser}
        userData={null}
        onAccountClick={vi.fn()}
        onMyPaymentsClick={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.queryByRole("menuitem", { name: "My Payments" })).not.toBeInTheDocument();
  });
});
