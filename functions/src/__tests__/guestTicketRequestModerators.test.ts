import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import * as helpers from "../helpers";
import { resolveGuestTicketModeratorEmails } from "../guestTicketRequestModerators";

const mockGetSectionMembers = vi.spyOn(admin, "getSectionMembers");
const mockListUsers = vi.spyOn(admin, "listUsers");
const mockGetAdminUsers = vi.spyOn(helpers, "getAdminUsers");

describe("resolveGuestTicketModeratorEmails", () => {
  beforeEach(() => {
    mockGetSectionMembers.mockReset();
    mockListUsers.mockReset();
    mockGetAdminUsers.mockReset();
  });

  it("merges admin emails and MODERATOR group members, excluding booker", async () => {
    mockGetAdminUsers.mockResolvedValue([
      { uid: "admin-1", email: "admin@example.com" } as Awaited<ReturnType<typeof helpers.getAdminUsers>>[number],
    ]);
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: "00000000-0000-4000-8000-000000000010",
          name: "Events",
          type: "EVENTS",
          purposeLinks: [
            {
              purposes: [SectionUserGroupPurpose.MODERATOR],
              userGroup: {
                id: "g1",
                name: "Mods",
                membershipStatuses: [MembershipStatus.REGULAR],
                users: [
                  {
                    user: {
                      id: "mod-1",
                      firstName: "Mod",
                      lastName: "One",
                      email: "mod@example.com",
                      membershipStatus: MembershipStatus.REGULAR,
                    },
                  },
                  {
                    user: {
                      id: "booker-1",
                      firstName: "Sam",
                      lastName: "Booker",
                      email: "booker@example.com",
                      membershipStatus: MembershipStatus.REGULAR,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    } as Awaited<ReturnType<typeof admin.getSectionMembers>>);
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "status-mod",
            email: "statusmod@example.com",
            membershipStatus: MembershipStatus.REGULAR,
          },
        ],
      },
    } as Awaited<ReturnType<typeof admin.listUsers>>);

    const emails = await resolveGuestTicketModeratorEmails({
      sectionId: "00000000-0000-4000-8000-000000000010",
      excludeUserId: "booker-1",
    });

    expect(emails.sort()).toEqual(
      ["admin@example.com", "mod@example.com", "statusmod@example.com"].sort()
    );
    expect(emails).not.toContain("booker@example.com");
  });
});
