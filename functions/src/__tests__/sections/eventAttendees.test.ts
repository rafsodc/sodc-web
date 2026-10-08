import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import { getEventAttendees } from "../../eventAttendees";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
const eventQuery = vi.spyOn(sdk, "getAttendeeEventSection");
const guestNamesQuery = vi.spyOn(sdk, "getPublicOrganiserGuestAttendance");
const namesQuery = vi.spyOn(sdk, "getEventAttendeeNames");
const sectionQuery = vi.spyOn(sdk, "getSectionById");
const groupsQuery = vi.spyOn(sdk, "getUserAccessGroupsById");
const membershipQuery = vi.spyOn(sdk, "getUserMembershipStatus");
const eventId = "00000000-0000-4000-8000-000000000001";
const member = { firstName: "Alex", lastName: "Smith" };
const attendance = { includesSymposium: false, includesDinner: false };
const memberAttendance = { ...member, audience: "MEMBER", ...attendance };
const line = { ticketType: { audience: "MEMBER", ...attendance }, guestUser: null, guestDisplayName: null };
const booking = { revisionGroupId: "group", revisionNumber: 1, status: "SUBMITTED", approvalStatus: "NOT_REQUIRED", supersededAt: null, booker: member, lines: [line] };
function request(token: Record<string, unknown> = { enabled: true }, data: unknown = { eventId }) {
  return { auth: { uid: "viewer", token }, data } as Parameters<typeof getEventAttendees.run>[0];
}
function names(bookings: unknown[]) {
  namesQuery.mockResolvedValue({ data: { bookings } } as Awaited<ReturnType<typeof sdk.getEventAttendeeNames>>);
}
function access(purposes = ["ACCESS"], statuses: string[] = []) {
  sectionQuery.mockResolvedValue({ data: { section: { id: "section", purposeLinks: [{ purposes, userGroup: { id: "allowed", membershipStatuses: statuses } }] } } } as never);
}

describe("minimal event attendees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guestNamesQuery.mockResolvedValue({ data: { organiserGuests: [] } });
    eventQuery.mockResolvedValue({ data: { event: { section: { id: "section" } } } });
    access();
    groupsQuery.mockResolvedValue({ data: { user: { userGroups: [{ userGroup: { id: "allowed" } }] } } } as never);
    membershipQuery.mockResolvedValue({ data: { user: { membershipStatus: "REGULAR" } } } as never);
    names([booking]);
  });

  it("includes reserved organiser guests after member booking groups with only public fields", async () => {
    guestNamesQuery.mockResolvedValue({ data: { organiserGuests: [{ firstName: "Guest", lastName: "Able", includesDinner: true, includesSymposium: false }] } });
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [memberAttendance, { firstName: "Guest", lastName: "Able", includesDinner: true, includesSymposium: false, audience: "GUEST" }] });
  });
  it("allows an enabled section viewer without a booking and returns exactly names, member/guest audience and attendance flags", async () => {
    names([{ ...booking, booker: { ...member, email: "private", dietaryNote: "private" } }]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [memberAttendance] });
    expect(eventQuery).toHaveBeenCalledWith({ eventId });
    expect(namesQuery).toHaveBeenCalledWith({ eventId, limit: 500, offset: 0 });
  });
  it.each([undefined, { enabled: false }, { enabled: false, admin: true }])("rejects unauthenticated or disabled callers (%j)", async (token) => {
    const req = token ? request(token) : { data: { eventId } } as Parameters<typeof getEventAttendees.run>[0];
    await expect(getEventAttendees.run(req)).rejects.toMatchObject({ code: token ? "permission-denied" : "unauthenticated" });
    expect(namesQuery).not.toHaveBeenCalled();
    expect(eventQuery).not.toHaveBeenCalled();
  });
  it("rejects access to another section before fetching names", async () => {
    access([]);
    await expect(getEventAttendees.run(request())).rejects.toMatchObject({ code: "not-found" });
    expect(namesQuery).not.toHaveBeenCalled();
  });
  it.each(["MODERATOR", "MEMBERSHIP", "ADMIN"])("allows %s access", async (kind) => {
    access(kind === "MODERATOR" ? ["MODERATOR"] : ["ACCESS"], kind === "MEMBERSHIP" ? ["REGULAR"] : []);
    if (kind !== "MODERATOR") groupsQuery.mockResolvedValue({ data: { user: { userGroups: [] } } } as never);
    expect(await getEventAttendees.run(request({ enabled: true, admin: kind === "ADMIN" }))).toEqual({ attendees: [memberAttendance] });
  });
  it("rejects missing events and invalid ids", async () => {
    await expect(getEventAttendees.run(request({ enabled: true }, { eventId: "bad" }))).rejects.toMatchObject({ code: "invalid-argument" });
    eventQuery.mockResolvedValue({ data: { event: undefined } });
    await expect(getEventAttendees.run(request())).rejects.toMatchObject({ code: "not-found" });
    expect(namesQuery).not.toHaveBeenCalled();
  });
  it("excludes inactive revisions while retaining the active revision during pending approval", async () => {
    names([
      booking,
      { ...booking, revisionNumber: 2, approvalStatus: "PENDING" },
      ...["DRAFT", "CANCELLED"].map((status) => ({ ...booking, revisionGroupId: status, status })),
      { ...booking, revisionGroupId: "rejected", approvalStatus: "REJECTED" },
      { ...booking, revisionGroupId: "superseded", supersededAt: "2026-01-01" },
    ]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [memberAttendance] });
  });
  it("selects the latest revision and keeps guests with their booker without collapsing namesakes", async () => {
    const anna = { firstName: "Anna", lastName: "Smith" };
    names([
      { ...booking, booker: { firstName: "Old", lastName: "Revision" } },
      { ...booking, revisionNumber: 2, status: "CONFIRMED", approvalStatus: "APPROVED", lines: [line,
        { ticketType: { audience: "GUEST", ...attendance }, guestUser: anna, guestDisplayName: "outdated" },
        { ticketType: { audience: "GUEST", ...attendance }, guestUser: null, guestDisplayName: "  Cher  " },
        { ticketType: { audience: "GUEST", ...attendance }, guestUser: null, guestDisplayName: " " },
      ] },
      { ...booking, revisionGroupId: "namesake" },
    ]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [memberAttendance, { displayName: "Cher", audience: "GUEST", ...attendance }, { ...anna, audience: "GUEST", ...attendance }, memberAttendance] });
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])("returns symposium=%s and dinner=%s for current member and guest tickets only", async (includesSymposium, includesDinner) => {
    const flags = { includesSymposium, includesDinner };
    const privateTicket = { ...flags, title: "Private ticket title", price: 99 };
    names([
      { ...booking, revisionNumber: 1, lines: [line] },
      { ...booking, revisionNumber: 2, lines: [
        { ...line, dietaryNote: "private", ticketType: { ...privateTicket, audience: "MEMBER" } },
        { ...line, guestUser: { firstName: "Guest", lastName: "Linked", email: "private" }, ticketType: { ...privateTicket, audience: "GUEST" } },
        { ...line, guestDisplayName: "Legacy Guest", ticketType: { ...privateTicket, audience: "GUEST" } },
      ] },
    ]);
    expect((await getEventAttendees.run(request())).attendees).toEqual([
      { ...member, audience: "MEMBER", ...flags }, { displayName: "Legacy Guest", audience: "GUEST", ...flags }, { firstName: "Guest", lastName: "Linked", audience: "GUEST", ...flags },
    ]);
  });
  it("orders booking members by surname then first name, keeping alphabetically earlier guests after their booker", async () => {
    const guestLine = (name: string) => ({ ...line, ticketType: { audience: "GUEST", ...attendance }, guestDisplayName: name });
    names([
      { ...booking, revisionGroupId: "z", booker: { firstName: "Alex", lastName: "Zulu" }, lines: [guestLine("Aaron"), line] },
      { ...booking, revisionGroupId: "b", booker: { firstName: "Bob", lastName: "Alpha" }, lines: [line, guestLine("Zoe")] },
      { ...booking, revisionGroupId: "a", booker: { firstName: "Amy", lastName: "alpha" }, lines: [guestLine("Wendy"), line, guestLine("Ben")] },
    ]);
    expect((await getEventAttendees.run(request())).attendees.map((person) => "displayName" in person ? person.displayName : `${person.firstName} ${person.lastName}`)).toEqual([
      "Amy alpha", "Ben", "Wendy", "Bob Alpha", "Zoe", "Alex Zulu", "Aaron",
    ]);
  });
  it("fetches every page and resolves revisions across page boundaries", async () => {
    const firstPage = Array.from({ length: 500 }, (_, i) => ({ ...booking, revisionGroupId: `group-${i}` }));
    namesQuery.mockResolvedValueOnce({ data: { bookings: firstPage } } as never)
      .mockResolvedValueOnce({ data: { bookings: [
        { ...booking, revisionGroupId: "group-0", revisionNumber: 2, booker: { firstName: "New", lastName: "Revision" } },
        { ...booking, revisionGroupId: "group-500" },
      ] } } as never);
    const result = await getEventAttendees.run(request());
    expect(result.attendees).toHaveLength(501);
    expect(result.attendees).toContainEqual({ firstName: "New", lastName: "Revision", audience: "MEMBER", ...attendance });
    expect(result.attendees.filter((name) => "firstName" in name && name.firstName === "Alex")).toHaveLength(500);
    expect(namesQuery).toHaveBeenNthCalledWith(1, { eventId, limit: 500, offset: 0 });
    expect(namesQuery).toHaveBeenNthCalledWith(2, { eventId, limit: 500, offset: 500 });
  });
  it("shows corrected attendance and removes deleted places without changing the purchased ticket", async () => {
    names([{ ...booking, lines: [
      { ...line, bookingPlace: { attendanceRemoved: true } },
      { ...line, bookingPlace: { attendanceName: "Corrected name", attendanceRemoved: false,
        attendanceTicketType: { audience: "MEMBER", includesDinner: true, includesSymposium: false } } },
    ] }]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [{ displayName: "Corrected name", audience: "MEMBER", includesDinner: true, includesSymposium: false }] });
  });
  it("returns empty attendance and handles query failures", async () => {
    names([]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [] });
    namesQuery.mockRejectedValueOnce(new Error("database private details"));
    await expect(getEventAttendees.run(request())).rejects.toMatchObject({ code: "internal" });
  });
  it("keeps the dedicated queries server-only and excludes private attendee data", () => {
    const query = readFileSync(resolve(__dirname, "../../../../dataconnect/api/attendees.gql"), "utf8");
    expect(query.match(/@auth\(level: NO_ACCESS\)/g)).toHaveLength(2);
    expect(query).toContain("status: { in: [SUBMITTED, CONFIRMED] }");
    expect(query).toContain("approvalStatus: { in: [NOT_REQUIRED, APPROVED] }");
    expect(query).toContain("supersededAt: { isNull: true }");
    expect(query).toContain("orderBy: { id: ASC }");
    expect(query).toContain("limit: $limit");
    expect(query).toContain("offset: $offset");
    expect(query).toContain("includesSymposium includesDinner");
    expect(query).not.toMatch(/dietary|email|phone|accommodation|price|payment|sitNextTo|approvalNote/i);
  });
});
