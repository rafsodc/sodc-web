import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AccountSettingsPage from "../AccountSettingsPage";
import { MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/generated";
import * as dataConnectReact from "@dataconnect/generated/react";
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

const mockUpsertUser = vi.fn().mockResolvedValue({ data: {} });

vi.mock("@dataconnect/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dataconnect/generated")>();
  return {
    ...actual,
    upsertUser: (...args: unknown[]) => mockUpsertUser(...args),
  };
});

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  resignMembership: vi.fn(),
}));

const mockOptOutAsync = vi.fn().mockResolvedValue(undefined);
const mockOptInAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@dataconnect/generated/react", () => ({
  useGetMyAnnouncementPreferences: vi.fn(() => ({
    data: { user: { membershipStatus: null, userGroups: [], optOuts: [] }, allUserGroups: [] },
    isLoading: false,
    refetch: vi.fn(),
  })),
  useOptOutSectionAnnouncement: vi.fn(() => ({
    mutateAsync: mockOptOutAsync,
    mutate: vi.fn(),
    isPending: false,
  })),
  useOptInSectionAnnouncement: vi.fn(() => ({
    mutateAsync: mockOptInAsync,
    mutate: vi.fn(),
    isPending: false,
  })),
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
  rank: null,
  shareContactInfo: true,
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

function clearCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  });
}

describe("AccountSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCookies();
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

  it("defaults the Appearance selector to System", () => {
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
  });

  it("selecting Dark in Appearance persists the choice", async () => {
    const user = userEvent.setup();
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(document.cookie).toContain("sodc-color-mode-preference=dark");
  });

  it("selecting Light in Appearance persists the choice", async () => {
    const user = userEvent.setup();
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(document.cookie).toContain("sodc-color-mode-preference=light");
  });

  it("shows the privacy toggle on by default", () => {
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const toggle = screen.getByRole("switch", {
      name: "Share my contact details with other section members",
    });
    expect(toggle).toBeChecked();
  });

  it("shows the privacy toggle off when the user has opted out", () => {
    renderAccountSettings({
      user: mockUser,
      userData: { ...userData, shareContactInfo: false },
      isAdmin: false,
    });

    const toggle = screen.getByRole("switch", {
      name: "Share my contact details with other section members",
    });
    expect(toggle).not.toBeChecked();
  });

  it("upserts the user with shareContactInfo flipped, preserving other fields", async () => {
    const user = userEvent.setup();
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const toggle = screen.getByRole("switch", {
      name: "Share my contact details with other section members",
    });
    await user.click(toggle);

    await waitFor(() => {
      expect(mockUpsertUser).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          firstName: "Alex",
          lastName: "Member",
          serviceNumber: "12345",
          shareContactInfo: false,
        })
      );
    });
    expect(toggle).not.toBeChecked();
  });

  it("reverts the toggle and shows an error if the upsert fails", async () => {
    const user = userEvent.setup();
    mockUpsertUser.mockRejectedValueOnce(new Error("Network error"));
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const toggle = screen.getByRole("switch", {
      name: "Share my contact details with other section members",
    });
    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    expect(toggle).toBeChecked();
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

  it("shows info alert instead of password form for non-password auth providers", () => {
    const googleUser = createMockUser({
      uid: "google-user",
      email: "google@example.com",
      providerData: [
        {
          providerId: "google.com",
          uid: "google@example.com",
          displayName: "Google User",
          email: "google@example.com",
          phoneNumber: null,
          photoURL: null,
        },
      ],
    });

    renderAccountSettings({ user: googleUser, userData, isAdmin: false });

    expect(
      screen.getByText(/password changes are only available for email and password sign-in/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  it("shows requires-recent-login error message", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential } = await import("firebase/auth");
    vi.mocked(reauthenticateWithCredential).mockRejectedValue({
      code: "auth/requires-recent-login",
    });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = document.querySelector(
      'input[autocomplete="current-password"]'
    ) as HTMLInputElement;
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "pass");
    await user.type(newPasswordInputs[0]!, "newpass123");
    await user.type(newPasswordInputs[1]!, "newpass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(
        screen.getByText(/please sign out and sign in again/i)
      ).toBeInTheDocument();
    });
  });

  it("renders Back button when onBack prop is provided", () => {
    const onBack = vi.fn();
    renderAccountSettings({ user: mockUser, userData, isAdmin: false, onBack });
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("shows error when resign fails with API error", async () => {
    const user = userEvent.setup();
    vi.mocked(firebaseFunctions.resignMembership).mockResolvedValue({
      success: false,
      error: "Membership cannot be resigned at this time",
    });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await user.click(screen.getByRole("button", { name: "Resign membership" }));
    await user.click(screen.getByRole("button", { name: "Confirm resign" }));

    await waitFor(() => {
      expect(screen.getByText("Membership cannot be resigned at this time")).toBeInTheDocument();
    });
  });

  it("cancels resign dialog without calling resignMembership", async () => {
    const user = userEvent.setup();

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await user.click(screen.getByRole("button", { name: "Resign membership" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(firebaseFunctions.resignMembership).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Confirm resign" })).not.toBeInTheDocument();
    });
  });

  it("shows error when password is wrong", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential } = await import("firebase/auth");
    vi.mocked(reauthenticateWithCredential).mockRejectedValue({
      code: "auth/wrong-password",
    });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = document.querySelector(
      'input[autocomplete="current-password"]'
    ) as HTMLInputElement;
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "wrong-pass");
    await user.type(newPasswordInputs[0]!, "newpass123");
    await user.type(newPasswordInputs[1]!, "newpass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByText("Current password is incorrect")).toBeInTheDocument();
    });
  });

  it("shows weak password error when server rejects new password", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
    vi.mocked(reauthenticateWithCredential).mockResolvedValue(undefined as never);
    vi.mocked(updatePassword).mockRejectedValue({ code: "auth/weak-password" });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = document.querySelector(
      'input[autocomplete="current-password"]'
    ) as HTMLInputElement;
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "pass");
    await user.type(newPasswordInputs[0]!, "newpass123");
    await user.type(newPasswordInputs[1]!, "newpass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByText("New password is too weak")).toBeInTheDocument();
    });
  });

  it("shows generic error message for unexpected auth errors", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential } = await import("firebase/auth");
    vi.mocked(reauthenticateWithCredential).mockRejectedValue(
      new Error("Something unexpected happened")
    );

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = document.querySelector(
      'input[autocomplete="current-password"]'
    ) as HTMLInputElement;
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "pass");
    await user.type(newPasswordInputs[0]!, "newpass123");
    await user.type(newPasswordInputs[1]!, "newpass123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByText("Something unexpected happened")).toBeInTheDocument();
    });
  });
});

describe("AnnouncementPreferencesList", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockOptOutAsync.mockResolvedValue(undefined);
    mockOptInAsync.mockResolvedValue(undefined);
  });

  const sectionWithAccess = {
    membershipStatuses: null,
    purposeLinks: [
      {
        purposes: [SectionUserGroupPurpose.ACCESS],
        section: { id: "s1", name: "Alpha Section" },
      },
    ],
  };

  it("shows 'not a member' when user has no sections", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: { user: { membershipStatus: null, userGroups: [], optOuts: [] }, allUserGroups: [] },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(screen.getByText("You are not a member of any sections.")).toBeInTheDocument();
  });

  it("shows section toggle for explicit group membership", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          userGroups: [{ userGroup: sectionWithAccess }],
          optOuts: [],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(screen.getByText("Alpha Section")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Alpha Section" });
    expect(toggle).toBeChecked();
  });

  it("shows section as opted-out when in optOuts list", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          userGroups: [{ userGroup: sectionWithAccess }],
          optOuts: [{ section: { id: "s1" } }],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const toggle = screen.getByRole("switch", { name: "Alpha Section" });
    expect(toggle).not.toBeChecked();
  });

  it("calls opt-out and shows snackbar when toggling off", async () => {
    const user = userEvent.setup();
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          userGroups: [{ userGroup: sectionWithAccess }],
          optOuts: [],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await user.click(screen.getByRole("switch", { name: "Alpha Section" }));

    await waitFor(() => {
      expect(mockOptOutAsync).toHaveBeenCalledWith({ sectionId: "s1" });
    });
    expect(screen.getByText("Opted out of announcements")).toBeInTheDocument();
  });

  it("calls opt-in and shows snackbar when toggling opted-out section on", async () => {
    const user = userEvent.setup();
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          userGroups: [{ userGroup: sectionWithAccess }],
          optOuts: [{ section: { id: "s1" } }],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const toggle = screen.getByRole("switch", { name: "Alpha Section" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(mockOptInAsync).toHaveBeenCalledWith({ sectionId: "s1" });
    });
    expect(screen.getByText("Opted in to announcements")).toBeInTheDocument();
  });

  it("shows section with MODERATOR access (tests || branch in grantsAccess)", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          userGroups: [
            {
              userGroup: {
                membershipStatuses: null,
                purposeLinks: [
                  {
                    purposes: [SectionUserGroupPurpose.MODERATOR],
                    section: { id: "s-mod", name: "Moderator Section" },
                  },
                ],
              },
            },
          ],
          optOuts: [],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(screen.getByText("Moderator Section")).toBeInTheDocument();
  });

  it("shows sections from status-based group membership", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          userGroups: [],
          optOuts: [],
        },
        allUserGroups: [
          {
            membershipStatuses: [MembershipStatus.REGULAR],
            purposeLinks: [
              {
                purposes: [SectionUserGroupPurpose.ACCESS],
                section: { id: "s2", name: "Beta Section" },
              },
            ],
          },
        ],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(screen.getByText("Beta Section")).toBeInTheDocument();
  });
});
