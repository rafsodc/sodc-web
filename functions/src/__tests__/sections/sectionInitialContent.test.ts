import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { MembershipStatus, SectionType, TicketAudience } from "@dataconnect/admin-generated";
import { getUserSecurityState } from "../../securityRepository";
import { getSectionForUser, getSectionEventsForUser, getEventForUser, getSectionMembersMerged } from "../../sections";

const { getUsers } = vi.hoisted(() => ({ getUsers: vi.fn() }));
vi.mock("firebase-admin", () => ({ auth: () => ({ getUsers }) }));
const sectionQuery = vi.spyOn(admin, "serviceGetSectionById");
const groupsQuery = vi.spyOn(admin, "serviceGetUserAccessGroupsById");
const statusQuery = vi.spyOn(admin, "getUserMembershipStatus");
const eventsQuery = vi.spyOn(admin, "serviceGetEventsForSection");
const eventQuery = vi.spyOn(admin, "serviceGetEventById");
const membersQuery = vi.spyOn(admin, "getSectionMembers");
const usersQuery = vi.spyOn(admin, "serviceListUsers");
const ensureBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const consumeBucket = vi.spyOn(admin, "consumeCallableRateLimit");
const authorityQuery = vi.mocked(getUserSecurityState);

const sectionId = "aaaaaaaa-1111-4111-8111-111111111111";
const otherSectionId = "bbbbbbbb-2222-4222-8222-222222222222";
const eventId = "cccccccc-3333-4333-8333-333333333333";
const groupId = "dddddddd-4444-4444-8444-444444444444";
const callerUid = "opaque-auth-UID";

const section = (type: SectionType = SectionType.EVENTS) => ({
  id: sectionId, name: "Current section", type, description: "Description",
  isOpenForRegistration: false, allowedUserGroups: null,
  purposeLinks: [{ purposes: ["ACCESS"], userGroup: { id: groupId, name: "Access", subscribable: false, membershipStatuses: null } }],
});
const profile = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, firstName: "Synthetic", lastName: id, email: `${id}@example.invalid`, mobileNumber: "+447700900123",
  membershipStatus: MembershipStatus.REGULAR, rank: null, shareContactInfo: true,
  profileReviewedAt: new Date().toISOString(), ...overrides,
});
const memberResult = (users = [profile("visible")], statuses: MembershipStatus[] = []) => ({ data: { section: {
  ...section(SectionType.MEMBERS), purposeLinks: [{ purposes: ["MEMBER"], userGroup: {
    id: groupId, name: "Members", membershipStatuses: statuses, users: users.map(user => ({ user })),
  } }],
} } });
const event = (parentId = sectionId) => ({
  id: eventId, title: "Current event", section: { id: parentId }, ticketTypes: [
    { id: "member-ticket", audience: TicketAudience.MEMBER },
    { id: "organiser-ticket", audience: TicketAudience.ORGANISER_GUEST },
  ],
});
function call(data: Record<string, unknown> = {}, isAdmin = false, token: Record<string, unknown> = {}) {
  return getSectionForUser.run({
    auth: { uid: callerUid, token: { enabled: true, securityVersion: 1, admin: isAdmin, ...token } },
    data: { sectionId, ...data },
  } as never);
}
function noContentQueries() {
  expect(membersQuery).not.toHaveBeenCalled();
  expect(eventsQuery).not.toHaveBeenCalled();
  expect(eventQuery).not.toHaveBeenCalled();
  expect(usersQuery).not.toHaveBeenCalled();
  expect(getUsers).not.toHaveBeenCalled();
  expect(ensureBucket).not.toHaveBeenCalled();
  expect(consumeBucket).not.toHaveBeenCalled();
}
function expectOneAccessDecision() {
  expect(authorityQuery).toHaveBeenCalledExactlyOnceWith({ userId: callerUid });
  expect(sectionQuery).toHaveBeenCalledExactlyOnceWith({ id: sectionId });
  expect(groupsQuery).toHaveBeenCalledExactlyOnceWith({ userId: callerUid });
  expect(statusQuery).toHaveBeenCalledExactlyOnceWith({ id: callerUid });
}
beforeEach(() => {
  vi.clearAllMocks();
  sectionQuery.mockReset().mockResolvedValue({ data: { section: section() } } as never);
  groupsQuery.mockReset().mockResolvedValue({ data: { user: { userGroups: [{ userGroup: { id: groupId } }] } } } as never);
  statusQuery.mockReset().mockResolvedValue({ data: { user: { membershipStatus: MembershipStatus.REGULAR } } } as never);
  eventsQuery.mockReset().mockResolvedValue({ data: { section: { id: sectionId, events: [{ id: eventId, title: "Listed event" }] } } } as never);
  eventQuery.mockReset().mockResolvedValue({ data: { event: event() } } as never);
  membersQuery.mockReset().mockResolvedValue(memberResult() as never);
  usersQuery.mockReset().mockResolvedValue({ data: { users: [] } } as never);
  ensureBucket.mockReset().mockResolvedValue({ data: {} } as never);
  consumeBucket.mockReset().mockResolvedValue({ data: {} } as never);
  getUsers.mockReset().mockImplementation(async (ids: { uid: string }[]) => ({ users: ids.map(({ uid }) => ({ uid, emailVerified: true })) }));
});

describe("optional section initial content", () => {
  it("preserves the exact metadata-only response and performs no content work", async () => {
    expect(await call()).toEqual({ section: section(), hasAccess: true, canModerate: false });
    expectOneAccessDecision();
    noContentQueries();
  });

  it("loads only an EVENTS list with one account/section access decision", async () => {
    const result = await call({ content: "SECTION" });
    expect(result.content).toEqual({ kind: "EVENTS", status: "ready", events: [{ id: eventId, title: "Listed event" }] });
    expectOneAccessDecision();
    expect(eventsQuery).toHaveBeenCalledExactlyOnceWith({ sectionId });
    expect(membersQuery).not.toHaveBeenCalled();
    expect(eventQuery).not.toHaveBeenCalled();
    expect(getUsers).not.toHaveBeenCalled();
    expect(ensureBucket).not.toHaveBeenCalled();
  });

  it.each(["SECTION", "EVENT"])("withholds all content for denied %s requests", async content => {
    groupsQuery.mockResolvedValue({ data: { user: { userGroups: [] } } } as never);
    expect(await call({ content, ...(content === "EVENT" ? { eventId } : {}) })).toEqual({ section: null, hasAccess: false, canModerate: false });
    expectOneAccessDecision();
    noContentQueries();
  });

  it("permits the current admin override without adding roster or event detail work", async () => {
    groupsQuery.mockResolvedValue({ data: { user: { userGroups: [] } } } as never);
    const result = await call({ content: "SECTION" }, true);
    expect(result).toMatchObject({ hasAccess: true, canModerate: true, content: { kind: "EVENTS", status: "ready" } });
    expectOneAccessDecision();
    expect(membersQuery).not.toHaveBeenCalled();
    expect(eventQuery).not.toHaveBeenCalled();
  });

  it.each(["disabled", "stale"])("does not load section or content for a %s session", async reason => {
    await expect(call({ content: "SECTION" }, true, reason === "disabled" ? { enabled: false } : { securityVersion: 0 })).rejects.toMatchObject({ code: reason === "disabled" ? "permission-denied" : "unauthenticated" });
    expect(sectionQuery).not.toHaveBeenCalled();
    noContentQueries();
  });

  it("fails closed before section/content work when current authority is unavailable", async () => {
    authorityQuery.mockRejectedValueOnce(new Error("Authority unavailable"));
    await expect(call({ content: "SECTION" })).rejects.toMatchObject({ code: "unavailable" });
    expect(sectionQuery).not.toHaveBeenCalled();
    noContentQueries();
  });

  it("fails closed before section/content work when the current account is revoked", async () => {
    authorityQuery.mockResolvedValueOnce({ data: { userSecurityState: null } } as never);
    await expect(call({ content: "SECTION" }, true)).rejects.toMatchObject({ code: "permission-denied" });
    expect(sectionQuery).not.toHaveBeenCalled();
    noContentQueries();
  });

  it.each([
    { content: null }, { content: "MEMBERS" }, { content: {} },
    { content: "EVENT" }, { content: "EVENT", eventId: " " }, { content: "EVENT", eventId: [] },
    { content: "SECTION", eventId }, { eventId },
  ])("rejects malformed content options before any section/content query: %j", async options => {
    await expect(call(options)).rejects.toMatchObject({ code: "invalid-argument" });
    expect(sectionQuery).not.toHaveBeenCalled();
    expect(groupsQuery).not.toHaveBeenCalled();
    expect(statusQuery).not.toHaveBeenCalled();
    noContentQueries();
  });

  it("preserves metadata not-found failure without touching content", async () => {
    sectionQuery.mockResolvedValue({ data: { section: null } } as never);
    await expect(call({ content: "SECTION" })).rejects.toMatchObject({ code: "not-found" });
    noContentQueries();
  });

  it.each([
    { type: SectionType.MEMBERS, content: "EVENT" },
    { type: null, content: "EVENT" },
    { type: null, content: "SECTION" },
  ])("does no inapplicable work for type=$type surface=$content", async ({ type, content }) => {
    sectionQuery.mockResolvedValue({ data: { section: { ...section(), type } } } as never);
    const result = await call({ content, ...(content === "EVENT" ? { eventId } : {}) });
    expect(result.section?.type).toBe(type);
    expect(result).not.toHaveProperty("content");
    noContentQueries();
  });

  it.each([sectionId, sectionId.replace(/-/g, ""), sectionId.toUpperCase()])("loads one requested event with an equivalent parent %s and applies the standard ticket projection", async parentId => {
    eventQuery.mockResolvedValue({ data: { event: event(parentId) } } as never);
    const result = await call({ content: "EVENT", eventId });
    expect(result.content).toEqual({ kind: "EVENT", status: "ready", event: { ...event(parentId), ticketTypes: [{ id: "member-ticket", audience: TicketAudience.MEMBER }] } });
    expectOneAccessDecision();
    expect(eventQuery).toHaveBeenCalledExactlyOnceWith({ id: eventId });
    expect(eventsQuery).not.toHaveBeenCalled();
    expect(membersQuery).not.toHaveBeenCalled();
    expect(getUsers).not.toHaveBeenCalled();
  });

  it.each([false, true])("withholds another section's event even for an admin=%s", async isAdmin => {
    eventQuery.mockResolvedValue({ data: { event: event(otherSectionId) } } as never);
    const result = await call({ content: "EVENT", eventId }, isAdmin);
    expect(result).toEqual({ section: section(), hasAccess: true, canModerate: isAdmin, content: { kind: "EVENT", status: "error" } });
    expect(JSON.stringify(result)).not.toContain("Current event");
    expect(eventsQuery).not.toHaveBeenCalled();
    expect(membersQuery).not.toHaveBeenCalled();
  });

  it("retains verified metadata when the selected event is missing", async () => {
    eventQuery.mockResolvedValue({ data: { event: null } } as never);
    expect(await call({ content: "EVENT", eventId })).toMatchObject({ section: section(), content: { kind: "EVENT", status: "error" } });
  });

  it.each(["MEMBERS", "EVENTS", "EVENT"] as const)("retains verified metadata and sanitizes a failed %s content read", async kind => {
    sectionQuery.mockResolvedValue({ data: { section: section(kind === "MEMBERS" ? SectionType.MEMBERS : SectionType.EVENTS) } } as never);
    (kind === "MEMBERS" ? membersQuery : kind === "EVENTS" ? eventsQuery : eventQuery).mockRejectedValue(new Error("PRIVATE DATABASE FAILURE"));
    const result = await call({ content: kind === "EVENT" ? "EVENT" : "SECTION", ...(kind === "EVENT" ? { eventId } : {}) });
    expect(result).toEqual({ section: section(kind === "MEMBERS" ? SectionType.MEMBERS : SectionType.EVENTS), hasAccess: true, canModerate: false, content: { kind, status: "error" } });
    expect(JSON.stringify(result)).not.toContain("PRIVATE DATABASE FAILURE");
    expectOneAccessDecision();
  });

  it("uses the same MEMBERS roster privacy, status merging, verification and rate-limit bucket", async () => {
    sectionQuery.mockResolvedValue({ data: { section: section(SectionType.MEMBERS) } } as never);
    const visible = profile("visible");
    membersQuery.mockResolvedValue(memberResult([
      visible, profile("private", { shareContactInfo: false }),
      profile("unreviewed", { profileReviewedAt: null }), profile("unverified"), profile("missing"),
    ], [MembershipStatus.REGULAR]) as never);
    usersQuery.mockResolvedValue({ data: { users: [visible, profile("inherited", { shareContactInfo: false })] } } as never);
    getUsers.mockResolvedValue({ users: ["visible", "private", "unreviewed", "inherited"].map(uid => ({ uid, emailVerified: true })).concat([{ uid: "unverified", emailVerified: false }]) });
    const result = await call({ content: "SECTION" });
    expect(result.content).toEqual({ kind: "MEMBERS", status: "ready", members: [
      expect.objectContaining({ id: "visible", sharesContactInfo: true, email: "visible@example.invalid", mobileNumber: "+447700900123" }),
      ...["private", "unreviewed", "inherited"].map(id => expect.objectContaining({ id, sharesContactInfo: false, email: null, mobileNumber: null })),
    ] });
    expectOneAccessDecision();
    expect(membersQuery).toHaveBeenCalledExactlyOnceWith({ sectionId });
    expect(usersQuery).toHaveBeenCalledOnce();
    expect(ensureBucket).toHaveBeenCalledWith(expect.objectContaining({ userId: callerUid, functionName: "getSectionMembersMerged" }));
    expect(consumeBucket).toHaveBeenCalledWith(expect.objectContaining({ userId: callerUid, functionName: "getSectionMembersMerged", cost: 1, ceiling: 59 }));
    expect(eventsQuery).not.toHaveBeenCalled();
    expect(eventQuery).not.toHaveBeenCalled();
  });

  it("keeps directory verification batched and fails closed on an Auth outage", async () => {
    sectionQuery.mockResolvedValue({ data: { section: section(SectionType.MEMBERS) } } as never);
    membersQuery.mockResolvedValue(memberResult(Array.from({ length: 101 }, (_, index) => profile(`member-${index}`))) as never);
    const result = await call({ content: "SECTION" });
    expect(result.content).toMatchObject({ kind: "MEMBERS", status: "ready", members: expect.any(Array) });
    expect(getUsers.mock.calls.map(([ids]) => ids.length)).toEqual([100, 1]);
    getUsers.mockRejectedValue(new Error("Auth outage"));
    expect((await call({ content: "SECTION" })).content).toEqual({ kind: "MEMBERS", status: "error" });
  });

  it("does not bypass the existing directory rate limit through the bundle", async () => {
    sectionQuery.mockResolvedValue({ data: { section: section(SectionType.MEMBERS) } } as never);
    consumeBucket.mockRejectedValue(new Error("RATE_LIMIT_EXCEEDED"));
    expect((await call({ content: "SECTION" })).content).toEqual({ kind: "MEMBERS", status: "error" });
    expect(membersQuery).not.toHaveBeenCalled();
    expect(getUsers).not.toHaveBeenCalled();
  });

  it.each(["MEMBERS", "EVENTS", "EVENT"] as const)("removes one callable authority/access decision compared with legacy %s loading", async kind => {
    sectionQuery.mockResolvedValue({ data: { section: section(kind === "MEMBERS" ? SectionType.MEMBERS : SectionType.EVENTS) } } as never);
    await call();
    const request = { auth: { uid: callerUid, token: { enabled: true, securityVersion: 1 } }, data: kind === "EVENT" ? { eventId } : { sectionId } };
    await (kind === "MEMBERS" ? getSectionMembersMerged : kind === "EVENTS" ? getSectionEventsForUser : getEventForUser).run(request as never);
    expect(authorityQuery).toHaveBeenCalledTimes(2);
    expect(sectionQuery).toHaveBeenCalledTimes(2);
    expect(groupsQuery).toHaveBeenCalledTimes(2);
    expect(statusQuery).toHaveBeenCalledTimes(2);
    vi.clearAllMocks();
    await call({ content: kind === "EVENT" ? "EVENT" : "SECTION", ...(kind === "EVENT" ? { eventId } : {}) });
    expectOneAccessDecision();
    expect(kind === "MEMBERS" ? membersQuery : kind === "EVENTS" ? eventsQuery : eventQuery).toHaveBeenCalledOnce();
  });
});
