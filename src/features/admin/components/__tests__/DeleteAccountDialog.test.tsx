import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({call: vi.fn()}));
vi.mock("../../../../config/firebase", () => ({functions: {}}));
vi.mock("../../../../shared/utils/sessionCallable", () => ({httpsCallable: () => mocks.call}));
import DeleteAccountDialog from "../DeleteAccountDialog";
import type { SearchUser } from "../../../../types";
const user = {uid: "target", email: "target@example.invalid"} as SearchUser;
beforeEach(() => vi.resetAllMocks());
it("requires a preview, matching email and retention confirmation", async () => {
  mocks.call.mockResolvedValueOnce({data: {eligible: true, blockers: [], needsOperator: false}}).mockResolvedValueOnce({data: {deleted: true}});
  const onDeleted = vi.fn();
  render(<DeleteAccountDialog user={user} onClose={vi.fn()} onDeleted={onDeleted} />);
  expect(mocks.call).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Check account"}));
  const confirm = await screen.findByRole("button", {name: "Permanently delete account"});
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Type the account email to confirm"), {target: {value: user.email}});
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(confirm);
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  expect(mocks.call.mock.calls[1][0]).toMatchObject({uid: user.uid, email: user.email, apply: true, noRetention: true});
  expect(mocks.call.mock.calls[1][0].operationId).toBe(mocks.call.mock.calls[0][0].operationId);
});
it("blocks linked accounts without offering deletion", async () => {
  mocks.call.mockResolvedValue({data: {eligible: false, blockers: ["Booking"], needsOperator: false}});
  render(<DeleteAccountDialog user={user} onClose={vi.fn()} onDeleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", {name: "Check account"}));
  expect(await screen.findByText(/linked records or security information/)).toBeInTheDocument();
  expect(screen.queryByRole("button", {name: "Permanently delete account"})).not.toBeInTheDocument();
});
it("shows communication scope and permits an interrupted deletion to resume with the same operation", async () => {
  mocks.call.mockResolvedValueOnce({data: {eligible: true, communicationRecords: 5, sharedAnnouncements: 2}})
    .mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce({data: {deleted: true}});
  const onDeleted = vi.fn();
  render(<DeleteAccountDialog user={user} onClose={vi.fn()} onDeleted={onDeleted} />);
  fireEvent.click(screen.getByRole("button", {name: "Check account"}));
  expect(await screen.findByText(/entries in 2 shared announcements/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Type the account email to confirm"), {target: {value: user.email}});
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", {name: "Permanently delete account"}));
  expect(await screen.findByText(/Retry to finish/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name: "Permanently delete account"}));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  expect(mocks.call.mock.calls[2][0].operationId).toBe(mocks.call.mock.calls[1][0].operationId);
});
