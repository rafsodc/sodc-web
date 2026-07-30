import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { MembershipStatus } from "@dataconnect/generated";
import * as generated from "@dataconnect/generated";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import type { UserData } from "../../../../types";
import ProfileReviewDialog from "../ProfileReviewDialog";

vi.mock("@dataconnect/generated", () => ({
  confirmProfileReview: vi.fn().mockResolvedValue({ data: {} }),
  MembershipStatus: {
    REGULAR: "REGULAR",
  },
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  updateDisplayName: vi.fn().mockResolvedValue({ success: true }),
}));

const userData: UserData = {
  id: "user-1",
  firstName: "Alex",
  lastName: "Member",
  email: "stale@example.com",
  serviceNumber: "12345",
  mobileNumber: "+447700900123",
  postNominals: "MRAeS",
  rank: "Wing Commander",
  shareContactInfo: true,
  membershipStatus: MembershipStatus.REGULAR,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  profileReviewedAt: null,
};

describe("ProfileReviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generated.confirmProfileReview).mockResolvedValue({ data: {} } as never);
    vi.mocked(firebaseFunctions.updateDisplayName).mockResolvedValue({ success: true });
  });

  it("shows all review fields and sources the read-only email from Firebase Auth", () => {
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Please review your profile" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue("Alex");
    expect(screen.getByRole("textbox", { name: "Last name" })).toHaveValue("Member");
    expect(screen.getByRole("textbox", { name: "Service number" })).toHaveValue("12345");
    expect(screen.getByRole("textbox", { name: "Mobile number" })).toHaveValue(
      "+447700900123",
    );
    expect(screen.getByRole("textbox", { name: "Post-nominals" })).toHaveValue("MRAeS");
    expect(screen.getByRole("combobox", { name: /Rank.*Title/ })).toHaveTextContent(
      "Wing Commander",
    );
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("verified@example.com");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("readonly");
    expect(
      screen.getByRole("checkbox", {
        name: "Share my email address and mobile number with members in my sections",
      }),
    ).toBeChecked();
  });

  it("normalises and atomically submits the reviewed fields before completing", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    render(
      <ProfileReviewDialog
        userData={{ ...userData, mobileNumber: "07700 900123" }}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => {
      expect(generated.confirmProfileReview).toHaveBeenCalledWith(
        {},
        {
          firstName: "Alex",
          lastName: "Member",
          serviceNumber: "12345",
          mobileNumber: "+447700900123",
          postNominals: "MRAeS",
          rank: "Wing Commander",
          shareContactInfo: true,
        },
      );
    });
    expect(firebaseFunctions.updateDisplayName).toHaveBeenCalledWith("Member, Alex");
    expect(onReviewed).toHaveBeenCalledTimes(1);
  });

  it("keeps the review open and allows retry when saving fails", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    vi.mocked(generated.confirmProfileReview).mockRejectedValueOnce(new Error("Network unavailable"));
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    expect(onReviewed).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm profile" })).toBeEnabled();
  });

  it("rejects an invalid mobile number without writing", async () => {
    const interaction = userEvent.setup();
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Mobile number" }), {
      target: { value: "not a number" },
    });
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    expect(
      screen.getByText(/Enter a valid mobile number, including the country code/),
    ).toBeInTheDocument();
    expect(generated.confirmProfileReview).not.toHaveBeenCalled();
  });
});
