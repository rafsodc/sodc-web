import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { MembershipStatus } from "@dataconnect/admin-generated";
import {
  getSectionForUser,
  getSectionEventsForUser,
  getEventForUser,
  getSectionMembersMerged,
  searchSectionMembers,
} from "../sections";

const mockGetSectionById = vi.spyOn(admin, "getSectionById");
const mockGetUserAccessGroupsById = vi.spyOn(admin, "getUserAccessGroupsById");
const mockGetUserMembershipStatus = vi.spyOn(admin, "getUserMembershipStatus");
const mockGetEventsForSection = vi.spyOn(admin, "getEventsForSection");
const mockGetEventById = vi.spyOn(admin, "getEventById");
const mockGetSectionMembers = vi.spyOn(admin, "getSectionMembers");
const mockListUsers = vi.spyOn(admin, "listUsers");
const mockSearchSectionMemberCandidates = vi.spyOn(admin, "searchSectionMemberCandidates");
const mockConsumeCallableRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const mockEnsureCallableRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");

beforeEach(() => {
  mockEnsureCallableRateLimitBucket.mockResolvedValue({ data: {} } as never);
  mockConsumeCallableRateLimit.mockResolvedValue({ data: {} } as never);
});

const sectionId = "00000000-0000-4000-8000-000000000001";
const accessGroupId = "00000000-0000-4000-8000-0000000000a1";
const moderatorGroupId = "00000000-0000-4000-8000-0000000000a2";

function callAs<T>(
  fn: { run: (request: any) => Promise<T> },
  uid: string,
  isAdmin: boolean,
  data: Record<string, unknown>,
  enabled = true
): Promise<T> {
  return fn.run({
    auth: { uid, token: { admin: isAdmin, enabled } },
    data,
  });
}

function mockSection(purposeLinks: Array<{ purposes: string[]; userGroupId: string }>) {
  mockGetSectionById.mockResolvedValue({
    data: {
      section: {
        id: sectionId,
        name: "Test Section",
        type: "MEMBERS",
        description: null,
        isOpenForRegistration: false,
        allowedUserGroups: null,
        purposeLinks: purposeLinks.map((pl) => ({
          purposes: pl.purposes,
          userGroup: { id: pl.userGroupId, name: "Group", description: null, subscribable: false, membershipStatuses: null },
        })),
      },
    },
  } as unknown as Awaited<ReturnType<typeof admin.getSectionById>>);
}

describe("getSectionForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMembershipStatus.mockResolvedValue({
      data: { user: { membershipStatus: MembershipStatus.REGULAR, firstName: "A", lastName: "B", email: "a@b.com" } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);
  });

  it("returns the full section for an admin caller with no group relationship at all", async () => {
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "admin-1", userGroups: [] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);

    const result = await callAs(getSectionForUser, "admin-1", true, { sectionId });

    expect(result.hasAccess).toBe(true);
    expect(result.section?.id).toBe(sectionId);
  });

  it("rejects a disabled admin before the admin bypass or section lookup", async () => {
    await expect(
      callAs(getSectionForUser, "admin-1", true, { sectionId }, false)
    ).rejects.toMatchObject({ code: "permission-denied", message: "Account must be enabled" });
    expect(mockGetSectionById).not.toHaveBeenCalled();
  });

  it("returns hasAccess and canModerate for a non-admin with a MODERATOR group", async () => {
    mockSection([{ purposes: ["MODERATOR"], userGroupId: moderatorGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "mod-1", userGroups: [{ userGroup: { id: moderatorGroupId, name: "Mods", description: null } }] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);

    const result = await callAs(getSectionForUser, "mod-1", false, { sectionId });

    expect(result.hasAccess).toBe(true);
    expect(result.canModerate).toBe(true);
    expect(result.section?.id).toBe(sectionId);
  });

  it("does not throw, and withholds the section, for a non-admin with no relationship to the section", async () => {
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "stranger-1", userGroups: [] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);

    const result = await callAs(getSectionForUser, "stranger-1", false, { sectionId });

    expect(result).toEqual({ section: null, hasAccess: false, canModerate: false });
  });
});

describe("getSectionEventsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMembershipStatus.mockResolvedValue({
      data: { user: { membershipStatus: MembershipStatus.REGULAR, firstName: "A", lastName: "B", email: "a@b.com" } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);
  });

  it("rejects a non-admin with no access to the section", async () => {
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "stranger-1", userGroups: [] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);

    await expect(
      callAs(getSectionEventsForUser, "stranger-1", false, { sectionId })
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(mockGetEventsForSection).not.toHaveBeenCalled();
  });

  it("returns events for a user with ACCESS", async () => {
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "member-1", userGroups: [{ userGroup: { id: accessGroupId, name: "Access", description: null } }] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);
    mockGetEventsForSection.mockResolvedValue({
      data: { section: { id: sectionId, events: [{ id: "event-1", title: "Event One" }] } },
    } as unknown as Awaited<ReturnType<typeof admin.getEventsForSection>>);

    const result = await callAs(getSectionEventsForUser, "member-1", false, { sectionId });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Event One");
  });
});

describe("getEventForUser", () => {
  const eventId = "00000000-0000-4000-8000-000000000099";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMembershipStatus.mockResolvedValue({
      data: { user: { membershipStatus: MembershipStatus.REGULAR, firstName: "A", lastName: "B", email: "a@b.com" } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);
  });

  it("rejects when the event does not exist", async () => {
    mockGetEventById.mockResolvedValue({ data: { event: undefined } } as unknown as Awaited<
      ReturnType<typeof admin.getEventById>
    >);

    await expect(
      callAs(getEventForUser, "member-1", false, { eventId })
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("rejects a non-admin with no access to the event's section", async () => {
    mockGetEventById.mockResolvedValue({
      data: { event: { id: eventId, section: { id: sectionId }, title: "Event" } },
    } as unknown as Awaited<ReturnType<typeof admin.getEventById>>);
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "stranger-1", userGroups: [] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);

    await expect(
      callAs(getEventForUser, "stranger-1", false, { eventId })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("returns the event for a user with access to its section", async () => {
    mockGetEventById.mockResolvedValue({
      data: { event: { id: eventId, section: { id: sectionId }, title: "Event" } },
    } as unknown as Awaited<ReturnType<typeof admin.getEventById>>);
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "member-1", userGroups: [{ userGroup: { id: accessGroupId, name: "Access", description: null } }] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);

    const result = await callAs(getEventForUser, "member-1", false, { eventId });

    expect(result.event?.id).toBe(eventId);
  });
});

describe("getSectionMembersMerged", () => {
  function member(overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    mobileNumber: string | null;
    membershipStatus: string;
    rank: string | null;
    shareContactInfo: boolean | null;
  }> = {}) {
    return {
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      mobileNumber: null,
      membershipStatus: MembershipStatus.REGULAR,
      rank: null,
      shareContactInfo: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSection([{ purposes: ["ACCESS"], userGroupId: accessGroupId }]);
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "member-1", userGroups: [{ userGroup: { id: accessGroupId, name: "Access", description: null } }] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);
    mockGetUserMembershipStatus.mockResolvedValue({
      data: { user: { membershipStatus: MembershipStatus.REGULAR } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);
  });

  function mockMembers(users: ReturnType<typeof member>[]) {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionId,
          name: "Test Section",
          type: "MEMBERS",
          description: null,
          purposeLinks: [
            {
              purposes: ["MEMBER"],
              userGroup: {
                id: accessGroupId,
                name: "Access",
                membershipStatuses: null,
                users: users.map((u) => ({ user: u })),
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);
  }

  it("rejects a disabled caller before retained group membership can grant directory access", async () => {
    await expect(
      callAs(getSectionMembersMerged, "member-1", false, { sectionId }, false)
    ).rejects.toMatchObject({ code: "permission-denied", message: "Account must be enabled" });

    expect(mockGetSectionById).not.toHaveBeenCalled();
    expect(mockGetSectionMembers).not.toHaveBeenCalled();
    expect(mockGetUserAccessGroupsById).not.toHaveBeenCalled();
  });

  it("includes email and rank for a member who shares contact info", async () => {
    mockMembers([
      member({
        rank: "Wing Commander",
        shareContactInfo: true,
        mobileNumber: "+447700900123",
      }),
    ]);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members).toEqual([
      {
        id: "user-1",
        firstName: "Ada",
        lastName: "Lovelace",
        membershipStatus: MembershipStatus.REGULAR,
        rank: "Wing Commander",
        sharesContactInfo: true,
        email: "ada@example.com",
        mobileNumber: "+447700900123",
      },
    ]);
  });

  it("still lists an opted-out member but returns email: null", async () => {
    mockMembers([member({ shareContactInfo: false })]);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toMatchObject({
      id: "user-1",
      sharesContactInfo: false,
      email: null,
      mobileNumber: null,
    });
  });

  it("defaults to sharing when shareContactInfo is null/undefined (legacy rows)", async () => {
    mockMembers([member({ shareContactInfo: null })]);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members[0]).toMatchObject({ sharesContactInfo: true, email: "ada@example.com" });
  });

  it("redacts status-derived members (resolved via listUsers) the same way as explicit members", async () => {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionId,
          name: "Test Section",
          type: "MEMBERS",
          description: null,
          purposeLinks: [
            {
              purposes: ["MEMBER"],
              userGroup: {
                id: accessGroupId,
                name: "Access",
                membershipStatuses: [MembershipStatus.REGULAR],
                users: [],
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);
    mockListUsers.mockResolvedValue({
      data: { users: [member({ id: "user-2", shareContactInfo: false })] },
    } as unknown as Awaited<ReturnType<typeof admin.listUsers>>);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members).toEqual([
      expect.objectContaining({ id: "user-2", sharesContactInfo: false, email: null }),
    ]);
  });

  it("returns no members for a section with only an ACCESS-purpose group and no MEMBER group (#322)", async () => {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionId,
          name: "Test Section",
          type: "MEMBERS",
          description: null,
          purposeLinks: [
            {
              purposes: ["ACCESS"],
              userGroup: {
                id: accessGroupId,
                name: "Access",
                membershipStatuses: null,
                users: [{ user: member() }],
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members).toEqual([]);
  });

  it("falls back to ACCESS/MODERATOR groups for an EVENTS-type section with no MEMBER group", async () => {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionId,
          name: "Test Section",
          type: "EVENTS",
          description: null,
          purposeLinks: [
            {
              purposes: ["ACCESS"],
              userGroup: {
                id: accessGroupId,
                name: "Access",
                membershipStatuses: null,
                users: [{ user: member() }],
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members).toEqual([
      expect.objectContaining({ id: "user-1", firstName: "Ada", lastName: "Lovelace" }),
    ]);
  });

  it("prefers an explicit MEMBER group over the ACCESS fallback on an EVENTS-type section", async () => {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionId,
          name: "Test Section",
          type: "EVENTS",
          description: null,
          purposeLinks: [
            {
              purposes: ["ACCESS"],
              userGroup: {
                id: accessGroupId,
                name: "Access",
                membershipStatuses: null,
                users: [{ user: member({ id: "access-only-user" }) }],
              },
            },
            {
              purposes: ["MEMBER"],
              userGroup: {
                id: "member-group-id",
                name: "Members",
                membershipStatuses: null,
                users: [{ user: member({ id: "roster-user" }) }],
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);

    const result = await callAs(getSectionMembersMerged, "member-1", false, { sectionId });

    expect(result.members).toEqual([expect.objectContaining({ id: "roster-user" })]);
  });
});

describe("searchSectionMembers", () => {
  function eventsUser(id: string, firstName: string, lastName: string) {
    return {
      id,
      firstName,
      lastName,
      email: `${id}@example.com`,
      mobileNumber: null,
      membershipStatus: MembershipStatus.REGULAR,
      rank: null,
      shareContactInfo: true,
    };
  }

  function mockEventsSection(membershipStatuses: MembershipStatus[] | null = null) {
    mockGetSectionById.mockResolvedValue({
      data: {
        section: {
          id: sectionId,
          name: "Test Section",
          type: "EVENTS",
          description: null,
          isOpenForRegistration: false,
          allowedUserGroups: null,
          purposeLinks: [
            {
              purposes: ["ACCESS"],
              userGroup: {
                id: accessGroupId,
                name: "Access",
                description: null,
                subscribable: false,
                membershipStatuses,
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionById>>);
  }

  function mockCandidates({
    explicit = [],
    inherited = [],
    included = [],
  }: {
    explicit?: ReturnType<typeof eventsUser>[];
    inherited?: ReturnType<typeof eventsUser>[];
    included?: ReturnType<typeof eventsUser>[];
  }) {
    mockSearchSectionMemberCandidates.mockResolvedValue({
      data: {
        explicit: explicit.map((user) => ({ user })),
        inherited,
        included,
      },
    } as unknown as Awaited<ReturnType<typeof admin.searchSectionMemberCandidates>>);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventsSection();
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "member-1", userGroups: [{ userGroup: { id: accessGroupId, name: "Access", description: null } }] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);
    mockGetUserMembershipStatus.mockResolvedValue({
      data: { user: { membershipStatus: MembershipStatus.REGULAR } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);
  });

  it("matches by first or last name, case-insensitively", async () => {
    mockCandidates({ explicit: [eventsUser("user-2", "Grace", "Hopper")] });

    const result = await callAs(searchSectionMembers, "member-1", false, { sectionId, searchTerm: "grace" });

    expect(result.members).toEqual([{ id: "user-2", firstName: "Grace", lastName: "Hopper" }]);
    expect(mockSearchSectionMemberCandidates).toHaveBeenCalledWith(expect.objectContaining({
      searchPattern: "(?i).*grace.*",
      limit: 20,
    }));
    expect(mockListUsers).not.toHaveBeenCalled();
    expect(mockGetSectionMembers).not.toHaveBeenCalled();
  });

  it("excludes the caller from results", async () => {
    mockCandidates({ explicit: [eventsUser("member-1", "Self", "Caller"), eventsUser("user-2", "Selma", "Case")] });

    const result = await callAs(searchSectionMembers, "member-1", false, { sectionId, searchTerm: "sel" });

    expect(result.members).toEqual([{ id: "user-2", firstName: "Selma", lastName: "Case" }]);
  });

  it("returns no matches for a blank search term with no includeIds", async () => {
    const result = await callAs(searchSectionMembers, "member-1", false, { sectionId, searchTerm: "" });

    expect(result.members).toEqual([]);
    expect(mockSearchSectionMemberCandidates).not.toHaveBeenCalled();
  });

  it("always resolves includeIds regardless of the search term", async () => {
    mockCandidates({ included: [eventsUser("user-3", "Ada", "Lovelace")] });

    const result = await callAs(searchSectionMembers, "member-1", false, {
      sectionId,
      searchTerm: "",
      includeIds: ["user-3"],
    });

    expect(result.members).toEqual([{ id: "user-3", firstName: "Ada", lastName: "Lovelace" }]);
  });

  it("caps search matches to a manageable result set", async () => {
    const users = Array.from({ length: 30 }, (_, i) => eventsUser(`user-${i}`, "Match", `Person${i}`));
    mockCandidates({ explicit: users });

    const result = await callAs(searchSectionMembers, "member-1", false, { sectionId, searchTerm: "match" });

    expect(result.members).toHaveLength(20);
  });

  it("passes explicit groups and inherited statuses to one bounded database query", async () => {
    mockEventsSection([MembershipStatus.REGULAR, MembershipStatus.RESERVE]);
    mockCandidates({
      explicit: [eventsUser("explicit-1", "Ada", "Lovelace")],
      inherited: [eventsUser("inherited-1", "Grace", "Hopper")],
    });

    const result = await callAs(searchSectionMembers, "member-1", false, { sectionId, searchTerm: "a" });

    expect(result.members.map((member) => member.id)).toEqual(["inherited-1", "explicit-1"]);
    expect(mockSearchSectionMemberCandidates).toHaveBeenCalledWith({
      userGroupIds: [accessGroupId],
      membershipStatuses: [MembershipStatus.REGULAR, MembershipStatus.RESERVE],
      searchPattern: "(?i).*a.*",
      includeIds: [],
      limit: 20,
    });
  });

  it("escapes regular-expression metacharacters before querying", async () => {
    mockCandidates({});

    await callAs(searchSectionMembers, "member-1", false, { sectionId, searchTerm: "A. (Test)?" });

    expect(mockSearchSectionMemberCandidates).toHaveBeenCalledWith(expect.objectContaining({
      searchPattern: String.raw`(?i).*A\. \(Test\)\?.*`,
    }));
  });

  it("rejects a caller with no access to the section", async () => {
    mockGetUserAccessGroupsById.mockResolvedValue({
      data: { user: { id: "stranger-1", userGroups: [] } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);
    mockGetUserMembershipStatus.mockResolvedValue({
      data: { user: { membershipStatus: null } },
    } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);

    await expect(
      callAs(searchSectionMembers, "stranger-1", false, { sectionId, searchTerm: "grace" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
