import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AccountSettingsPage from "../AccountSettingsPage";
import { MembershipStatus } from "@dataconnect/generated";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import type { UserData } from "../../../../types";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    credential: vi.fn(() => ({})),
  },
  reauthenticateWithCredential: vi.fn().mockResolvedValue(undefined),
  updatePassword: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  resignMembership: vi.fn(),
}));

const mockUser = createMockUser({
  uid: "user-1",
  email: "member@example.com",
  providerData: [{ providerId: "password", uid: "member@example.com", displayName: null, email: "member@example.com", phoneNumber: null, photoURL: null }],
});

const userData: UserData = {
  id: "user-1",
  firstName: "Alex",
  lastName: "Member",
  email: "member@example.com",
  serviceNumber: "12345",
  membershipStatus: MembershipStatus.REGULAR,
  isRegular: true,
  isReserve: false,
  isCivilServant: false,
  isIndustry: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function renderAccountSettings(props: ComponentProps<typeof AccountSettingsPage>) {
  return render(
    <MemoryRouter>
      <AccountSettingsPage {...props} />
    </MemoryRouter>
  );
}

describe("AccountSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows read-only membership status and profile link", () => {
    renderAccountSettings(
      { user: mockUser, userData, isAdmin: false }
    );

    expect(screen.getByText(/Status:/)).toHaveTextContent("Regular");
    expect(screen.getByRole("link", { name: "Edit profile details" })).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("updates password after re-authentication", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential, updatePassword } = await import("firebase/auth");

    renderAccountSettings(
      { user: mockUser, userData, isAdmin: false }
    );

    const currentPasswordInput = document.querySelector(
      'input[autocomplete="current-password"]'
    ) as HTMLInputElement;
    const newPasswordInput = document.querySelector(
      'input[autocomplete="new-password"]'
    ) as HTMLInputElement;
    const confirmPasswordInputs = document.querySelectorAll(
      'input[autocomplete="new-password"]'
    );

    await user.type(currentPasswordInput, "old-pass");
    await user.type(newPasswordInput, "new-pass");
    await user.type(confirmPasswordInputs[1]!, "new-pass");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(reauthenticateWithCredential).toHaveBeenCalled();
      expect(updatePassword).toHaveBeenCalledWith(mockUser, "new-pass");
    });
    expect(screen.getByText("Password updated successfully")).toBeInTheDocument();
  });

  it("resigns membership and signs out", async () => {
    const user = userEvent.setup();
    vi.mocked(firebaseFunctions.resignMembership).mockResolvedValue({ success: true });
    const { signOut } = await import("firebase/auth");

    renderAccountSettings(
      { user: mockUser, userData, isAdmin: false }
    );

    await user.click(screen.getByRole("button", { name: "Resign membership" }));
    await user.click(screen.getByRole("button", { name: "Confirm resign" }));

    await waitFor(() => {
      expect(firebaseFunctions.resignMembership).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalled();
    });
  });

  it("does not offer resign for admin users", () => {
    renderAccountSettings(
      { user: mockUser, userData, isAdmin: true }
    );

    expect(screen.queryByRole("button", { name: "Resign membership" })).not.toBeInTheDocument();
  });
});
