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
  upsertUser: vi.fn().mockResolvedValue({ data: {} }),
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
