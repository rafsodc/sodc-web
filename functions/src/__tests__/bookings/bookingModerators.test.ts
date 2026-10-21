import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/admin-generated";
import * as admin from "@dataconnect/admin-generated";
import * as helpers from "../../helpers";
import * as recipientPolicy from "../../privilegedNotificationRecipient";
import { resolveBookingModeratorUserIds } from "../../bookingModerators";

const mockGetSectionMembers = vi.spyOn(admin, "getSectionMembers");
const mockListUsers = vi.spyOn(admin, "listUsers");
const mockGetAdminUsers = vi.spyOn(helpers, "getAdminUsers");

describe("resolveBookingModeratorUserIds", () => {
  beforeEach(() => {
    mockGetSectionMembers.mockReset();
    mockListUsers.mockReset();
    mockGetAdminUsers.mockReset();
    vi.spyOn(recipientPolicy, "selectPrivilegedNotificationRecipientIds").mockImplementation(async (uids) => [...uids]);
  });

  it("merges stable admin, explicit and status-inherited organiser UIDs while excluding the booker", async () => {
    mockGetAdminUsers.mockResolvedValue([
      { uid: "admin-1", email: "admin@example.com" } as Awaited<ReturnType<typeof helpers.getAdminUsers>>[number],
    ]);
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: "00000000-0000-4000-8000-000000000010",
          name: "Events",
          type: "EVENTS",
          purposeLinks: [{
            purposes: [SectionUserGroupPurpose.MODERATOR],
            userGroup: {
              id: "g1",
              name: "Organisers",
              membershipStatuses: [MembershipStatus.REGULAR],
              users: [
                { user: { id: "mod-1", firstName: "Mod", lastName: "One", email: "mod@example.com", membershipStatus: MembershipStatus.REGULAR } },
                { user: { id: "booker-1", firstName: "Sam", lastName: "Booker", email: "booker@example.com", membershipStatus: MembershipStatus.REGULAR } },
              ],
            },
          }],
        },
      },
    } as Awaited<ReturnType<typeof admin.getSectionMembers>>);
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: "status-mod", email: "statusmod@example.com", membershipStatus: MembershipStatus.REGULAR }] },
    } as Awaited<ReturnType<typeof admin.listUsers>>);

    const emails = await resolveBookingModeratorUserIds({
      sectionId: "00000000-0000-4000-8000-000000000010",
      excludeUserId: "booker-1",
    });

    expect(emails.sort()).toEqual(["admin-1", "mod-1", "status-mod"].sort());
    expect(emails).not.toContain("booker-1");
    expect(recipientPolicy.selectPrivilegedNotificationRecipientIds).toHaveBeenCalledWith(expect.any(Set), { kind: "BOOKING", sectionId: "00000000-0000-4000-8000-000000000010" });
  });
});
