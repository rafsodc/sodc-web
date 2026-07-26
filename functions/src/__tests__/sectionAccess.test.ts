import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { MembershipStatus } from "@dataconnect/admin-generated";
import { requireSectionAccess, requireSectionModerator } from "../sectionAccess";

const mockGetSectionById = vi.spyOn(admin, "getSectionById");
const mockGetUserAccessGroupsById = vi.spyOn(admin, "getUserAccessGroupsById");
const mockGetUserMembershipStatus = vi.spyOn(admin, "getUserMembershipStatus");

const sectionId = "00000000-0000-4000-8000-000000000001";
const accessGroupId = "00000000-0000-4000-8000-0000000000a1";
const moderatorGroupId = "00000000-0000-4000-8000-0000000000a2";

function mockSection() {
  mockGetSectionById.mockResolvedValue({
    data: {
      section: {
        id: sectionId,
        name: "Files",
        type: "MEMBERS",
        description: null,
        isOpenForRegistration: false,
        allowedUserGroups: null,
        purposeLinks: [
          {
            purposes: ["ACCESS"],
            userGroup: {
              id: accessGroupId,
              name: "Members",
              description: null,
              subscribable: false,
              membershipStatuses: [MembershipStatus.REGULAR],
            },
          },
          {
            purposes: ["MODERATOR"],
            userGroup: {
              id: moderatorGroupId,
              name: "Moderators",
              description: null,
              subscribable: false,
              membershipStatuses: null,
            },
          },
        ],
      },
    },
  } as unknown as Awaited<ReturnType<typeof admin.getSectionById>>);
}

function mockCaller(groupIds: string[], status = MembershipStatus.INDUSTRY) {
  mockGetUserAccessGroupsById.mockResolvedValue({
    data: {
      user: {
        id: "caller",
        userGroups: groupIds.map((id) => ({
          userGroup: { id, name: "Group", description: null },
        })),
      },
    },
  } as unknown as Awaited<ReturnType<typeof admin.getUserAccessGroupsById>>);
  mockGetUserMembershipStatus.mockResolvedValue({
    data: { user: { membershipStatus: status } },
  } as unknown as Awaited<ReturnType<typeof admin.getUserMembershipStatus>>);
}

describe("section access service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSection();
  });

  it("allows an explicit section member to read but not manage files", async () => {
    mockCaller([accessGroupId]);
    await expect(requireSectionAccess(sectionId, "caller", false)).resolves.toMatchObject({
      hasAccess: true,
      canModerate: false,
    });
    await expect(requireSectionModerator(sectionId, "caller", false)).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("allows a correct-section moderator to read and manage files", async () => {
    mockCaller([moderatorGroupId]);
    await expect(requireSectionModerator(sectionId, "caller", false)).resolves.toMatchObject({
      hasAccess: true,
      canModerate: true,
    });
  });

  it("includes membership-status-derived ACCESS", async () => {
    mockCaller([], MembershipStatus.REGULAR);
    await expect(requireSectionAccess(sectionId, "caller", false)).resolves.toMatchObject({
      hasAccess: true,
      canModerate: false,
    });
  });

  it("returns a non-enumerating denial for a caller from another section", async () => {
    mockCaller([]);
    await expect(requireSectionAccess(sectionId, "caller", false)).rejects.toMatchObject({
      code: "not-found",
      message: "Resource not found",
    });
  });

  it("allows an enabled global admin at the relationship layer", async () => {
    mockCaller([]);
    await expect(requireSectionModerator(sectionId, "caller", true)).resolves.toMatchObject({
      canModerate: false,
    });
  });
});
