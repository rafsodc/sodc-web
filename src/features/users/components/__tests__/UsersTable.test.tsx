import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../../../test-utils";
import UsersTable from "../UsersTable";
import type { SearchUser } from "../../../../types";

function makeUser(overrides: Partial<SearchUser> = {}): SearchUser {
  return {
    uid: "user-1",
    email: "alice@example.com",
    displayName: "Alice Smith",
    emailVerified: true,
    disabled: false,
    membershipStatus: null,
    metadata: { creationTime: "2024-01-01T00:00:00Z", lastSignInTime: null },
    customClaims: {},
    ...overrides,
  };
}

describe("UsersTable", () => {
  it("renders Account and Membership column headers", () => {
    render(<UsersTable mode="edit" users={[]} />);
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Membership")).toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("shows friendly membership status label for a user with a profile", () => {
    render(<UsersTable mode="edit" users={[makeUser({ membershipStatus: "REGULAR" as never })]} />);
    expect(screen.getByText("Regular")).toBeInTheDocument();
  });

  it("shows 'No profile' for a user without a DC profile", () => {
    render(<UsersTable mode="edit" users={[makeUser({ membershipStatus: null })]} />);
    expect(screen.getByText("No profile")).toBeInTheDocument();
  });

  it("shows 'No profile' when membershipStatus is undefined", () => {
    const user = makeUser();
    delete (user as Partial<SearchUser>).membershipStatus;
    render(<UsersTable mode="edit" users={[user]} />);
    expect(screen.getByText("No profile")).toBeInTheDocument();
  });

  it("shows Active for a non-disabled user in the Account column", () => {
    render(<UsersTable mode="edit" users={[makeUser({ disabled: false })]} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Disabled for a disabled user in the Account column", () => {
    render(<UsersTable mode="edit" users={[makeUser({ disabled: true })]} />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders 'No users found' with correct colSpan when list is empty", () => {
    render(<UsersTable mode="edit" users={[]} />);
    const cell = screen.getByText("No users found").closest("td");
    expect(cell).toHaveAttribute("colspan", "7");
  });

  it("passes PENDING status through the label helper", () => {
    render(<UsersTable mode="edit" users={[makeUser({ membershipStatus: "PENDING" as never })]} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("calls onEdit when edit icon button is clicked in edit mode", () => {
    const onEdit = vi.fn();
    const user = makeUser();
    render(<UsersTable mode="edit" users={[user]} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /edit user/i }));
    expect(onEdit).toHaveBeenCalledWith(user);
  });

  it("shows Grant Admin button in admin mode for a non-admin enabled user", () => {
    const user = makeUser({ customClaims: { admin: false, enabled: true } });
    render(<UsersTable mode="admin" users={[user]} adminCount={2} />);
    expect(screen.getByRole("button", { name: /grant administrator/i })).toBeInTheDocument();
  });

  it("shows Revoke Admin button in admin mode for an admin user", () => {
    const user = makeUser({ customClaims: { admin: true, enabled: true } });
    render(<UsersTable mode="admin" users={[user]} adminCount={2} />);
    expect(screen.getByRole("button", { name: /revoke administrator/i })).toBeInTheDocument();
  });

  it("calls onGrantAdmin when Grant Admin is clicked", () => {
    const onGrantAdmin = vi.fn();
    const user = makeUser({ customClaims: { admin: false, enabled: true } });
    render(<UsersTable mode="admin" users={[user]} onGrantAdmin={onGrantAdmin} adminCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: /grant administrator/i }));
    expect(onGrantAdmin).toHaveBeenCalledWith(user.uid);
  });

  it("calls onRevokeAdmin when Revoke Admin is clicked", () => {
    const onRevokeAdmin = vi.fn();
    const user = makeUser({ customClaims: { admin: true, enabled: true } });
    render(<UsersTable mode="admin" users={[user]} onRevokeAdmin={onRevokeAdmin} adminCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: /revoke administrator/i }));
    expect(onRevokeAdmin).toHaveBeenCalledWith(user.uid);
  });

  it("disables Revoke Admin when adminCount is 1", () => {
    const user = makeUser({ customClaims: { admin: true, enabled: true } });
    render(<UsersTable mode="admin" users={[user]} adminCount={1} />);
    expect(screen.getByRole("button", { name: /revoke administrator/i })).toBeDisabled();
  });

  it("disables Grant Admin for a non-enabled user", () => {
    const user = makeUser({ customClaims: { admin: false, enabled: false } });
    render(<UsersTable mode="admin" users={[user]} adminCount={2} />);
    expect(screen.getByRole("button", { name: /grant administrator/i })).toBeDisabled();
  });

  it("shows Edit User and admin buttons when onEdit is provided in admin mode", () => {
    const onEdit = vi.fn();
    const user = makeUser({ customClaims: { admin: false, enabled: true } });
    render(<UsersTable mode="admin" users={[user]} onEdit={onEdit} adminCount={2} />);
    expect(screen.getByRole("button", { name: /edit user profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grant administrator/i })).toBeInTheDocument();
  });

  it("shows Edit Groups button when onEditGroups is provided", () => {
    const user = makeUser({ customClaims: { admin: false, enabled: true } });
    render(
      <UsersTable
        mode="admin"
        users={[user]}
        onEdit={vi.fn()}
        onEditGroups={vi.fn()}
        adminCount={2}
      />
    );
    expect(screen.getByRole("button", { name: /edit user group/i })).toBeInTheDocument();
  });

  it("calls onEditGroups when Edit Groups button is clicked", () => {
    const onEditGroups = vi.fn();
    const user = makeUser({ customClaims: { admin: false, enabled: true } });
    render(
      <UsersTable
        mode="admin"
        users={[user]}
        onEdit={vi.fn()}
        onEditGroups={onEditGroups}
        adminCount={2}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit user group/i }));
    expect(onEditGroups).toHaveBeenCalledWith(user);
  });

  it("calls onSelectUser when a row is clicked and onSelectUser is provided", () => {
    const onSelectUser = vi.fn();
    const user = makeUser();
    render(<UsersTable mode="admin" users={[user]} onSelectUser={onSelectUser} adminCount={2} />);
    fireEvent.click(screen.getByText("Alice Smith").closest("tr")!);
    expect(onSelectUser).toHaveBeenCalledWith(user.uid);
  });
});
