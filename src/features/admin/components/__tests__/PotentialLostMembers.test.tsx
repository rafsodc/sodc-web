import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../../test-utils";
import PotentialLostMembers from "../PotentialLostMembers";
import { listPotentialLostMembers, confirmPotentialLostMember, type PotentialLostMember } from "../../../../shared/utils/firebaseFunctions/potentialLost";
vi.mock("../../../../shared/utils/firebaseFunctions/potentialLost", () => ({ listPotentialLostMembers: vi.fn(), confirmPotentialLostMember: vi.fn() }));
const list = vi.mocked(listPotentialLostMembers);
const confirm = vi.mocked(confirmPotentialLostMember);
const member: PotentialLostMember = { id: "one", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", membershipStatus: "REGULAR", lastSignInTime: "2020-01-01", inactivitySince: "2020-01-01", lastActivityTime: "2020-02-01", activitySource: "TOKEN_REFRESH", emailBounceCount: 3, emailLastBounceAt: "2026-01-01", reasons: ["INACTIVE", "BOUNCES"], canConfirm: true, blockedReason: null, reviewToken: "review" };
beforeEach(() => { list.mockReset(); confirm.mockReset(); list.mockResolvedValue({ members: [member] }); });
describe("potential lost admin list", () => {
  it("shows reasons and evidence but changes nothing until explicit confirmation", async () => {
    confirm.mockResolvedValue({ success: true });
    render(<PotentialLostMembers />);
    expect(screen.getByLabelText("Loading potential lost members")).toBeInTheDocument();
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Last activity" })).toBeInTheDocument();
    expect(screen.getByText("01/02/2020")).toBeInTheDocument();
    expect(screen.getByText("Token refresh")).toBeInTheDocument();
    expect(screen.getByText("No recorded activity for over three years; Repeated email bounces")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Lost" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText(/removes their member access/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Mark as Lost" }));
    list.mockResolvedValue({ members: [] });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Lost" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(member));
    expect(await screen.findByText("No members require review.")).toBeInTheDocument();
  });
  it("offers retry for a list failure", async () => {
    list.mockRejectedValueOnce(new Error("offline"));
    render(<PotentialLostMembers />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
  });
  it("asks for a refresh if confirmation fails", async () => {
    confirm.mockRejectedValue(new Error("changed evidence"));
    render(<PotentialLostMembers />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark as Lost" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Lost" }));
    expect(await screen.findByText(/The change could not be confirmed/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("disables changes when the existing membership rules forbid them", async () => {
    list.mockResolvedValue({ members: [{ ...member, canConfirm: false, blockedReason: "Administrator accounts are protected", lastSignInTime: null, lastActivityTime: null, activitySource: "ACCOUNT_CREATED" }] });
    render(<PotentialLostMembers />);
    expect(await screen.findByRole("button", { name: "Mark as Lost" })).toBeDisabled();
    expect(screen.getByText(/No activity recorded/)).toBeInTheDocument();
    expect(screen.getByText("Administrator accounts are protected")).toBeInTheDocument();
  });
});
