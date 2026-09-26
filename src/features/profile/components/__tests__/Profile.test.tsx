import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor, fireEvent } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Profile from "../Profile";
import { MembershipStatus } from "@dataconnect/generated";
import type { UserData } from "../../../../types";
import * as dataconnect from "@dataconnect/generated";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

vi.mock("@dataconnect/generated", () => ({
  upsertUser: vi.fn().mockResolvedValue({ data: { user_update: { id: "user-1" } } }),
  MembershipStatus: {
    REGULAR: "REGULAR",
    RESERVE: "RESERVE",
    RETIRED: "RETIRED",
    INDUSTRY: "INDUSTRY",
    CIVIL_SERVICE: "CIVIL_SERVICE",
    PENDING: "PENDING",
    RESIGNED: "RESIGNED",
    LOST: "LOST",
    DECEASED: "DECEASED",
  },
}));

vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "user-1" } },
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  updateDisplayName: vi.fn().mockResolvedValue({ success: true }),
  updateMembershipStatus: vi.fn().mockResolvedValue({ success: true }),
}));

const userData: UserData = {
  id: "user-1",
  firstName: "Alex",
  lastName: "Member",
  email: "member@example.com",
  serviceNumber: "12345",
  mobileNumber: "+447700900123",
  postNominals: "MRAeS",
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

function renderProfile(props: ComponentProps<typeof Profile>) {
  return render(
    <MemoryRouter>
      <Profile {...props} />
    </MemoryRouter>
  );
}

describe("Profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows membership status picker and account settings link", () => {
    renderProfile({ userData, userEmail: userData.email });

    expect(screen.getByTestId("membership-status-select")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/account/settings"
    );
  });

  it("shows the Firebase email as read-only and directs changes to account settings", () => {
    renderProfile({
      userData: { ...userData, email: "stale@example.com" },
      userEmail: "verified@example.com",
    });

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue(
      "verified@example.com",
    );
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("readonly");
    expect(
      screen.getByRole("link", { name: "Change email in Account settings" }),
    ).toHaveAttribute("href", "/account/settings");
    expect(screen.queryByDisplayValue("stale@example.com")).not.toBeInTheDocument();
  });

  it("saves identity fields without updating membership status when unchanged", async () => {
    const user = userEvent.setup();
    renderProfile({ userData, userEmail: userData.email });

    const [firstNameInput] = screen.getAllByRole("textbox");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Jordan");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(dataconnect.upsertUser).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          firstName: "Jordan",
          lastName: "Member",
          mobileNumber: "+447700900123",
          postNominals: "MRAeS",
        })
      );
    });

    expect(firebaseFunctions.updateMembershipStatus).not.toHaveBeenCalled();
    expect(screen.getByText("Profile updated successfully!")).toBeInTheDocument();
  });

  it("updates membership status when user selects another non-restricted status", async () => {
    const user = userEvent.setup();
    renderProfile({ userData, userEmail: userData.email });

    const selectRoot = screen.getByTestId("membership-status-select");
    const trigger =
      selectRoot.querySelector('[role="combobox"]') ??
      selectRoot.querySelector(".MuiSelect-select") ??
      selectRoot;
    fireEvent.mouseDown(trigger);
    await user.click(await screen.findByRole("option", { name: "Reserve" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(firebaseFunctions.updateMembershipStatus).toHaveBeenCalledWith(
        "user-1",
        MembershipStatus.RESERVE
      );
    });
  });

  it.each([null, undefined])("rejects a missing update result (%s) before changing membership or display name", async (user_update) => {
    vi.mocked(dataconnect.upsertUser).mockResolvedValueOnce({ data: { user_update } } as Awaited<ReturnType<typeof dataconnect.upsertUser>>);
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    renderProfile({ userData, userEmail: userData.email, onUpdate });
    fireEvent.mouseDown(screen.getByTestId("membership-status-select").querySelector('[role="combobox"]')!);
    await user.click(await screen.findByRole("option", { name: "Reserve" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Your profile could not be found. Contact an administrator before trying again.")).toBeInTheDocument();
    expect(screen.queryByText("Profile updated successfully!")).not.toBeInTheDocument();
    expect(firebaseFunctions.updateMembershipStatus).not.toHaveBeenCalled();
    expect(firebaseFunctions.updateDisplayName).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  });

  it("does not report success for an enabled user without a profile", async () => {
    vi.mocked(dataconnect.upsertUser).mockResolvedValueOnce({ data: { user_update: null } } as Awaited<ReturnType<typeof dataconnect.upsertUser>>);
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    renderProfile({ userData: null, userEmail: userData.email, onUpdate });
    fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: "Member" } });
    fireEvent.change(screen.getByLabelText(/Service Number/), { target: { value: "12345" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "+447700900123" } });
    fireEvent.mouseDown(screen.getByTestId("membership-status-select").querySelector('[role="combobox"]')!);
    await user.click(await screen.findByRole("option", { name: "Regular" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Your profile could not be found. Contact an administrator before trying again.")).toBeInTheDocument();
    expect(dataconnect.upsertUser).toHaveBeenCalledOnce();
    expect(screen.queryByText("Profile updated successfully!")).not.toBeInTheDocument();
    expect(firebaseFunctions.updateDisplayName).not.toHaveBeenCalled();
    expect(firebaseFunctions.updateMembershipStatus).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows trusted guidance when a membership transition is rejected", async () => {
    vi.mocked(firebaseFunctions.updateMembershipStatus).mockResolvedValueOnce({
      success: false,
      error: "FirebaseError: permission denied implementation detail",
      domainCode: "CURRENT_STATUS_RESTRICTED",
    });
    const user = userEvent.setup();
    renderProfile({ userData, userEmail: userData.email });

    const selectRoot = screen.getByTestId("membership-status-select");
    const trigger =
      selectRoot.querySelector('[role="combobox"]') ??
      selectRoot.querySelector(".MuiSelect-select") ??
      selectRoot;
    fireEvent.mouseDown(trigger);
    await user.click(await screen.findByRole("option", { name: "Reserve" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText(
        "Membership status cannot be changed from its current restricted status.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/FirebaseError: permission denied implementation detail/),
    ).not.toBeInTheDocument();
  });

  it("includes the selected rank when saving", async () => {
    const user = userEvent.setup();
    renderProfile({ userData, userEmail: userData.email });

    const rankSelect = screen.getByLabelText("Rank / Title");
    fireEvent.mouseDown(rankSelect);
    await user.click(await screen.findByRole("option", { name: "Wing Commander" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(dataconnect.upsertUser).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ rank: "Wing Commander" })
      );
    });
  });

  it("pre-fills the rank field from existing user data", () => {
    renderProfile({
      userData: { ...userData, rank: "Squadron Leader" },
      userEmail: userData.email,
    });

    expect(screen.getByText("Squadron Leader")).toBeInTheDocument();
  });

  it("locks membership status when current status is restricted", () => {
    renderProfile({
      userData: { ...userData, membershipStatus: MembershipStatus.PENDING },
      userEmail: userData.email,
    });

    const statusSelect = screen.getByTestId("membership-status-select");
    expect(statusSelect.className).toMatch(/Mui-disabled/);
    expect(screen.getByText(/Cannot change from restricted status/i)).toBeInTheDocument();
  });
});
