import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ComponentProps } from "react";
import { act, render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AccountSettingsPage from "../AccountSettingsPage";
import { MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/generated";
import * as dataConnectReact from "@dataconnect/generated/react";
import { createMockUser } from "../../../../test-utils/mocks/firebase";
import type { UserData } from "../../../../types";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import { captureSession, createSessionLifecycle, installSessionRuntime } from "../../../../shared/appShell/sessionLifecycle";
import { beginAuthorizationUpdate, resumeAuthorizationReads } from "../../../../shared/auth/authorizationUpdate";

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    credential: vi.fn(() => ({})),
  },
  reauthenticateWithCredential: vi.fn().mockResolvedValue(undefined),
  updatePassword: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  validatePassword: vi.fn().mockResolvedValue({
    isValid: true,
    passwordPolicy: {
      customStrengthOptions: { minPasswordLength: 12 },
      enforcementState: "ENFORCE",
      forceUpgradeOnSignin: true,
      allowedNonAlphanumericCharacters: "",
    },
  }),
}));

import { invalidateAnnouncementPreferences } from "../../../../shared/query/invalidation";
vi.mock("../../../../shared/query/invalidation", () => ({invalidateAnnouncementPreferences: vi.fn().mockResolvedValue(undefined), retireAnnouncementPreferences: vi.fn().mockResolvedValue(undefined)}));

const mockUpsertUser = vi.fn().mockResolvedValue({ data: { user_update: { id: "user-1" } } });

vi.mock("@dataconnect/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dataconnect/generated")>();
  return {
    ...actual,
    upsertUser: (...args: unknown[]) => mockUpsertUser(...args),
  };
});

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  resignMembership: vi.fn(),
  requestEmailChange: vi.fn(),
}));

const mockOptOutAsync = vi.fn().mockResolvedValue(undefined);
const mockOptInAsync = vi.fn().mockResolvedValue(undefined);
const mockUpdateGlobalOptOutAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@dataconnect/generated/react", () => ({
  useGetMyAnnouncementPreferences: vi.fn(() => ({
    data: {
      user: {
        membershipStatus: null,
        announcementOptOutAll: false,
        userGroups: [],
        optOuts: [],
      },
      allUserGroups: [],
    },
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
  useUpdateAnnouncementOptOutAll: vi.fn(() => ({
    mutateAsync: mockUpdateGlobalOptOutAsync,
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
    vi.mocked(invalidateAnnouncementPreferences).mockResolvedValue(undefined);
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

  it("refreshes App-owned user data after saving the privacy setting", async () => {
    const user = userEvent.setup();
    const onUserDataUpdate = vi.fn().mockResolvedValue(undefined);
    renderAccountSettings({
      user: mockUser,
      userData,
      isAdmin: false,
      onUserDataUpdate,
    });

    await user.click(screen.getByRole("switch", {
      name: "Share my contact details with other section members",
    }));

    await waitFor(() => expect(onUserDataUpdate).toHaveBeenCalledOnce());
    expect(onUserDataUpdate.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockUpsertUser.mock.invocationCallOrder[0],
    );
  });

  it("keeps a saved privacy setting and retries only its failed profile refresh", async () => {
    const user = userEvent.setup(), onUserDataUpdate = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    renderAccountSettings({user: mockUser, userData, isAdmin: false, onUserDataUpdate});
    const toggle = screen.getByRole("switch", {name: "Share my contact details with other section members"});
    await user.click(toggle);
    expect(await screen.findByText(/Your privacy setting was saved, but/)).toBeInTheDocument();
    expect(toggle).not.toBeChecked(); expect(toggle).toBeDisabled();
    await user.click(screen.getByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Your privacy setting was saved, but/)).not.toBeInTheDocument());
    expect(mockUpsertUser).toHaveBeenCalledOnce(); expect(onUserDataUpdate).toHaveBeenCalledTimes(2);
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
      expect(
        screen.getByText("We couldn’t update your privacy setting. Check your connection and try again."),
      ).toBeInTheDocument();
    });
    expect(toggle).toBeChecked();
  });

  it.each([null, undefined])("reverts the privacy toggle when no profile was updated (%s)", async (user_update) => {
    mockUpsertUser.mockResolvedValueOnce({ data: { user_update } });
    const onUserDataUpdate = vi.fn();
    const user = userEvent.setup();
    renderAccountSettings({ user: mockUser, userData, isAdmin: false, onUserDataUpdate });
    const toggle = screen.getByRole("switch", { name: "Share my contact details with other section members" });
    await user.click(toggle);

    expect(await screen.findByText("Your profile could not be found. Your privacy setting has not been saved. Contact an administrator before trying again.")).toBeInTheDocument();
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    expect(onUserDataUpdate).not.toHaveBeenCalled();
  });

  it("updates password after re-authentication", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential, updatePassword } = await import("firebase/auth");

    renderAccountSettings(
      { user: mockUser, userData, isAdmin: false }
    );

    const currentPasswordInput = screen.getByLabelText(
      /^Current password(?! for email change)/i,
    );
    const newPasswordInput = document.querySelector(
      'input[autocomplete="new-password"]'
    ) as HTMLInputElement;
    const confirmPasswordInputs = document.querySelectorAll(
      'input[autocomplete="new-password"]'
    );

    await user.type(currentPasswordInput, "old-pass");
    await user.type(newPasswordInput, "new-password123");
    await user.type(confirmPasswordInputs[1]!, "new-password123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(reauthenticateWithCredential).toHaveBeenCalled();
      expect(updatePassword).toHaveBeenCalledWith(mockUser, "new-password123");
    });
    expect(screen.getByText("Password updated successfully")).toBeInTheDocument();
  });

  it("reauthenticates and requests a verified email change", async () => {
    const interaction = userEvent.setup();
    vi.mocked(firebaseFunctions.requestEmailChange).mockResolvedValue();
    const { reauthenticateWithCredential } = await import("firebase/auth");
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await interaction.type(screen.getByLabelText(/New email address/i), "new@example.com");
    await interaction.type(
      screen.getByLabelText(/Current password for email change/i),
      "current-password",
    );
    await interaction.click(screen.getByRole("button", { name: "Send confirmation link" }));

    await waitFor(() => {
      expect(reauthenticateWithCredential).toHaveBeenCalled();
      expect(firebaseFunctions.requestEmailChange).toHaveBeenCalledWith("new@example.com");
    });
    expect(
      screen.getByText("Check the new address for a confirmation link."),
    ).toBeInTheDocument();
  });

  it("explains when the replacement email is already linked to an account", async () => {
    const interaction = userEvent.setup();
    vi.mocked(firebaseFunctions.requestEmailChange).mockRejectedValue({
      code: "functions/already-exists",
    });
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await interaction.type(screen.getByLabelText(/New email address/i), "used@example.com");
    await interaction.type(
      screen.getByLabelText(/Current password for email change/i),
      "current-password",
    );
    await interaction.click(screen.getByRole("button", { name: "Send confirmation link" }));

    expect(
      await screen.findByText(
        "That email address is already used by another account.",
      ),
    ).toBeInTheDocument();
  });

  it("rejects a new password when the deployed Firebase policy rejects it", async () => {
    const user = userEvent.setup();
    const { updatePassword, validatePassword } = await import("firebase/auth");
    vi.mocked(validatePassword).mockResolvedValueOnce({
      isValid: false,
      meetsMinPasswordLength: false,
      passwordPolicy: {
        customStrengthOptions: { minPasswordLength: 12 },
        enforcementState: "ENFORCE",
        forceUpgradeOnSignin: true,
        allowedNonAlphanumericCharacters: "",
      },
    });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = screen.getByLabelText(
      /^Current password(?! for email change)/i,
    );
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "old-pass");
    await user.type(newPasswordInputs[0]!, "short12345");
    await user.type(newPasswordInputs[1]!, "short12345");

    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Password must be at least 12 characters.")).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("explains that the current policy is used for a new password", () => {
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(
      screen.getByText(/Requirements are checked against the current account security policy/),
    ).toBeInTheDocument();
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

    const currentPasswordInput = screen.getByLabelText(
      /^Current password(?! for email change)/i,
    );
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "pass");
    await user.type(newPasswordInputs[0]!, "newpassword123");
    await user.type(newPasswordInputs[1]!, "newpassword123");
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
      domainCode: "MEMBERSHIP_RESIGNATION_NOT_ALLOWED",
    });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    await user.click(screen.getByRole("button", { name: "Resign membership" }));
    await user.click(screen.getByRole("button", { name: "Confirm resign" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "You cannot resign while your membership has its current status. Contact an administrator for help.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Membership cannot be resigned at this time")).not.toBeInTheDocument();
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

    const currentPasswordInput = screen.getByLabelText(
      /^Current password(?! for email change)/i,
    );
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "wrong-pass");
    await user.type(newPasswordInputs[0]!, "newpassword123");
    await user.type(newPasswordInputs[1]!, "newpassword123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByText("Current password is incorrect.")).toBeInTheDocument();
    });
  });

  it("shows weak password error when server rejects new password", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
    vi.mocked(reauthenticateWithCredential).mockResolvedValue(undefined as never);
    vi.mocked(updatePassword).mockRejectedValue({ code: "auth/weak-password" });

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = screen.getByLabelText(
      /^Current password(?! for email change)/i,
    );
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "pass");
    await user.type(newPasswordInputs[0]!, "newpassword123");
    await user.type(newPasswordInputs[1]!, "newpassword123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(
        screen.getByText("Password does not meet the current account security policy."),
      ).toBeInTheDocument();
    });
  });

  it("shows generic error message for unexpected auth errors", async () => {
    const user = userEvent.setup();
    const { reauthenticateWithCredential } = await import("firebase/auth");
    vi.mocked(reauthenticateWithCredential).mockRejectedValue(
      new Error("Something unexpected happened")
    );

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    const currentPasswordInput = screen.getByLabelText(
      /^Current password(?! for email change)/i,
    );
    const newPasswordInputs = document.querySelectorAll('input[autocomplete="new-password"]');

    await user.type(currentPasswordInput, "pass");
    await user.type(newPasswordInputs[0]!, "newpassword123");
    await user.type(newPasswordInputs[1]!, "newpassword123");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByText("We couldn’t change your password. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText("Something unexpected happened")).not.toBeInTheDocument();
    });
  });
});

describe("AnnouncementPreferencesList", () => {
  const uninstalls: Array<() => void> = [];
  afterEach(() => { uninstalls.reverse().forEach(uninstall => uninstall()); uninstalls.length = 0; });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOptOutAsync.mockReset().mockResolvedValue(undefined);
    mockOptInAsync.mockReset().mockResolvedValue(undefined);
    mockUpdateGlobalOptOutAsync.mockReset().mockResolvedValue(undefined);
    vi.mocked(invalidateAnnouncementPreferences).mockReset().mockResolvedValue(undefined);
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

  const setPreferences = (optOuts: string[] = [], global = false) => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: { user: { membershipStatus: MembershipStatus.REGULAR, announcementOptOutAll: global,
        userGroups: [{ userGroup: { membershipStatuses: null, purposeLinks: [
          { purposes: [SectionUserGroupPurpose.ACCESS], section: { id: "s1", name: "Alpha Section" } },
          { purposes: [SectionUserGroupPurpose.ACCESS], section: { id: "s2", name: "Beta Section" } },
        ] } }], optOuts: optOuts.map(id => ({ section: { id } })) }, allUserGroups: [] }, isLoading: false,
    } as never);
  };
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((done, failed) => { resolve = done; reject = failed; });
    return { promise, resolve, reject };
  }

  it("serializes different section saves until the first write and refresh settle", async () => {
    const user = userEvent.setup(), write = deferred<undefined>(), refresh = deferred<undefined>();
    setPreferences(); mockOptOutAsync.mockReturnValueOnce(write.promise);
    vi.mocked(invalidateAnnouncementPreferences).mockImplementationOnce(() => refresh.promise);
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    const alpha = screen.getByRole("switch", { name: "Alpha Section" }), beta = screen.getByRole("switch", { name: "Beta Section" });
    await user.click(alpha);
    expect(alpha).toBeDisabled(); expect(beta).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Receive announcement emails" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Updating email preferences");
    expect(mockOptOutAsync).toHaveBeenCalledOnce();
    await act(async () => { write.resolve(undefined); await write.promise; });
    expect(beta).toBeDisabled();
    setPreferences(["s1"]);
    await act(async () => { refresh.resolve(undefined); await refresh.promise; });
    await waitFor(() => expect(beta).toBeEnabled());
    expect(alpha).not.toBeChecked();
    await user.click(beta); expect(mockOptOutAsync).toHaveBeenNthCalledWith(2, { sectionId: "s2" });
  });

  it.each(["global", "section"] as const)("announces a rejected %s write, restores confirmed state and allows an explicit retry", async scope => {
    const user = userEvent.setup(); setPreferences();
    const mutate = scope === "global" ? mockUpdateGlobalOptOutAsync : mockOptOutAsync;
    mutate.mockRejectedValueOnce(new Error("offline"));
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    const toggle = screen.getByRole("switch", { name: scope === "global" ? "Receive announcement emails" : "Alpha Section" });
    await user.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t save your email preferences");
    expect(toggle).toBeChecked(); expect(toggle).toBeEnabled();
    expect(invalidateAnnouncementPreferences).not.toHaveBeenCalled();
    vi.mocked(invalidateAnnouncementPreferences).mockImplementationOnce(async () => setPreferences(scope === "global" ? [] : ["s1"], scope === "global"));
    await user.click(toggle);
    expect(mutate).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(screen.queryByText(/We couldn’t save your email preferences/)).not.toBeInTheDocument();
    expect(invalidateAnnouncementPreferences).toHaveBeenCalledOnce();
  });

  it("preserves a confirmed section choice through failed refresh and retries only reads", async () => {
    const user = userEvent.setup(); setPreferences();
    vi.mocked(invalidateAnnouncementPreferences).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("still offline"));
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    await user.click(screen.getByRole("switch", { name: "Alpha Section" }));
    expect(await screen.findByText(/Your email preferences were saved, but/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Alpha Section" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Beta Section" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(screen.getByText(/Your email preferences were saved, but/)).toBeInTheDocument();
    vi.mocked(invalidateAnnouncementPreferences).mockImplementationOnce(async () => setPreferences(["s1"]));
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Beta Section" })).toBeEnabled());
    expect(mockOptOutAsync).toHaveBeenCalledOnce(); expect(invalidateAnnouncementPreferences).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("switch", { name: "Alpha Section" })).not.toBeChecked();
  });

  it("clears earlier success feedback when the next request starts and fails", async () => {
    const user = userEvent.setup(); setPreferences();
    vi.mocked(invalidateAnnouncementPreferences).mockImplementationOnce(async () => setPreferences(["s1"]));
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    await user.click(screen.getByRole("switch", { name: "Alpha Section" }));
    expect(await screen.findByText("Opted out of announcements")).toBeInTheDocument();
    mockOptOutAsync.mockRejectedValueOnce(new Error("offline"));
    await user.click(screen.getByRole("switch", { name: "Beta Section" }));
    expect(await screen.findByText(/We couldn’t save your email preferences/)).toBeInTheDocument();
    expect(screen.queryByText("Opted out of announcements")).not.toBeInTheDocument();
  });

  it("discards old account overrides and ignores late feedback after account replacement", async () => {
    const user = userEvent.setup(), write = deferred<undefined>(); setPreferences();
    const first = createSessionLifecycle(); first.observe(mockUser.uid);
    uninstalls.push(installSessionRuntime({ lifecycle: first, retire: () => first.retire(), signOut: async () => first.retire() }));
    mockUpdateGlobalOptOutAsync.mockReturnValueOnce(write.promise);
    const view = renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    await user.click(screen.getByRole("switch", { name: "Receive announcement emails" }));
    expect(screen.getByRole("switch", { name: "Receive announcement emails" })).not.toBeChecked();
    const second = createSessionLifecycle(); second.observe("user-2");
    uninstalls.push(installSessionRuntime({ lifecycle: second, retire: () => second.retire(), signOut: async () => second.retire() }));
    view.rerender(<MemoryRouter><AccountSettingsPage user={createMockUser({ uid: "user-2" })} userData={{ ...userData, id: "user-2" }} isAdmin={false} /></MemoryRouter>);
    expect(screen.getByRole("switch", { name: "Receive announcement emails" })).toBeChecked();
    await act(async () => { write.resolve(undefined); await write.promise; });
    expect(screen.queryByText(/We couldn’t save your email preferences/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Opted out of all announcement emails/)).not.toBeInTheDocument();
    expect(invalidateAnnouncementPreferences).not.toHaveBeenCalled();
  });

  it.each([false, true])("drops late refresh feedback after the session retires, refresh fails=%s", async fails => {
    const user = userEvent.setup(), refresh = deferred<undefined>(); setPreferences();
    const owner = createSessionLifecycle(); owner.observe(mockUser.uid);
    uninstalls.push(installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() }));
    vi.mocked(invalidateAnnouncementPreferences).mockReturnValueOnce(refresh.promise);
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    await user.click(screen.getByRole("switch", { name: "Receive announcement emails" }));
    await waitFor(() => expect(invalidateAnnouncementPreferences).toHaveBeenCalledOnce());
    act(() => owner.retire());
    await act(async () => {
      if (fails) refresh.reject(new Error("late refresh failure")); else refresh.resolve(undefined);
      await refresh.promise.catch(() => undefined);
    });
    expect(screen.queryByText("Opted out of all announcement emails")).not.toBeInTheDocument();
    expect(screen.queryByText(/Your email preferences were saved, but/)).not.toBeInTheDocument();
    expect(screen.queryByText(/We couldn’t save your email preferences/)).not.toBeInTheDocument();
    expect(mockUpdateGlobalOptOutAsync).toHaveBeenCalledOnce();
  });

  it.each([
    ["global", "write"], ["section", "write"], ["global", "refresh"], ["section", "refresh"],
  ] as const)("recovers %s preferences after an authorization change interrupts the %s", async (scope, phase) => {
    const user = userEvent.setup(), pending = deferred<undefined>(); setPreferences();
    const owner = createSessionLifecycle(); owner.observe(mockUser.uid);
    uninstalls.push(installSessionRuntime({ lifecycle: owner, retire: () => owner.retire(), signOut: async () => owner.retire() }));
    const mutation = scope === "global" ? mockUpdateGlobalOptOutAsync : mockOptOutAsync;
    if (phase === "write") mutation.mockReturnValueOnce(pending.promise);
    else vi.mocked(invalidateAnnouncementPreferences).mockReturnValueOnce(pending.promise);
    renderAccountSettings({ user: mockUser, userData, isAdmin: false });
    const name = scope === "global" ? "Receive announcement emails" : "Alpha Section";
    await user.click(screen.getByRole("switch", { name }));
    const token = captureSession(); let update!: ReturnType<typeof beginAuthorizationUpdate>;
    act(() => { update = beginAuthorizationUpdate(token); });
    await act(async () => { pending.resolve(undefined); await pending.promise; });
    expect(await screen.findByText(/Your account changed while updating email preferences/)).toBeInTheDocument();
    expect(screen.queryByText("Updating email preferences…")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name })).toBeChecked();
    expect(screen.getByRole("switch", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload preferences" })).toBeDisabled();
    act(() => update.finish(true, true));
    expect(screen.getByRole("button", { name: "Reload preferences" })).toBeDisabled();
    act(() => resumeAuthorizationReads(token));
    expect(screen.getByRole("button", { name: "Reload preferences" })).toBeEnabled();
    vi.mocked(invalidateAnnouncementPreferences).mockRejectedValueOnce(new Error("reload offline"));
    await user.click(screen.getByRole("button", { name: "Reload preferences" }));
    expect(await screen.findByText(/We couldn’t reload your email preferences/)).toBeInTheDocument();
    expect(screen.queryByText(/Your email preferences were saved, but/)).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name })).toBeDisabled();
    vi.mocked(invalidateAnnouncementPreferences).mockImplementationOnce(async () => setPreferences(scope === "section" ? ["s1"] : [], scope === "global"));
    await user.click(screen.getByRole("button", { name: "Reload preferences" }));
    await waitFor(() => expect(screen.queryByText(/Your account changed while updating email preferences/)).not.toBeInTheDocument());
    expect(screen.getByRole("switch", { name })).not.toBeChecked();
    expect(screen.getByRole("switch", { name })).toBeEnabled();
    expect(mutation).toHaveBeenCalledOnce();
    expect(invalidateAnnouncementPreferences).toHaveBeenCalledTimes(phase === "write" ? 2 : 3);
  });

  it("shows 'not a member' when user has no sections", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: null,
          announcementOptOutAll: false,
          userGroups: [],
          optOuts: [],
        },
        allUserGroups: [],
      },
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
          announcementOptOutAll: false,
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
          announcementOptOutAll: false,
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
          announcementOptOutAll: false,
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
          announcementOptOutAll: false,
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

  it("retains a confirmed global preference and offers a read-only retry after refresh failure", async () => {
    const user = userEvent.setup();
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({data: {user: {membershipStatus: "REGULAR", announcementOptOutAll: false, userGroups: [], optOuts: []}, allUserGroups: []}, isLoading: false} as never);
    vi.mocked(invalidateAnnouncementPreferences).mockRejectedValueOnce(new Error("offline"));
    renderAccountSettings({user: mockUser, userData, isAdmin: false});
    const toggle = screen.getByRole("switch", {name: "Receive announcement emails"});
    await user.click(toggle);
    expect(await screen.findByText(/Your email preferences were saved, but/)).toBeInTheDocument();
    expect(toggle).not.toBeChecked(); expect(toggle).toBeDisabled();
    await user.click(screen.getByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Your email preferences were saved, but/)).not.toBeInTheDocument());
    expect(mockUpdateGlobalOptOutAsync).toHaveBeenCalledOnce(); expect(invalidateAnnouncementPreferences).toHaveBeenCalledTimes(2);
  });

  it("reverts a rejected global preference write and shows actionable feedback", async () => {
    const user = userEvent.setup();
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({data: {user: {membershipStatus: "REGULAR", announcementOptOutAll: false, userGroups: [], optOuts: []}, allUserGroups: []}, isLoading: false} as never);
    mockUpdateGlobalOptOutAsync.mockRejectedValueOnce(new Error("offline"));
    renderAccountSettings({user: mockUser, userData, isAdmin: false});
    const toggle = screen.getByRole("switch", {name: "Receive announcement emails"}); await user.click(toggle);
    expect(await screen.findByText(/We couldn’t save your email preferences/)).toBeInTheDocument();
    expect(toggle).toBeChecked(); expect(invalidateAnnouncementPreferences).not.toHaveBeenCalled();
  });

  it("sets the global opt-out and disables section switches", async () => {
    const interaction = userEvent.setup();
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          announcementOptOutAll: false,
          userGroups: [{ userGroup: sectionWithAccess }],
          optOuts: [],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    vi.mocked(invalidateAnnouncementPreferences).mockImplementationOnce(async () => {
      vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
        data: {user: {membershipStatus: MembershipStatus.REGULAR, announcementOptOutAll: true, userGroups: [{userGroup: sectionWithAccess}], optOuts: []}, allUserGroups: []}, isLoading: false,
      } as never);
    });
    const view = renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(
      screen.queryByText(/will not receive announcement emails from any section/i),
    ).not.toBeInTheDocument();

    await interaction.click(
      screen.getByRole("switch", { name: "Receive announcement emails" }),
    );

    await waitFor(() => {
      expect(mockUpdateGlobalOptOutAsync).toHaveBeenCalledWith({
        announcementOptOutAll: true,
      });
    });
    expect(screen.getByRole("switch", { name: "Alpha Section" })).toBeDisabled();
    expect(screen.getByText("Opted out of all announcement emails")).toBeInTheDocument();
    expect(
      screen.getByText(/will not receive announcement emails from any section/i),
    ).toBeInTheDocument();
    // A later authoritative result must supersede the optimistic write value.
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {user: {membershipStatus: MembershipStatus.REGULAR, announcementOptOutAll: false, userGroups: [{userGroup: sectionWithAccess}], optOuts: []}, allUserGroups: []}, isLoading: false,
    } as never);
    view.rerender(<MemoryRouter><AccountSettingsPage user={mockUser} userData={userData} isAdmin={false} /></MemoryRouter>);
    expect(screen.getByRole("switch", {name: "Receive announcement emails"})).toBeChecked();
  });

  it("explains that section choices are overridden when loaded with the global opt-out already on", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          announcementOptOutAll: true,
          userGroups: [{ userGroup: sectionWithAccess }],
          optOuts: [],
        },
        allUserGroups: [],
      },
      isLoading: false,
    } as never);

    renderAccountSettings({ user: mockUser, userData, isAdmin: false });

    expect(screen.getByRole("switch", { name: "Alpha Section" })).toBeDisabled();
    expect(
      screen.getByText(/will not receive announcement emails from any section/i),
    ).toBeInTheDocument();
  });

  it("shows section with MODERATOR access (tests || branch in grantsAccess)", () => {
    vi.mocked(dataConnectReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          announcementOptOutAll: false,
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
          announcementOptOutAll: false,
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

// Display/interaction stubs stay shared; transport freshness is tested separately.
vi.mock("../../../../shared/query/authoritativeHooks", async () => import("@dataconnect/generated/react"));
