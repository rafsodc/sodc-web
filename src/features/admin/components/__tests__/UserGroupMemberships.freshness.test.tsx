import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "../../../../test-utils";
import userEvent from "@testing-library/user-event";
const fixture = vi.hoisted(() => ({ joined: false, invalidate: vi.fn(), write: vi.fn(), read: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ dataConnect: {} }));
vi.mock("../../../../shared/query/invalidation", () => ({ invalidateUserSectionAccess: fixture.invalidate }));
vi.mock("@dataconnect/generated", async (importOriginal) => ({
  ...await importOriginal<typeof import("@dataconnect/generated")>(),
  getUserWithAccessGroupsRef: vi.fn((_dc, variables) => ({ name: "member", variables })),
  listUserGroupsRef: vi.fn(() => ({ name: "groups" })),
  addUserToUserGroupRef: vi.fn((_dc, variables) => ({ name: "add", variables })),
  removeUserFromUserGroupRef: vi.fn((_dc, variables) => ({ name: "remove", variables })),
}));
vi.mock("../../../../shared/query/dataConnectExecution", () => ({
  executeDataConnectQuery: fixture.read,
  executeDataConnectMutation: fixture.write,
}));
import UserGroupMemberships from "../UserGroupMemberships";
const group = { id: "group-1", name: "Flying", subscribable: true, membershipStatuses: [] };
const member = (id = "member", groups = fixture.joined ? [group] : []) => ({ data: { user: {
  id, membershipStatus: "REGULAR", userGroups: groups.map(userGroup => ({userGroup})),
} } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise, resolve};
}
beforeEach(() => {
  fixture.joined = false; fixture.invalidate.mockReset().mockResolvedValue(undefined);
  fixture.write.mockReset().mockImplementation(async () => { fixture.joined = true; return { data: {} }; });
  fixture.read.mockReset().mockImplementation(async (ref: {name: string; variables?: {id: string}}) =>
    ref.name === "groups" ? { data: { userGroups: [group] } } : member(ref.variables?.id));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
async function addMembership() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Add to Group" }));
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: /Flying/ }));
  return user;
}
describe("membership post-write refresh", () => {
  it("keeps the saved membership and retries related reads without writing again", async () => {
    fixture.invalidate.mockRejectedValueOnce(new Error("Synthetic read failure"));
    render(<UserGroupMemberships userId="member" />);
    const user = await addMembership();
    expect(await screen.findByText(/Membership saved, but/)).toBeInTheDocument();
    expect(screen.getByText("Flying")).toBeInTheDocument();
    expect(await screen.findByRole("button", {name: "Add to Group"})).toBeDisabled();
    await user.click(await screen.findByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(fixture.invalidate).toHaveBeenCalledTimes(2));
    expect(fixture.write).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Membership saved, but/)).not.toBeInTheDocument();
  });
  it("reports a failed post-write membership read as saved and leaves repeated retry read-only", async () => {
    render(<UserGroupMemberships userId="member" />);
    await screen.findByRole("button", {name: "Add to Group"});
    fixture.read.mockImplementation(async (ref: {name: string}) => {
      if (ref.name === "groups") return {data: {userGroups: [group]}};
      throw new Error("Synthetic read failure");
    });
    const user = await addMembership();
    expect(await screen.findByText(/Membership saved, but/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", {name: "Retry refresh"}));
    expect(await screen.findByText(/Membership saved, but/)).toBeInTheDocument();
    expect(fixture.write).toHaveBeenCalledOnce();
    fixture.read.mockResolvedValue(member());
    await user.click(await screen.findByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Membership saved, but/)).not.toBeInTheDocument());
    expect(screen.getByText("Flying")).toBeInTheDocument();
    expect(fixture.write).toHaveBeenCalledOnce();
  });
  it("keeps a failed initial load separate from a saved change and offers only a read retry", async () => {
    fixture.read.mockRejectedValueOnce(new Error("Synthetic initial load failure"));
    const user = userEvent.setup(); render(<UserGroupMemberships userId="member" />);
    await user.click(await screen.findByRole("button", {name: "Retry loading"}));
    expect(await screen.findByRole("button", {name: "Add to Group"})).toBeEnabled();
    expect(screen.queryByText(/Membership saved/)).not.toBeInTheDocument();
    expect(fixture.write).not.toHaveBeenCalled();
    expect(fixture.invalidate).not.toHaveBeenCalled();
  });
  it("retains the add dialog and reports a rejected write without claiming the change was saved", async () => {
    fixture.write.mockRejectedValueOnce(new Error("Synthetic write failure"));
    render(<UserGroupMemberships userId="member" />);
    await addMembership();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn’t|could not|try again/i);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
    expect(screen.queryByText(/Membership saved/)).not.toBeInTheDocument();
    expect(fixture.invalidate).not.toHaveBeenCalled();
    expect(fixture.write).toHaveBeenCalledOnce();
  });
  it("retains a confirmed removal when revalidation fails and never repeats it on retry", async () => {
    fixture.joined = true;
    fixture.write.mockImplementation(async () => {fixture.joined = false; return {data: {}};});
    fixture.invalidate.mockRejectedValueOnce(new Error("Synthetic read failure"));
    const user = userEvent.setup(); render(<UserGroupMemberships userId="member" />);
    await user.click(await screen.findByRole("button", {name: "Remove from Flying"}));
    expect(await screen.findByText(/Membership saved, but/)).toBeInTheDocument();
    expect(screen.queryByText("Flying")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Membership saved/)).not.toBeInTheDocument());
    expect(fixture.write).toHaveBeenCalledOnce();
    expect(fixture.write).toHaveBeenCalledWith({name: "remove", variables: {userId: "member", userGroupId: "group-1"}});
  });
  it("treats a parent-view refresh failure as saved and retries that read without repeating the mutation", async () => {
    const onUpdate = vi.fn().mockRejectedValueOnce(new Error("Synthetic parent read failure")).mockResolvedValue(undefined);
    render(<UserGroupMemberships userId="member" onUpdate={onUpdate} />);
    const user = await addMembership();
    expect(await screen.findByText(/Membership saved, but/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", {name: "Retry refresh"}));
    await waitFor(() => expect(screen.queryByText(/Membership saved, but/)).not.toBeInTheDocument());
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(fixture.write).toHaveBeenCalledOnce();
  });
  it("discards an earlier user's delayed groups after selecting another user", async () => {
    const first = deferred<ReturnType<typeof member>>();
    fixture.read.mockImplementation(async (ref: {name: string; variables?: {id: string}}) => {
      if (ref.name === "groups") return {data: {userGroups: [group]}};
      return ref.variables?.id === "a" ? first.promise : member("b", [{...group, id: "b-group", name: "B only"}]);
    });
    const view = render(<UserGroupMemberships userId="a" />);
    await waitFor(() => expect(fixture.read).toHaveBeenCalledWith({name: "member", variables: {id: "a"}}));
    view.rerender(<UserGroupMemberships userId="b" />);
    expect(await screen.findByText("B only")).toBeInTheDocument();
    await act(async () => { first.resolve(member("a", [{...group, name: "A only"}])); });
    await waitFor(() => expect(screen.getByText("B only")).toBeInTheDocument());
    expect(screen.queryByText("A only")).not.toBeInTheDocument();
  });
  it("does not restart the old user's reads or show its notice after a pending write and selection change", async () => {
    const write = deferred<{data: object}>(); fixture.write.mockReturnValue(write.promise);
    const view = render(<UserGroupMemberships userId="a" />);
    await addMembership();
    view.rerender(<UserGroupMemberships userId="b" />);
    await screen.findByRole("button", {name: "Add to Group"});
    fixture.invalidate.mockRejectedValueOnce(new Error("Synthetic old refresh failure"));
    write.resolve({data: {}});
    await waitFor(() => expect(fixture.invalidate).toHaveBeenCalledOnce());
    expect(screen.queryByText(/Membership saved/)).not.toBeInTheDocument();
    expect(fixture.read.mock.calls.filter(([ref]) => ref.name === "member" && ref.variables.id === "a")).toHaveLength(1);
    expect(screen.getByRole("button", {name: "Add to Group"})).toBeEnabled();
  });
});
