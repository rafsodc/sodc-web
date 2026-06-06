import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import ProfileCompletion from "../ProfileCompletion";
import { MembershipStatus } from "@dataconnect/generated";

const executeMutation = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const mutationRef = vi.fn((_dc: unknown, _name: unknown, vars: unknown) => vars);

vi.mock("firebase/data-connect", () => ({
  executeMutation: (mutation: unknown) => executeMutation(mutation),
  mutationRef: (dc: unknown, name: unknown, vars: unknown) => mutationRef(dc, name, vars),
}));

vi.mock("../../../../config/firebase", () => ({
  auth: {
    currentUser: {
      uid: "user-1",
      getIdToken: vi.fn().mockResolvedValue("token"),
    },
  },
  dataConnect: {},
}));

vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  syncPendingUserClaims: vi.fn().mockResolvedValue({ success: true }),
  updateDisplayName: vi.fn().mockResolvedValue({ success: true }),
}));

describe("ProfileCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show a membership status picker", () => {
    render(<ProfileCompletion userEmail="new@example.com" />);

    expect(screen.queryByLabelText(/Desired Membership Status/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/An administrator will review your service background/i)
    ).toBeInTheDocument();
  });

  it("submits profile with default requested membership status", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletion userEmail="new@example.com" />);

    const [firstNameInput, lastNameInput, , serviceNumberInput] = screen.getAllByRole("textbox");
    await user.type(firstNameInput, "New");
    await user.type(lastNameInput, "Member");
    await user.type(serviceNumberInput, "99999");
    await user.click(screen.getByRole("button", { name: "Submit Profile" }));

    await waitFor(() => {
      expect(mutationRef).toHaveBeenCalledWith(
        {},
        "CreateUserProfile",
        expect.objectContaining({
          requestedMembershipStatus: MembershipStatus.REGULAR,
          firstName: "New",
          lastName: "Member",
        })
      );
    });
  });
});
