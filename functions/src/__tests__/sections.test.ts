import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { MembershipStatus } from "@dataconnect/admin-generated";
import { getSectionForUser, getSectionEventsForUser, getEventForUser } from "../sections";

const mockGetSectionById = vi.spyOn(admin, "getSectionById");
const mockGetUserAccessGroupsById = vi.spyOn(admin, "getUserAccessGroupsById");
const mockGetUserMembershipStatus = vi.spyOn(admin, "getUserMembershipStatus");
const mockGetEventsForSection = vi.spyOn(admin, "getEventsForSection");
const mockGetEventById = vi.spyOn(admin, "getEventById");

const sectionId = "00000000-0000-4000-8000-000000000001";
const accessGroupId = "00000000-0000-4000-8000-0000000000a1";
const moderatorGroupId = "00000000-0000-4000-8000-0000000000a2";

function callAs<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: { run: (request: any) => Promise<T> },
  uid: string,
  isAdmin: boolean,
  data: Record<string, unknown>
): Promise<T> {
  return fn.run({
    auth: { uid, token: { admin: isAdmin, enabled: true } },
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
