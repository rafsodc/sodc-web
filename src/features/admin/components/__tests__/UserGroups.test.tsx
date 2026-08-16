import { describe, beforeEach, afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { executeMutation, executeQuery, QueryFetchPolicy } from "firebase/data-connect";
import { act, fireEvent, render, screen } from "../../../../test-utils";
import UserGroups from "../UserGroups";
import { searchUsers } from "../../../users/utils/searchUsers";
import { SEARCH_DEBOUNCE_MS } from "../../../../constants";

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
  QueryFetchPolicy: { SERVER_ONLY: "server-only" },
}));
vi.mock("../../../../config/firebase", () => ({
  auth: { currentUser: { uid: "admin-1" } },
  dataConnect: {},
}));
vi.mock("../../../users/hooks/useAdminClaim", () => ({ useAdminClaim: () => true }));
vi.mock("../../../users/utils/searchUsers", () => ({ searchUsers: vi.fn() }));
vi.mock("@dataconnect/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dataconnect/generated")>();
  return {
    ...actual,
    listUserGroupsRef: vi.fn(() => ({ kind: "list-groups" })),
    listUsersRef: vi.fn(() => ({ kind: "list-users" })),
    getUserGroupByIdRef: vi.fn(() => ({ kind: "group-detail" })),
    updateUserGroupRef: vi.fn((_dc: unknown, vars: unknown) => ({ kind: "update-group", vars })),
    createUserGroupRef: vi.fn(),
    deleteUserGroupRef: vi.fn(),
    addUserToUserGroupRef: vi.fn(),
    removeUserFromUserGroupRef: vi.fn(),
    getUserWithAccessGroupsRef: vi.fn(),
  };
});
vi.mock("../UserGroupsSurfaces", () => ({
  UserGroupsListSurface: ({
    userGroups,
    mergedUsersForGroup,
    onExpand,
    onEdit,
    onAddUser,
  }: {
    userGroups: Array<{ id: string; name: string }>;
    mergedUsersForGroup: Array<{ id: string; firstName: string; lastName: string }>;
    onExpand: (group: { id: string; name: string }) => void;
    onEdit: (group: { id: string; name: string }) => void;
    onAddUser: (groupId: string) => void;
  }) => (
    <div>
      {userGroups.map((group) => (
        <div key={group.id}>
          <span>{group.name}</span>
          <button onClick={() => onExpand(group)}>Expand {group.name}</button>
          <button onClick={() => onEdit(group)}>Edit {group.name}</button>
          <button onClick={() => onAddUser(group.id)}>Add user to {group.name}</button>
        </div>
      ))}
      {mergedUsersForGroup.map((user) => <div key={user.id}>{user.firstName} {user.lastName}</div>)}
    </div>
  ),
  UserGroupDialogSurface: ({
    open,
    groupName,
    onGroupNameChange,
    onSubmit,
  }: {
    open: boolean;
    groupName: string;
    onGroupNameChange: (value: string) => void;
    onSubmit: () => void;
  }) => open ? (
    <div>
      <label>Group Name<input value={groupName} onChange={(event) => onGroupNameChange(event.target.value)} /></label>
      <button onClick={onSubmit}>Save Group</button>
    </div>
  ) : null,
  AddUserToGroupDialogSurface: ({
    open,
    userSearchTerm,
    onSearchTermChange,
  }: {
    open: boolean;
    userSearchTerm: string;
    onSearchTermChange: (value: string) => void;
  }) => open ? (
    <label>
      Search Users
      <input value={userSearchTerm} onChange={(event) => onSearchTermChange(event.target.value)} />
    </label>
  ) : null,
}));

let updated = false;

function groupDetail(firstName: string) {
  return {
    id: "group-1",
    name: updated ? "Updated Group" : "Original Group",
    description: null,
    membershipStatuses: [],
    purposeLinks: [],
    users: [{
      user: {
        id: firstName.toLowerCase(),
        firstName,
        lastName: "Member",
        email: `${firstName.toLowerCase()}@example.com`,
        membershipStatus: "REGULAR",
      },
    }],
  };
}

describe("UserGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updated = false;
    vi.mocked(executeMutation).mockImplementation(async () => {
      updated = true;
      return {} as never;
    });
    vi.mocked(executeQuery).mockImplementation((ref: unknown, options?: unknown) => {
      const kind = (ref as { kind: string }).kind;
      if (kind === "list-users") return Promise.resolve({ data: { users: [] } }) as never;
      if (kind === "list-groups") {
        return Promise.resolve({
          data: {
            userGroups: [{
              id: "group-1",
              name: updated ? "Updated Group" : "Original Group",
              description: null,
              membershipStatuses: [],
            }],
          },
        }) as never;
      }
      if (kind === "group-detail") {
        const forced = (options as { fetchPolicy?: string } | undefined)?.fetchPolicy === QueryFetchPolicy.SERVER_ONLY;
        return Promise.resolve({ data: { userGroup: groupDetail(forced ? "After" : "Before") } }) as never;
      }
      return Promise.resolve({ data: null }) as never;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces cached group details with server data after editing", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserGroups onBack={vi.fn()} />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole("button", { name: "Expand Original Group" }));
    expect(await screen.findByText("Before Member")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Original Group" }));
    await user.clear(screen.getByLabelText("Group Name"));
    await user.type(screen.getByLabelText("Group Name"), "Updated Group");
    await user.click(screen.getByRole("button", { name: "Save Group" }));

    expect(await screen.findByText("Updated Group")).toBeInTheDocument();
    expect(await screen.findByText("After Member")).toBeInTheDocument();
    expect(screen.queryByText("Before Member")).not.toBeInTheDocument();
  });

  it("debounces add-user searches and requires two characters", async () => {
    vi.mocked(searchUsers).mockResolvedValue({
      success: true,
      data: { users: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
    });
    const initialUser = userEvent.setup();
    render(
      <MemoryRouter>
        <UserGroups onBack={vi.fn()} />
      </MemoryRouter>
    );

    await initialUser.click(await screen.findByRole("button", { name: "Add user to Original Group" }));
    vi.useFakeTimers();
    const searchInput = screen.getByLabelText("Search Users");
    fireEvent.change(searchInput, { target: { value: "a" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    expect(searchUsers).not.toHaveBeenCalled();

    fireEvent.change(searchInput, { target: { value: "ab" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(searchUsers).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(searchUsers).toHaveBeenCalledTimes(1);
    expect(searchUsers).toHaveBeenCalledWith("ab", 1, 10);
  });
});
