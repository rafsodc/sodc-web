import { describe, expect, it } from "vitest";
import { MembershipStatus, SectionUserGroupPurpose } from "@dataconnect/generated";
import { getAnnouncementSections } from "../announcementPreferences";

describe("getAnnouncementSections", () => {
  it("combines explicit and status-based access, removes duplicates, and sorts names", () => {
    expect(
      getAnnouncementSections({
        user: {
          membershipStatus: MembershipStatus.REGULAR,
          announcementOptOutAll: false,
          optOuts: [],
          userGroups: [
            {
              userGroup: {
                purposeLinks: [
                  {
                    purposes: [SectionUserGroupPurpose.ACCESS],
                    section: { id: "two", name: "Zulu" },
                  },
                  {
                    purposes: [SectionUserGroupPurpose.MESSAGE],
                    section: { id: "ignored", name: "Ignored" },
                  },
                ],
              },
            },
          ],
        },
        allUserGroups: [
          {
            membershipStatuses: [MembershipStatus.REGULAR],
            purposeLinks: [
              {
                purposes: [SectionUserGroupPurpose.MODERATOR],
                section: { id: "one", name: "Alpha" },
              },
              {
                purposes: [SectionUserGroupPurpose.ACCESS],
                section: { id: "two", name: "Zulu" },
              },
            ],
          },
        ],
      }),
    ).toEqual([
      { id: "one", name: "Alpha" },
      { id: "two", name: "Zulu" },
    ]);
  });
});
