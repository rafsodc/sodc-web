import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
import ProfileCompletion from "../ProfileCompletion";
import { checkUserProfileExists, MembershipStatus } from "@dataconnect/generated";
import { syncPendingUserClaims } from "../../../../shared/utils/firebaseFunctions";

const executeMutation = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const mutationRef = vi.fn((_dc: unknown, _name: unknown, vars: unknown) => vars);

vi.mock("firebase/data-connect", () => ({
  QueryFetchPolicy: { SERVER_ONLY: "server-only" },
  executeMutation: (mutation: unknown) => executeMutation(mutation),
  mutationRef: (dc: unknown, name: unknown, vars: unknown) => mutationRef(dc, name, vars),
}));

vi.mock("@dataconnect/generated", async (original) => ({
  ...await original<typeof import("@dataconnect/generated")>(),
  checkUserProfileExists: vi.fn(),
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
      screen.getByText(/Tick all that apply/i)
    ).toBeInTheDocument();
  });

  it("submits profile with default requested membership status", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletion userEmail="new@example.com" />);

    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "New");
    await user.type(textboxes[1], "Member");
    const serviceNumberInput = document.querySelector('input[maxlength="50"]') as HTMLInputElement;
    await user.type(serviceNumberInput, "99999");
    await user.type(screen.getByLabelText(/Mobile number/i), "07700 900123");
    await user.click(screen.getByRole("button", { name: /submit profile/i }));

    await waitFor(() => {
      expect(mutationRef).toHaveBeenCalledWith(
        {},
        "CreateUserProfile",
        expect.objectContaining({
          requestedMembershipStatus: MembershipStatus.REGULAR,
          firstName: "New",
          lastName: "Member",
          mobileNumber: "+447700900123",
          postNominals: null,
          rank: null,
        })
      );
    });
  });

  it("includes the selected rank when submitting", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletion userEmail="new@example.com" />);

    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "New");
    await user.type(textboxes[1], "Member");
    const serviceNumberInput = document.querySelector('input[maxlength="50"]') as HTMLInputElement;
    await user.type(serviceNumberInput, "99999");
    await user.type(screen.getByLabelText(/Mobile number/i), "07700 900123");

    const rankSelect = screen.getByLabelText("Rank / Title");
    fireEvent.mouseDown(rankSelect);
    await user.click(await screen.findByRole("option", { name: "Flight Lieutenant" }));
    await user.click(screen.getByRole("button", { name: /submit profile/i }));

    await waitFor(() => {
      expect(mutationRef).toHaveBeenCalledWith(
        {},
        "CreateUserProfile",
        expect.objectContaining({ rank: "Flight Lieutenant" })
      );
    });
  });

  it("resumes an already-created profile after a lost response without overwriting it", async () => {
    executeMutation.mockRejectedValueOnce(new Error("profile already exists"));
    vi.mocked(checkUserProfileExists).mockResolvedValue({ data: { user: { id: "user-1" } } } as Awaited<ReturnType<typeof checkUserProfileExists>>);
    const onComplete = vi.fn();
    render(<ProfileCompletion userEmail="new@example.com" onComplete={onComplete} />);
    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "New" } });
    fireEvent.change(textboxes[1], { target: { value: "Member" } });
    fireEvent.change(document.querySelector('input[maxlength="50"]')!, { target: { value: "99999" } });
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: "07700 900123" } });
    fireEvent.click(screen.getByRole("button", { name: /submit profile/i }));
    await screen.findByText(/your profile has been submitted/);
    expect(checkUserProfileExists).toHaveBeenCalledWith({}, { fetchPolicy: "server-only" });
    expect(syncPendingUserClaims).toHaveBeenCalledOnce();
    expect(executeMutation).toHaveBeenCalledOnce();
  });
});
