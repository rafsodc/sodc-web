import { useState } from "react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../../test-utils";
import ManageUsers from "../ManageUsers";
import * as firebaseFunctions from "../../../../shared/utils/firebaseFunctions";

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
  default: ({
    users,
    onEdit,
    onGrantAdmin,
    onRevokeAdmin,
  }: {
    users: typeof searchUsers;
    onEdit: (user: (typeof searchUsers)[number]) => void;
    onGrantAdmin: (uid: string) => void;
    onRevokeAdmin: (uid: string) => void;
  }) => (
    <div>
      {users.map((user) => (
        <div key={user.uid}>
          <button onClick={() => onEdit(user)}>Edit {user.email}</button>
          <button onClick={() => onGrantAdmin(user.uid)}>Grant {user.email}</button>
          <button onClick={() => onRevokeAdmin(user.uid)}>Revoke {user.email}</button>
        </div>
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
    vi.mocked(firebaseFunctions.grantAdminClaim).mockResolvedValue({ success: true, message: "Admin granted" });
    vi.mocked(firebaseFunctions.revokeAdminClaim).mockResolvedValue({ success: true, message: "Admin revoked" });
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

  it("renders successful grant and revoke outcomes after refreshing administrator state", async () => {
    const user = userEvent.setup();
    mocks.listAdminUsers.mockResolvedValue({
      success: true,
      users: [
        {
          uid: "current-user",
          email: "current@example.com",
          displayName: "Current, User",
          emailVerified: true,
          disabled: false,
          metadata: { creationTime: "2026-01-01", lastSignInTime: "2026-08-10" },
        },
        {
          uid: "second-admin",
          email: "admin@example.com",
          displayName: "Second, Admin",
          emailVerified: true,
          disabled: false,
          metadata: { creationTime: "2026-01-01", lastSignInTime: "2026-08-10" },
        },
      ],
    });
    render(<Harness />);

    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "Grant other@example.com" }));
    expect(await screen.findByText("Admin granted")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revoke current@example.com" }));
    expect(await screen.findByText("Admin revoked")).toBeInTheDocument();
    expect(firebaseFunctions.grantAdminClaim).toHaveBeenCalledWith("other-user");
    expect(firebaseFunctions.revokeAdminClaim).toHaveBeenCalledWith("current-user");
  });
});
