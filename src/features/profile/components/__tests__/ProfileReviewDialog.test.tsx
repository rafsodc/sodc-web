import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { MembershipStatus } from "@dataconnect/generated";
import * as generated from "@dataconnect/generated";
import * as generatedReact from "@dataconnect/generated/react";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";
import type { UserData } from "../../../../types";
import ProfileReviewDialog from "../ProfileReviewDialog";
import { invalidateAnnouncementPreferences } from "../../../../shared/query/invalidation";
import { auth } from "../../../../config/firebase";
import { httpsCallable } from "firebase/functions";
import { getMyAuthorizationStatus } from "../../../../shared/auth/authorizationStatus";

vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("../../../../shared/auth/authorizationStatus", () => ({ getMyAuthorizationStatus: vi.fn() }));

vi.mock("../../../../shared/query/invalidation", () => ({
  invalidateAnnouncementPreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@dataconnect/generated", () => ({
  confirmProfileReview: vi.fn().mockResolvedValue({ data: {} }),
  MembershipStatus: {
    PENDING: "PENDING",
    REGULAR: "REGULAR",
    RESERVE: "RESERVE",
    CIVIL_SERVICE: "CIVIL_SERVICE",
    INDUSTRY: "INDUSTRY",
    RETIRED: "RETIRED",
    RESIGNED: "RESIGNED",
    LOST: "LOST",
    DECEASED: "DECEASED",
  },
  SectionUserGroupPurpose: {
    ACCESS: "ACCESS",
    MODERATOR: "MODERATOR",
  },
}));

const mockOptOut = vi.fn().mockResolvedValue(undefined);
const mockOptIn = vi.fn().mockResolvedValue(undefined);

vi.mock("@dataconnect/generated/react", () => ({
  useGetMyAnnouncementPreferences: vi.fn(() => ({
    data: {
      user: {
        membershipStatus: "REGULAR",
        announcementOptOutAll: false,
        userGroups: [],
        optOuts: [],
      },
      allUserGroups: [],
    },
    isLoading: false,
    isError: false,
  })),
  useOptOutSectionAnnouncement: vi.fn(() => ({ mutateAsync: mockOptOut })),
  useOptInSectionAnnouncement: vi.fn(() => ({ mutateAsync: mockOptIn })),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
  functions: {},
  auth: { currentUser: { uid: "user-1", getIdToken: vi.fn(), getIdTokenResult: vi.fn(async () => ({ claims: { enabled: true, admin: false, securityVersion: 1 } })) } },
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  updateDisplayName: vi.fn().mockResolvedValue({ success: true }),
  updateMembershipStatus: vi.fn().mockResolvedValue({ success: true }),
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
  isRegular: true,
  isReserve: false,
  isCivilServant: false,
  isIndustry: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  profileReviewedAt: null,
};

describe("ProfileReviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invalidateAnnouncementPreferences).mockResolvedValue(undefined);
    vi.mocked(generated.confirmProfileReview).mockResolvedValue({ data: {} } as never);
    vi.mocked(firebaseFunctions.updateDisplayName).mockResolvedValue({ success: true });
    vi.mocked(firebaseFunctions.updateMembershipStatus).mockResolvedValue({ success: true });
    mockOptOut.mockResolvedValue(undefined);
    mockOptIn.mockResolvedValue(undefined);
    vi.mocked(generatedReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: "REGULAR",
          announcementOptOutAll: false,
          userGroups: [],
          optOuts: [],
        },
        allUserGroups: [],
      },
      isLoading: false,
      isError: false,
    } as never);
  });

  it("reviews per-section preferences before advancing the profile timestamp", async () => {
    vi.mocked(generatedReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: "REGULAR",
          announcementOptOutAll: false,
          userGroups: [
            {
              userGroup: {
                membershipStatuses: [],
                purposeLinks: [
                  {
                    purposes: ["ACCESS"],
                    section: { id: "section-1", name: "Golf" },
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
      isError: false,
    } as never);
    const interaction = userEvent.setup();
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={vi.fn()}
      />,
    );

    await interaction.click(await screen.findByRole("checkbox", { name: "Golf" }));
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => expect(mockOptOut).toHaveBeenCalledWith({ sectionId: "section-1" }));
    expect(mockOptOut.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(generated.confirmProfileReview).mock.invocationCallOrder[0]!,
    );
  });

  it("does not advance the profile timestamp when a preference save fails", async () => {
    vi.mocked(generatedReact.useGetMyAnnouncementPreferences).mockReturnValue({
      data: {
        user: {
          membershipStatus: "REGULAR",
          announcementOptOutAll: false,
          userGroups: [
            {
              userGroup: {
                membershipStatuses: [],
                purposeLinks: [
                  {
                    purposes: ["ACCESS"],
                    section: { id: "section-1", name: "Golf" },
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
      isError: false,
    } as never);
    mockOptOut.mockRejectedValueOnce(new Error("Preference save failed"));
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    await interaction.click(await screen.findByRole("checkbox", { name: "Golf" }));
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    expect(
      await screen.findByText("We couldn’t save your profile review. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Preference save failed")).not.toBeInTheDocument();
    expect(generated.confirmProfileReview).not.toHaveBeenCalled();
    expect(onReviewed).not.toHaveBeenCalled();
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
    expect(screen.getByTestId("review-membership-status-select")).toHaveTextContent("Regular");
    expect(
      screen.getByRole("checkbox", {
        name: "Share my email address and mobile number with members in my sections",
      }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Regular" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Regular" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Reserve" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Civil Servant" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Industry" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Receive announcement emails" })).toBeChecked();
  });

  it("normalises and atomically submits the reviewed fields before completing", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    function ReviewHarness() {
      const [complete, setComplete] = useState(false);
      if (complete) return <div>Profile review complete</div>;
      return (
        <ProfileReviewDialog
          userData={{ ...userData, mobileNumber: "07700 900123" }}
          userEmail="verified@example.com"
          onReviewed={() => {
            onReviewed();
            setComplete(true);
          }}
        />
      );
    }
    render(<ReviewHarness />);

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
          announcementOptOutAll: false,
          isRegular: true,
          isReserve: false,
          isCivilServant: false,
          isIndustry: true,
        },
      );
    });
    expect(firebaseFunctions.updateDisplayName).toHaveBeenCalledWith("Member, Alex");
    expect(onReviewed).toHaveBeenCalledTimes(1);
    expect(invalidateAnnouncementPreferences).toHaveBeenCalledOnce();
    expect(await screen.findByText("Profile review complete")).toBeInTheDocument();
  });

  it("submits edited service background selections", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    await interaction.click(screen.getByRole("checkbox", { name: "Regular" }));
    await interaction.click(screen.getByRole("checkbox", { name: "Reserve" }));
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => {
      expect(generated.confirmProfileReview).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          isRegular: false,
          isReserve: true,
          isCivilServant: false,
          isIndustry: true,
        }),
      );
    });
    expect(onReviewed).toHaveBeenCalledTimes(1);
  });

  it("submits an updated membership status", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    const selectRoot = screen.getByTestId("review-membership-status-select");
    const trigger =
      selectRoot.querySelector('[role="combobox"]') ??
      selectRoot.querySelector(".MuiSelect-select") ??
      selectRoot;
    fireEvent.mouseDown(trigger);
    await interaction.click(await screen.findByRole("option", { name: "Reserve" }));
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => {
      expect(firebaseFunctions.updateMembershipStatus).toHaveBeenCalledWith("user-1", "RESERVE");
    });
    expect(onReviewed).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("saves the entered review after N to N+1 authority, explicit refresh retry=%s", async failFirstRefresh => {
    let serverVersion = 1;
    let jwtVersion = 1;
    let committed = false;
    let refreshCalls = 0;
    const statusWrite = vi.fn(async () => {
      if (jwtVersion !== serverVersion) throw new Error("SESSION_VERSION_STALE");
      if (!committed) { serverVersion += 1; committed = true; }
      return { data: { success: true } };
    });
    vi.mocked(httpsCallable).mockReturnValue(statusWrite as never);
    vi.mocked(auth.currentUser!.getIdToken).mockImplementation(async force => {
      if (force && ++refreshCalls === 1 && failFirstRefresh) throw new Error("offline");
      if (force) jwtVersion = serverVersion;
      return `jwt-v${jwtVersion}`;
    });
    vi.mocked(getMyAuthorizationStatus).mockImplementation(async () => ({ status: "enabled", verificationRequired: false,
      tokenVersionCurrent: jwtVersion === serverVersion, securityVersion: serverVersion, isAdmin: false }));
    const actual = await import("../../../../shared/utils/firebaseFunctions/userAdmin");
    vi.mocked(firebaseFunctions.updateMembershipStatus).mockImplementation(actual.updateMembershipStatus);
    vi.mocked(generated.confirmProfileReview).mockImplementation(async () => {
      if (jwtVersion !== serverVersion) throw new Error("SESSION_VERSION_STALE");
      return { data: {} } as never;
    });
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    render(<ProfileReviewDialog userData={userData} userEmail="verified@example.com" onReviewed={onReviewed} />);
    await interaction.clear(screen.getByLabelText(/First name/));
    await interaction.type(screen.getByLabelText(/First name/), "Updated Alex");
    const select = screen.getByTestId("review-membership-status-select");
    fireEvent.mouseDown(select.querySelector('[role="combobox"]') ?? select.querySelector(".MuiSelect-select") ?? select);
    await interaction.click(await screen.findByRole("option", { name: "Reserve" }));
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));
    if (failFirstRefresh) {
      expect(await screen.findByText(/Your membership status was saved/)).toBeInTheDocument();
      expect(generated.confirmProfileReview).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/First name/)).toHaveValue("Updated Alex");
      expect(statusWrite).toHaveBeenCalledOnce();
      await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));
    }
    await waitFor(() => expect(onReviewed).toHaveBeenCalledOnce());
    expect(serverVersion).toBe(2);
    expect(jwtVersion).toBe(2);
    expect(statusWrite).toHaveBeenCalledTimes(failFirstRefresh ? 2 : 1);
    expect(generated.confirmProfileReview).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.objectContaining({ firstName: "Updated Alex" }));
  });

  it.each(["preferences", "profile"])("retries only reads after a confirmed review and failed %s refresh", async failure => {
    const interaction = userEvent.setup(), onReviewed = vi.fn().mockResolvedValue(undefined);
    if (failure === "preferences") vi.mocked(invalidateAnnouncementPreferences).mockRejectedValueOnce(new Error("offline"));
    else onReviewed.mockRejectedValueOnce(new Error("offline"));
    render(<ProfileReviewDialog userData={userData} userEmail="verified@example.com" onReviewed={onReviewed} />);
    await interaction.click(screen.getByRole("button", {name: "Confirm profile"}));
    expect(await screen.findByText(/Your profile review was saved, but/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", {name: "First name"})).toBeDisabled();
    await interaction.click(screen.getByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Your profile review was saved, but/)).not.toBeInTheDocument());
    expect(generated.confirmProfileReview).toHaveBeenCalledOnce();
    expect(firebaseFunctions.updateDisplayName).toHaveBeenCalledOnce();
    expect(mockOptOut).not.toHaveBeenCalled(); expect(mockOptIn).not.toHaveBeenCalled();
    expect(onReviewed).toHaveBeenCalledTimes(failure === "profile" ? 2 : 1);
  });

  it("does not confirm the review when the membership status update fails", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    vi.mocked(firebaseFunctions.updateMembershipStatus).mockResolvedValueOnce({
      success: false,
      error: "Membership status update failed",
    });
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    const selectRoot = screen.getByTestId("review-membership-status-select");
    const trigger =
      selectRoot.querySelector('[role="combobox"]') ??
      selectRoot.querySelector(".MuiSelect-select") ??
      selectRoot;
    fireEvent.mouseDown(trigger);
    await interaction.click(await screen.findByRole("option", { name: "Reserve" }));
    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => {
      expect(firebaseFunctions.updateMembershipStatus).toHaveBeenCalledWith("user-1", "RESERVE");
    });
    expect(generated.confirmProfileReview).not.toHaveBeenCalled();
    expect(onReviewed).not.toHaveBeenCalled();
  });

  it("does not call updateMembershipStatus when the status is unchanged", async () => {
    const interaction = userEvent.setup();
    const onReviewed = vi.fn();
    render(
      <ProfileReviewDialog
        userData={userData}
        userEmail="verified@example.com"
        onReviewed={onReviewed}
      />,
    );

    await interaction.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => expect(onReviewed).toHaveBeenCalledTimes(1));
    expect(firebaseFunctions.updateMembershipStatus).not.toHaveBeenCalled();
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

    expect(
      await screen.findByText("We couldn’t save your profile review. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Network unavailable")).not.toBeInTheDocument();
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

// Display/interaction stubs stay shared; transport freshness is tested separately.
vi.mock("../../../../shared/query/authoritativeHooks", async () => import("@dataconnect/generated/react"));
