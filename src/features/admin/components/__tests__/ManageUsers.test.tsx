import { useState } from "react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import ManageUsers from "../ManageUsers";

const mocks = vi.hoisted(() => ({
  refetchSearch: vi.fn(),
  listAdminUsers: vi.fn(),
}));

const searchUsers = [
  {
    uid: "current-user",
    email: "current@example.com",
    displayName: "Current, User",
    customClaims: { admin: true, enabled: true },
  },
  {
    uid: "other-user",
    email: "other@example.com",
    displayName: "Other, User",
    customClaims: { admin: false, enabled: true },
  },
];

vi.mock("../../../users/hooks/useUserSearch", () => ({
  useUserSearch: () => ({
    users: searchUsers,
    loading: false,
    error: null,
    page: 1,
    totalPages: 1,
    total: searchUsers.length,
    setPage: vi.fn(),
    setSearchTerm: vi.fn(),
    searchTerm: "user",
    refetch: mocks.refetchSearch,
  }),
}));

vi.mock("../../../users/hooks/useAdminClaim", () => ({ useAdminClaim: () => true }));
vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "current-user" } },
}));
vi.mock("../listAdminUsers", () => ({ listAdminUsers: mocks.listAdminUsers }));
vi.mock("../../../../shared/utils/firebaseFunctions", () => ({
  grantAdminClaim: vi.fn(),
  revokeAdminClaim: vi.fn(),
}));
vi.mock("../../../users/components/UsersTable", () => ({
  default: ({ users, onEdit }: { users: typeof searchUsers; onEdit: (user: (typeof searchUsers)[number]) => void }) => (
    <div>
      {users.map((user) => (
        <button key={user.uid} onClick={() => onEdit(user)}>
          Edit {user.email}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../../../profile/components/EditUserDialog", () => ({
  default: ({ open, user, onSave }: { open: boolean; user: (typeof searchUsers)[number] | null; onSave: () => void }) =>
    open ? <button onClick={onSave}>Save {user?.email}</button> : null,
}));
vi.mock("../../../users/components/AdminUsersTable", () => ({ default: () => null }));
vi.mock("../UserGroupMemberships", () => ({ default: () => null }));

function Harness() {
  const [refreshes, setRefreshes] = useState(0);
  return (
    <>
      <div>Current-user refreshes: {refreshes}</div>
      <ManageUsers onBack={vi.fn()} onCurrentUserUpdate={() => setRefreshes((value) => value + 1)} />
    </>
  );
}

describe("ManageUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAdminUsers.mockResolvedValue({ success: true, users: [] });
  });

  it("refreshes rendered app-level user state after an admin edits their own profile", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(await screen.findByRole("button", { name: "Edit current@example.com" }));
    await user.click(screen.getByRole("button", { name: "Save current@example.com" }));

    await waitFor(() => {
      expect(screen.getByText("Current-user refreshes: 1")).toBeInTheDocument();
    });
    expect(mocks.refetchSearch).toHaveBeenCalled();
  });

  it("does not refresh app-level current-user state when another user is edited", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(await screen.findByRole("button", { name: "Edit other@example.com" }));
    await user.click(screen.getByRole("button", { name: "Save other@example.com" }));

    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Current-user refreshes: 0")).toBeInTheDocument();
  });
});
