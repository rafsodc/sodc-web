import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../../../test-utils";
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
    render(<UsersTable users={[]} />);
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Membership")).toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("shows friendly membership status label for a user with a profile", () => {
    render(<UsersTable users={[makeUser({ membershipStatus: "REGULAR" as never })]} />);
    expect(screen.getByText("Regular")).toBeInTheDocument();
  });

  it("shows 'No profile' for a user without a DC profile", () => {
    render(<UsersTable users={[makeUser({ membershipStatus: null })]} />);
    expect(screen.getByText("No profile")).toBeInTheDocument();
  });

  it("shows 'No profile' when membershipStatus is undefined", () => {
    const user = makeUser();
    delete (user as Partial<SearchUser>).membershipStatus;
    render(<UsersTable users={[user]} />);
    expect(screen.getByText("No profile")).toBeInTheDocument();
  });

  it("shows Active for a non-disabled user in the Account column", () => {
    render(<UsersTable users={[makeUser({ disabled: false })]} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Disabled for a disabled user in the Account column", () => {
    render(<UsersTable users={[makeUser({ disabled: true })]} />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders 'No users found' with correct colSpan when list is empty", () => {
    render(<UsersTable users={[]} />);
    const cell = screen.getByText("No users found").closest("td");
    expect(cell).toHaveAttribute("colspan", "7");
  });

  it("passes PENDING status through the label helper", () => {
    render(<UsersTable users={[makeUser({ membershipStatus: "PENDING" as never })]} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
