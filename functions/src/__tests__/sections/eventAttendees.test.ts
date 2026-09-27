import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@dataconnect/admin-generated";
import { getEventAttendees } from "../../eventAttendees";
import { readFileSync } from "node:fs";

vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
const eventQuery = vi.spyOn(sdk, "getAttendeeEventSection");
const namesQuery = vi.spyOn(sdk, "getEventAttendeeNames");
const sectionQuery = vi.spyOn(sdk, "getSectionById");
const groupsQuery = vi.spyOn(sdk, "getUserAccessGroupsById");
const membershipQuery = vi.spyOn(sdk, "getUserMembershipStatus");
const eventId = "00000000-0000-4000-8000-000000000001";
const member = { firstName: "Alex", lastName: "Smith" };
const line = { ticketType: { audience: "MEMBER" }, guestUser: null, guestDisplayName: null };
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

describe("names-only event attendees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventQuery.mockResolvedValue({ data: { event: { section: { id: "section" } } } });
    access();
    groupsQuery.mockResolvedValue({ data: { user: { userGroups: [{ userGroup: { id: "allowed" } }] } } } as never);
    membershipQuery.mockResolvedValue({ data: { user: { membershipStatus: "REGULAR" } } } as never);
    names([booking]);
  });

  it("allows an enabled section viewer without a booking and returns exactly name fields", async () => {
    names([{ ...booking, booker: { ...member, email: "private", dietaryNote: "private" } }]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [member] });
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
    expect(await getEventAttendees.run(request({ enabled: true, admin: kind === "ADMIN" }))).toEqual({ attendees: [member] });
  });
  it("rejects missing events and invalid ids", async () => {
    await expect(getEventAttendees.run(request({ enabled: true }, { eventId: "bad" }))).rejects.toMatchObject({ code: "invalid-argument" });
    eventQuery.mockResolvedValue({ data: { event: null } });
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
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [member] });
  });
  it("selects the latest active revision and sorts structured names without collapsing namesakes", async () => {
    const anna = { firstName: "Anna", lastName: "Smith" };
    names([
      { ...booking, booker: { firstName: "Old", lastName: "Revision" } },
      { ...booking, revisionNumber: 2, status: "CONFIRMED", approvalStatus: "APPROVED", lines: [line,
        { ticketType: { audience: "GUEST" }, guestUser: anna, guestDisplayName: "outdated" },
        { ticketType: { audience: "GUEST" }, guestUser: null, guestDisplayName: "  Cher  " },
        { ticketType: { audience: "GUEST" }, guestUser: null, guestDisplayName: " " },
      ] },
      { ...booking, revisionGroupId: "namesake" },
    ]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [{ displayName: "Cher" }, member, member, anna] });
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
    expect(result.attendees).toContainEqual({ firstName: "New", lastName: "Revision" });
    expect(result.attendees.filter((name) => "firstName" in name && name.firstName === "Alex")).toHaveLength(500);
    expect(namesQuery).toHaveBeenNthCalledWith(1, { eventId, limit: 500, offset: 0 });
    expect(namesQuery).toHaveBeenNthCalledWith(2, { eventId, limit: 500, offset: 500 });
  });
  it("returns empty attendance and handles query failures", async () => {
    names([]);
    expect(await getEventAttendees.run(request())).toEqual({ attendees: [] });
    namesQuery.mockRejectedValueOnce(new Error("database private details"));
    await expect(getEventAttendees.run(request())).rejects.toMatchObject({ code: "internal" });
  });
  it("keeps the dedicated queries server-only and excludes private attendee data", () => {
    const query = readFileSync(new URL("../../../../dataconnect/api/attendees.gql", import.meta.url), "utf8");
    expect(query.match(/@auth\(level: NO_ACCESS\)/g)).toHaveLength(2);
    expect(query).toContain("status: { in: [SUBMITTED, CONFIRMED] }");
    expect(query).toContain("approvalStatus: { in: [NOT_REQUIRED, APPROVED] }");
    expect(query).toContain("supersededAt: { isNull: true }");
    expect(query).toContain("orderBy: { id: ASC }");
    expect(query).toContain("limit: $limit");
    expect(query).toContain("offset: $offset");
    expect(query).not.toMatch(/dietary|email|phone|accommodation|price|payment|sitNextTo|approvalNote/i);
  });
});
