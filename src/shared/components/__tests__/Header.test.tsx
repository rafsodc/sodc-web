import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "../../../test-utils";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import Header from "../Header";
import { createMockUser } from "../../../test-utils/mocks/firebase";
import { createUserData } from "../../../test-utils/factories/userData";

const enabledUser = createMockUser({ uid: "user-1" });

vi.mock("firebase/auth", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../features/users/hooks/useEnabledClaim", () => ({
  useEnabledClaim: vi.fn((user: User | null) => ({
    isEnabled: Boolean(user),
    isEnabledClaimResolved: true,
  })),
}));

describe("Header account menu", () => {
  it("keeps Sign in and Join in the header while anchoring the mobile menu", async () => {
    const user = userEvent.setup();
    const onNavMenuOpen = vi.fn();
    render(
      <Header
        user={null}
        userData={null}
        onAccountClick={vi.fn()}
        onJoinClick={vi.fn()}
        onLogoClick={vi.fn()}
        onNavMenuOpen={onNavMenuOpen}
      />
    );

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    expect(menuButton).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();

    await user.click(menuButton);
    expect(onNavMenuOpen).toHaveBeenCalledWith(menuButton);
  });

  it("navigates home when the SODC logo is clicked", async () => {
    const user = userEvent.setup();
    const onLogoClick = vi.fn();

    render(
      <Header
        user={null}
        userData={null}
        onAccountClick={vi.fn()}
        onLogoClick={onLogoClick}
      />
    );

    await user.click(screen.getByRole("button", { name: "Go to home" }));
    expect(onLogoClick).toHaveBeenCalledOnce();
  });

  it("shows My Bookings and My Payments for enabled users", async () => {
    const user = userEvent.setup();
    const onMyBookingsClick = vi.fn();
    const onMyPaymentsClick = vi.fn();

    render(
      <Header
        user={enabledUser}
        userData={null}
        onAccountClick={vi.fn()}
        onLogoClick={vi.fn()}
        onMyBookingsClick={onMyBookingsClick}
        onMyPaymentsClick={onMyPaymentsClick}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "My Bookings" }));
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "My Payments" }));

    expect(onMyBookingsClick).toHaveBeenCalledTimes(1);
    expect(onMyPaymentsClick).toHaveBeenCalledTimes(1);
  });

  it("shows Account settings for enabled users and invokes callback", async () => {
    const user = userEvent.setup();
    const onAccountSettingsClick = vi.fn();

    render(
      <Header
        user={enabledUser}
        userData={null}
        onAccountClick={vi.fn()}
        onLogoClick={vi.fn()}
        onAccountSettingsClick={onAccountSettingsClick}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Account" }));

    expect(onAccountSettingsClick).toHaveBeenCalledTimes(1);
  });

  it("does not show My Payments when user is not enabled", async () => {
    const { useEnabledClaim } = await import("../../../features/users/hooks/useEnabledClaim");
    vi.mocked(useEnabledClaim).mockReturnValue({
      isEnabled: false,
      isEnabledClaimResolved: true,
    });

    const user = userEvent.setup();

    render(
      <Header
        user={enabledUser}
        userData={null}
        onAccountClick={vi.fn()}
        onLogoClick={vi.fn()}
        onMyPaymentsClick={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.queryByRole("menuitem", { name: "My Bookings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "My Payments" })).not.toBeInTheDocument();
  });
});


describe("Header account identity", () => {
  it("updates the visible name and tooltip through sign-out, replacement, and profile loading", () => {
    const accountA = createMockUser({ uid: "account-a", email: "a@example.invalid", displayName: "Alice Owner" });
    const accountB = createMockUser({ uid: "account-b", email: "b@example.invalid", displayName: "Alice Owner" });
    const profileA = createUserData({ id: accountA.uid, firstName: "Alice", lastName: "Owner" });
    const profileB = createUserData({ id: accountB.uid, firstName: "Bob", lastName: "Member" });
    const callbacks = { onAccountClick: vi.fn(), onLogoClick: vi.fn() };
    const { rerender } = render(<Header {...callbacks} user={accountA} userData={profileA} />);
    const expectAccountLabel = (label: string) => {
      const accountButton = screen.getByRole("button", { name: "Account menu" });
      expect(within(accountButton).getByText(label)).toHaveAttribute("title", label);
    };

    expectAccountLabel("Alice Owner");

    rerender(<Header {...callbacks} user={null} userData={profileA} />);
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Alice Owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Alice Owner")).not.toBeInTheDocument();

    rerender(<Header {...callbacks} user={accountB} userData={null} />);
    expectAccountLabel("b@example.invalid");
    expect(screen.queryByText("Alice Owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Alice Owner")).not.toBeInTheDocument();

    // A previous profile must not supply either the label or its tooltip while B loads.
    rerender(<Header {...callbacks} user={accountB} userData={profileA} />);
    expectAccountLabel("b@example.invalid");
    expect(screen.queryByText("Alice Owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Alice Owner")).not.toBeInTheDocument();

    rerender(<Header {...callbacks} user={accountB} userData={profileB} />);
    expectAccountLabel("Bob Member");
    expect(screen.queryByText("b@example.invalid")).not.toBeInTheDocument();
    expect(screen.queryByTitle("b@example.invalid")).not.toBeInTheDocument();
  });

  it.each([null, "", "   "])("uses a neutral label when the current account email is %j", (email) => {
    const accountB = createMockUser({ uid: "account-b", email, displayName: "Alice Owner" });
    render(
      <Header
        user={accountB}
        userData={createUserData({ id: "account-a", firstName: "Alice", lastName: "Owner" })}
        onAccountClick={vi.fn()}
        onLogoClick={vi.fn()}
      />
    );

    const accountButton = screen.getByRole("button", { name: "Account menu" });
    expect(within(accountButton).getByText("Account")).toHaveAttribute("title", "Account");
    expect(screen.queryByText("Alice Owner")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Alice Owner")).not.toBeInTheDocument();
  });

  it("requires an exact profile owner and falls back to the current email for an empty owned name", () => {
    const accountB = createMockUser({ uid: "account-b", email: "b@example.invalid", displayName: "Alice Owner" });
    const callbacks = { onAccountClick: vi.fn(), onLogoClick: vi.fn() };
    const { rerender } = render(
      <Header
        {...callbacks}
        user={accountB}
        userData={createUserData({ id: "ACCOUNT-B", firstName: "Alice", lastName: "Owner" })}
      />
    );

    const accountLabel = () => within(screen.getByRole("button", { name: "Account menu" })).getByText("b@example.invalid");
    expect(accountLabel()).toHaveAttribute("title", "b@example.invalid");
    expect(screen.queryByTitle("Alice Owner")).not.toBeInTheDocument();

    rerender(
      <Header
        {...callbacks}
        user={accountB}
        userData={createUserData({ id: accountB.uid, firstName: " ", lastName: " " })}
      />
    );
    expect(accountLabel()).toHaveAttribute("title", "b@example.invalid");
    expect(screen.queryByTitle("Alice Owner")).not.toBeInTheDocument();
  });
});
