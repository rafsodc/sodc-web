import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@dataconnect/admin-generated";
import { getNewMemberReportOptions, getNewMembersReport } from "../../newMembersReport";
import { readFileSync } from "node:fs";

vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
const migration = vi.spyOn(db, "getNewMemberReportMigration");
const profiles = vi.spyOn(db, "listNewMemberReportProfiles");
const events = vi.spyOn(db, "listNewMemberReportEvents");
const event = vi.spyOn(db, "getEventByIdForCallable");
const eventId = "11111111-1111-4111-8111-111111111111";
const since = "2026-08-06T15:56:12.334Z";
const through = "2026-10-20T12:00:00.000Z";
const profile = (id = "new-member") => ({ id, firstName: "New", lastName: "Member", email: "member@example.com", rank: null,
  membershipStatus: db.MembershipStatus.REGULAR, createdAt: "2026-09-01T00:00:00.000Z", createdBy: id,
  legacyPasswordMigrated: null, legacyIdentity: null });
const pastEvent = { id: eventId, title: "Annual Dinner", endDateTime: "2026-09-10T23:00:00.000Z", section: { name: "Events" } };
function request(data: unknown = { selection: { kind: "migration" } }, token = { admin: true, enabled: true, securityVersion: 1 }) {
  return { auth: { uid: "admin", token }, data } as Parameters<typeof getNewMembersReport.run>[0];
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(through)); vi.clearAllMocks();
  migration.mockResolvedValue({ data: { legacyUserIdentities: [{ importedAt: since }] } });
  profiles.mockResolvedValue({ data: { users: [profile()] } });
  events.mockResolvedValue({ data: { events: [pastEvent] } });
  event.mockResolvedValue({ data: { event: pastEvent } } as never);
});
afterEach(() => vi.useRealTimers());

describe("new members report", () => {
  it.each([getNewMembersReport, getNewMemberReportOptions])("requires an enabled administrator before reading any report data", async (callable) => {
    for (const auth of [undefined, { uid: "member", token: { enabled: true, securityVersion: 1 } }, { uid: "admin", token: { securityVersion: 1,  admin: true, enabled: false } }]) {
      await expect(callable.run({ ...request(), auth } as never)).rejects.toBeDefined();
    }
    expect(migration).not.toHaveBeenCalled(); expect(profiles).not.toHaveBeenCalled(); expect(events).not.toHaveBeenCalled();
  });
  it("defaults to current members since migration and returns only report fields", async () => {
    const result = await getNewMembersReport.run(request());
    expect(profiles).toHaveBeenCalledWith({ since, through, limit: 500, offset: 0 });
    expect(result).toEqual({ since, through, baselineLabel: "Site migration", members: [{
      id: "new-member", firstName: "New", lastName: "Member", email: "member@example.com", rank: null, membershipStatus: "REGULAR", joinedAt: "2026-09-01T00:00:00.000Z",
    }] });
  });
  it("excludes linked legacy profiles, both password-import outcomes and migration-created accounts", async () => {
    profiles.mockResolvedValue({ data: { users: [profile(),
      { ...profile("linked"), legacyIdentity: { sourceSystem: "old-site" } },
      { ...profile("password"), legacyPasswordMigrated: true },
      { ...profile("reset-required"), legacyPasswordMigrated: false },
      { ...profile("migration"), createdBy: "legacy-migration" },
    ] } });
    const result = await getNewMembersReport.run(request({ selection: { kind: "migration" }, membership: "all" }));
    expect(result.members.map((member) => member.id)).toEqual(["new-member"]);
  });
  it("includes retired members by default and makes pending and former registrations optional", async () => {
    profiles.mockResolvedValue({ data: { users: Object.values(db.MembershipStatus).map((membershipStatus) => ({ ...profile(membershipStatus), membershipStatus })) } });
    expect((await getNewMembersReport.run(request())).members.map((row) => row.membershipStatus).sort()).toEqual(["CIVIL_SERVICE", "INDUSTRY", "REGULAR", "RESERVE", "RETIRED"]);
    expect((await getNewMembersReport.run(request({ selection: { kind: "migration" }, membership: "all" }))).members).toHaveLength(Object.values(db.MembershipStatus).length);
  });
  it("uses the selected event's persisted end time instead of a supplied timestamp", async () => {
    const result = await getNewMembersReport.run(request({ selection: { kind: "event", eventId, since: "2020-01-01" } }));
    expect(result).toMatchObject({ since: pastEvent.endDateTime, baselineLabel: pastEvent.title });
    expect(profiles).toHaveBeenCalledWith(expect.objectContaining({ since: pastEvent.endDateTime }));
  });
  it("supports an explicit start date and sorts newest registrations first", async () => {
    profiles.mockResolvedValue({ data: { users: [profile("older"), { ...profile("newer"), createdAt: "2026-10-01T00:00:00.000Z" }] } });
    const result = await getNewMembersReport.run(request({ selection: { kind: "date", since } }));
    expect(result.members.map((row) => row.id)).toEqual(["newer", "older"]);
    expect(migration).not.toHaveBeenCalled();
  });
  it("pages all matching profiles and completed events rather than truncating at the default limit", async () => {
    const all = Array.from({ length: 501 }, (_, i) => profile(String(i)));
    profiles.mockImplementation(async ({ offset }) => ({ data: { users: all.slice(offset, offset + 500) } }));
    const allEvents = Array.from({ length: 501 }, (_, i) => ({ ...pastEvent, id: String(i) }));
    events.mockImplementation(async ({ offset }) => ({ data: { events: allEvents.slice(offset, offset + 500) } }));
    expect((await getNewMembersReport.run(request())).members).toHaveLength(501);
    const options = await getNewMemberReportOptions.run(request());
    expect(options.events).toHaveLength(501);
    expect(options.migrationAt).toBe(since);
    expect(events).toHaveBeenLastCalledWith({ through, limit: 500, offset: 500 });
    expect(profiles).toHaveBeenLastCalledWith({ since, through, limit: 500, offset: 500 });
  });
  it("does not invent a migration date when no migration is recorded", async () => {
    migration.mockResolvedValue({ data: { legacyUserIdentities: [] } });
    expect((await getNewMemberReportOptions.run(request())).migrationAt).toBeNull();
    await expect(getNewMembersReport.run(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(profiles).not.toHaveBeenCalled();
  });
  it.each([
    {}, { selection: { kind: "invalid" } }, { selection: { kind: "date", since: "2026-02-30T00:00:00.000Z" } },
    { selection: { kind: "date", since: "2027-01-01T00:00:00.000Z" } }, { selection: { kind: "event", eventId: "bad" } },
    { selection: { kind: "migration" }, membership: "unknown" },
  ])("rejects invalid report inputs %j", async (data) => {
    await expect(getNewMembersReport.run(request(data))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(profiles).not.toHaveBeenCalled();
  });
  it("rejects missing and unfinished events", async () => {
    event.mockResolvedValueOnce({ data: {} } as never);
    await expect(getNewMembersReport.run(request({ selection: { kind: "event", eventId } }))).rejects.toMatchObject({ code: "not-found" });
    event.mockResolvedValueOnce({ data: { event: { ...pastEvent, endDateTime: "2027-01-01T00:00:00Z" } } } as never);
    await expect(getNewMembersReport.run(request({ selection: { kind: "event", eventId } }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(profiles).not.toHaveBeenCalled();
  });
  it("fails the report rather than returning a partial list when a later page fails", async () => {
    profiles.mockResolvedValueOnce({ data: { users: Array.from({ length: 500 }, (_, i) => profile(String(i))) } }).mockRejectedValueOnce(new Error("read failed"));
    await expect(getNewMembersReport.run(request())).rejects.toMatchObject({ code: "internal" });
  });
  it("keeps report queries server-only with date bounds and stable pagination", () => {
    const query = readFileSync("../dataconnect/api/new-members-report.gql", "utf8");
    expect(query.match(/@auth\(level: NO_ACCESS\)/g)).toHaveLength(3);
    expect(query).toContain("createdAt: { ge: $since, le: $through }");
    expect(query).toContain("orderBy: [{ createdAt: ASC }, { id: ASC }]");
    expect(query).toContain("limit: $limit, offset: $offset");
    expect(query).toContain("legacyUserIdentity_on_user");
    expect(query).not.toMatch(/mutation /);
  });
});
