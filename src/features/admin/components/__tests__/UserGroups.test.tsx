import { describe, beforeEach, afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { deleteUserGroupRef } from "@dataconnect/generated";
import { executeMutation, executeQuery, QueryFetchPolicy } from "firebase/data-connect";
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test-utils";
import UserGroups from "../UserGroups";
import { searchUsers } from "../../../users/utils/searchUsers";
import { SEARCH_DEBOUNCE_MS } from "../../../../constants";

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
  QueryFetchPolicy: { SERVER_ONLY: "SERVER_ONLY" },
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
    listUserGroupsRef: vi.fn((dc) => ({ kind: "list-groups", name: "ListUserGroups", dataConnect: dc })),
    listUsersRef: vi.fn(() => ({ kind: "list-users" })),
    getUserGroupByIdRef: vi.fn((dc, variables) => ({ kind: "group-detail", name: "GetUserGroupById", dataConnect: dc, variables })),
    updateUserGroupRef: vi.fn((_dc: unknown, vars: unknown) => ({ kind: "update-group", vars })),
    createUserGroupRef: vi.fn(),
    deleteUserGroupRef: vi.fn((_dc: unknown, vars: unknown) => ({ kind: "delete-group", vars })),
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
    onDelete,
    onAddUser,
  }: {
    userGroups: Array<{ id: string; name: string }>;
    mergedUsersForGroup: Array<{ id: string; firstName: string; lastName: string }>;
    onExpand: (group: { id: string; name: string }) => void;
    onEdit: (group: { id: string; name: string }) => void;
    onDelete: (group: { id: string; name: string }) => void;
    onAddUser: (groupId: string) => void;
  }) => (
    <div>
      {userGroups.map((group) => (
        <div key={group.id}>
          <span>{group.name}</span>
          <button onClick={() => onExpand(group)}>Expand {group.name}</button>
          <button onClick={() => onEdit(group)}>Edit {group.name}</button>
          <button onClick={() => onDelete(group)}>Delete {group.name}</button>
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
        return Promise.resolve({ data: { userGroup: groupDetail(updated && forced ? "After" : "Before") } }) as never;
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

  it("names the group and consequences, focuses Cancel and makes no mutation when cancelled", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Delete Original Group" }));
    const dialog = screen.getByRole("dialog", { name: "Delete user group?" });
    expect(within(dialog).getByText(/Original Group/)).toHaveTextContent("This will remove all user and section associations.");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(executeMutation).not.toHaveBeenCalled();

    const confirmButton = within(dialog).getByRole("button", { name: "Delete" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Delete the user group "Original Group"?');
    fireEvent.click(confirmButton);
    expect(executeMutation).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it("deletes only the exact group selected after confirmation", async () => {
    const user = userEvent.setup();
    const executeDefaultQuery = vi.mocked(executeQuery).getMockImplementation()!;
    vi.mocked(executeQuery).mockImplementation((ref, options) => {
      if ((ref as unknown as { kind: string }).kind === "list-groups") {
        return Promise.resolve({ data: { userGroups: [
          { id: "group-1", name: "Original Group", description: null, membershipStatuses: [] },
          { id: "group-2", name: "Other Group", description: null, membershipStatuses: [] },
        ] } }) as never;
      }
      return executeDefaultQuery(ref, options);
    });
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: "Delete Other Group" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Other Group/)).toBeInTheDocument();
    expect(executeMutation).not.toHaveBeenCalled();
    const confirmButton = within(dialog).getByRole("button", { name: "Delete" });
    await act(async () => fireEvent.click(confirmButton));
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Delete the user group "Other Group"?');
    fireEvent.click(confirmButton);

    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(deleteUserGroupRef).toHaveBeenCalledWith({}, { id: "group-2" });
    expect(executeMutation).toHaveBeenCalledWith({ kind: "delete-group", vars: { id: "group-2" } });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("replaces the retained name and target when another group is selected after Cancel", async () => {
    const user = userEvent.setup();
    const executeDefaultQuery = vi.mocked(executeQuery).getMockImplementation()!;
    vi.mocked(executeQuery).mockImplementation((ref, options) => {
      if ((ref as unknown as { kind: string }).kind === "list-groups") {
        return Promise.resolve({ data: { userGroups: [
          { id: "group-1", name: "Original Group", description: null, membershipStatuses: [] },
          { id: "group-2", name: "Other Group", description: null, membershipStatuses: [] },
        ] } }) as never;
      }
      return executeDefaultQuery(ref, options);
    });
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Delete Original Group" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Delete Other Group" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent('Delete the user group "Other Group"?');
    expect(dialog).not.toHaveTextContent("Original Group");
    expect(executeMutation).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(deleteUserGroupRef).toHaveBeenCalledWith({}, { id: "group-2" });
    expect(executeMutation).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("blocks duplicate confirmations and cancellation while deletion is pending", async () => {
    const user = userEvent.setup();
    let finishDelete!: () => void;
    vi.mocked(executeMutation).mockImplementationOnce(() => new Promise((resolve) => {
      finishDelete = () => resolve({} as never);
    }));
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Delete Original Group" }));
    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Delete" });
    act(() => {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
    });

    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(executeMutation).toHaveBeenCalledTimes(1);

    await act(async () => finishDelete());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps a failed mutation in the named confirmation and permits an explicit retry", async () => {
    const user = userEvent.setup();
    vi.mocked(executeMutation).mockRejectedValueOnce(new Error("private provider details"));
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Delete Original Group" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("We could not complete the user group operation.");
    expect(within(dialog).getByText(/Original Group/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/private provider details/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(executeMutation).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(executeMutation).toHaveBeenCalledTimes(2);
    expect(deleteUserGroupRef).toHaveBeenLastCalledWith({}, { id: "group-1" });
  });

  it("clears the previous deletion error when confirmation is cancelled and reopened", async () => {
    const user = userEvent.setup();
    vi.mocked(executeMutation).mockRejectedValueOnce(new Error("failure"));
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Delete Original Group" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await within(screen.getByRole("dialog")).findByRole("alert");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Delete Original Group" }));
    expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
    expect(executeMutation).toHaveBeenCalledTimes(1);
  });

  it("closes on committed deletion before refresh settles and retries only the failed reads", async () => {
    const user = userEvent.setup();
    const executeDefaultQuery = vi.mocked(executeQuery).getMockImplementation()!;
    let rejectRefresh!: (reason: Error) => void;
    let refreshStarted = false;
    let failRefresh = true;
    vi.mocked(executeQuery).mockImplementation((ref, options) => {
      if ((ref as unknown as { kind: string }).kind === "list-groups" && updated) {
        if (failRefresh) {
          refreshStarted = true;
          return new Promise((_resolve, reject) => { rejectRefresh = reject; }) as never;
        }
        return Promise.resolve({ data: { userGroups: [] } }) as never;
      }
      return executeDefaultQuery(ref, options);
    });
    render(<MemoryRouter><UserGroups onBack={vi.fn()} /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Delete Original Group" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(refreshStarted).toBe(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(executeMutation).toHaveBeenCalledTimes(1);

    await act(async () => rejectRefresh(new Error("refresh offline")));
    expect(await screen.findByText(/The latest group data could not be loaded/)).toHaveTextContent("the change is already saved");
    failRefresh = false;
    const readCount = vi.mocked(executeQuery).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(screen.queryByText(/The latest group data could not be loaded/)).not.toBeInTheDocument());
    expect(vi.mocked(executeQuery).mock.calls.length).toBeGreaterThan(readCount);
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(deleteUserGroupRef).toHaveBeenCalledTimes(1);
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
