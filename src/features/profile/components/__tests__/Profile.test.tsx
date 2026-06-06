import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "../../../../test-utils";
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
    PENDING: "PENDING",
  },
}));

vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "user-1" } },
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  updateDisplayName: vi.fn().mockResolvedValue({ success: true }),
  updateMembershipStatus: vi.fn(),
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

  it("shows read-only membership status and account settings link", () => {
    renderProfile({ userData, userEmail: userData.email });

    expect(screen.getByText(/Membership status:/)).toHaveTextContent("Regular");
    expect(screen.getByRole("link", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/account/settings"
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Membership Status/i)).not.toBeInTheDocument();
  });

  it("saves identity fields without updating membership status", async () => {
    const user = userEvent.setup();
    renderProfile({ userData, userEmail: userData.email });

    const [firstNameInput, lastNameInput, serviceNumberInput] = screen.getAllByRole("textbox");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Jordan");
    expect(lastNameInput).toHaveValue("Member");
    expect(serviceNumberInput).toHaveValue("12345");
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
});
