import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import { getUserById, updateUser, MembershipStatus } from "../../../../dataconnect-generated";
import { updateUserEmail } from "../../../../shared/utils/firebaseFunctions";
import EditUserDialog from "../EditUserDialog";
import type { SearchUser } from "../../../../types";

vi.mock("firebase/data-connect", () => ({ QueryFetchPolicy: { SERVER_ONLY: "server-only" } }));
vi.mock("../../../../dataconnect-generated", async (original) => ({
  ...await original<typeof import("../../../../dataconnect-generated")>(),
  getUserById: vi.fn(), updateUser: vi.fn(),
}));
vi.mock("../../../../shared/query/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("../../../users/hooks/useAdminClaim", () => ({ useAdminClaim: () => true }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  updateUserDisplayName: vi.fn().mockResolvedValue({ success: true }),
  updateMembershipStatus: vi.fn().mockResolvedValue({ success: true }),
  updateUserEmail: vi.fn(), userEmailChangeError: vi.fn(),
}));

const user = { uid: "member", email: "auth@example.org", displayName: "Member, Test", customClaims: { enabled: true } } as SearchUser;
const profile = { id: "member", email: "profile@example.org", firstName: "Test", lastName: "Member", serviceNumber: "12345", membershipStatus: MembershipStatus.REGULAR };

describe("EditUserDialog email integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserById).mockResolvedValue({ data: { user: profile } } as Awaited<ReturnType<typeof getUserById>>);
    vi.mocked(updateUser).mockResolvedValue({ data: { user_update: { id: "member" } } } as Awaited<ReturnType<typeof updateUser>>);
    vi.mocked(updateUserEmail).mockResolvedValue({ success: true, email: "new@example.org", verificationRequired: true, verificationEmailSent: true });
  });

  it("makes email read-only and excludes it from an ordinary profile save", async () => {
    render(<EditUserDialog open user={user} onClose={vi.fn()} onSave={vi.fn()} />);
    await screen.findByDisplayValue("profile@example.org");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledOnce());
    expect(vi.mocked(updateUser).mock.calls[0][1]).not.toHaveProperty("email");
    expect(updateUserEmail).not.toHaveBeenCalled();
  });

  it("uses the Auth address for conflict detection and refreshes the profile after changing it", async () => {
    const onSave = vi.fn();
    render(<EditUserDialog open user={user} onClose={vi.fn()} onSave={onSave} />);
    await screen.findByDisplayValue("profile@example.org");
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(screen.getByText("Current sign-in email: auth@example.org")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/New email address/), { target: { value: "new@example.org" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    await screen.findByText(/profile and sign-in email are now/);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(updateUserEmail).toHaveBeenCalledWith("member", "new@example.org", "auth@example.org");
    expect(getUserById).toHaveBeenLastCalledWith({}, { id: "member" }, { fetchPolicy: "server-only" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does not claim a profile can be updated when it is missing", async () => {
    vi.mocked(getUserById).mockResolvedValue({ data: { user: null } } as unknown as Awaited<ReturnType<typeof getUserById>>);
    render(<EditUserDialog open user={user} onClose={vi.fn()} onSave={vi.fn()} />);
    await screen.findByText(/A saved profile is required/);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change email" })).toBeDisabled();
  });
});
