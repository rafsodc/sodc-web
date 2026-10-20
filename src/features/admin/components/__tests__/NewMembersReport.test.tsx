import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../../../test-utils";
import NewMembersReport from "../NewMembersReport";
import { getNewMemberReportOptions, getNewMembersReport, type NewMemberReport } from "../../../../shared/utils/firebaseFunctions/newMembers";

vi.mock("../../../../shared/utils/firebaseFunctions/newMembers", () => ({ getNewMemberReportOptions: vi.fn(), getNewMembersReport: vi.fn() }));
vi.mock("../../../../config/firebase", () => ({ auth: { currentUser: { uid: "admin" } } }));
const options = vi.mocked(getNewMemberReportOptions);
const report = vi.mocked(getNewMembersReport);
const data: NewMemberReport = { since: "2026-08-06T15:56:12.334Z", through: "2026-10-20T12:00:00.000Z", baselineLabel: "Site migration",
  members: [{ id: "1", firstName: "Ada", lastName: "Lovelace", rank: null, email: "ada@example.com", membershipStatus: "REGULAR", joinedAt: "2026-09-01T12:00:00.000Z" }] };
const eventId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); options.mockReset(); report.mockReset();
  options.mockResolvedValue({ migrationAt: data.since, events: [{ id: eventId, title: "Last Dinner", endsAt: "2026-09-10T22:00:00.000Z", sectionName: "Events" }] });
  report.mockResolvedValue(data);
});
afterEach(() => vi.restoreAllMocks());
function select(label: string, name: string | RegExp) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("option", { name }));
}
describe("new members admin report", () => {
  it("defaults to current members since migration and explains registration dates", async () => {
    render(<NewMembersReport />);
    expect(screen.getByLabelText("Loading report options")).toBeInTheDocument();
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
    expect(report).toHaveBeenCalledWith({ kind: "migration" }, "current");
    expect(screen.getByText(/06\/08\/2026 to 20\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Accounts imported or linked from the old site are excluded/)).toBeInTheDocument();
    expect(screen.getByText("01/09/2026")).toBeInTheDocument();
  });
  it("uses the selected event or UK calendar date and supports all registrations", async () => {
    render(<NewMembersReport />);
    await screen.findByText("ada@example.com");
    select("Joined since", "An event");
    select("Previous event", /Last Dinner/);
    await waitFor(() => expect(report).toHaveBeenCalledWith({ kind: "event", eventId }, "current"));
    select("Membership", "All registrations");
    await waitFor(() => expect(report).toHaveBeenCalledWith({ kind: "event", eventId }, "all"));
    select("Joined since", "A date");
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-08-06" } });
    await waitFor(() => expect(report).toHaveBeenCalledWith({ kind: "date", since: "2026-08-05T23:00:00.000Z" }, "all"));
  });
  it("exports every matching registration across pages and respects search", async () => {
    report.mockResolvedValue({ ...data, members: Array.from({ length: 26 }, (_, i) => ({ ...data.members[0], id: String(i), firstName: `Member ${i}`, email: `member${i}@example.com` })) });
    const create = vi.fn<(blob: Blob) => string>(() => "blob:report");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<NewMembersReport />);
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV (26)" }));
    expect(screen.queryByText("member25@example.com")).not.toBeInTheDocument();
    const csv = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(create.mock.calls[0][0]); });
    expect(csv).toContain("member25@example.com");
    expect(csv.split("\r\n")).toHaveLength(27);
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:report");
    fireEvent.change(screen.getByLabelText("Find a member"), { target: { value: "member25@" } });
    expect(screen.getByRole("button", { name: "Export CSV (1)" })).toBeEnabled();
    expect(screen.getByText("member25@example.com")).toBeInTheDocument();
  });
  it("handles empty results and report failures without exporting stale data", async () => {
    render(<NewMembersReport />);
    await screen.findByText("ada@example.com");
    report.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh report" }));
    expect(await screen.findByText(/We could not load new members/)).toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV (0)" })).toBeDisabled();
    report.mockResolvedValueOnce({ ...data, members: [] });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/No new members match/)).toBeInTheDocument();
  });
  it("allows an explicit date when no migration was recorded", async () => {
    options.mockResolvedValue({ migrationAt: null, events: [] });
    render(<NewMembersReport />);
    expect(await screen.findByText(/No migration date is recorded/)).toBeInTheDocument();
    expect(report).not.toHaveBeenCalled();
    select("Joined since", "A date");
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-01-01" } });
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
  });
  it("retries failed options without running an unbounded report", async () => {
    options.mockRejectedValueOnce(new Error("offline"));
    render(<NewMembersReport />);
    expect(await screen.findByText(/We could not load the report options/)).toBeInTheDocument();
    expect(report).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
  });
});
