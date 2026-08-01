import { describe, expect, it } from "vitest";
import { getAnnouncementSections } from "../announcementPreferences";

describe("getAnnouncementSections", () => {
  it("combines explicit and status-based access, removes duplicates, and sorts names", () => {
    expect(
      getAnnouncementSections({
        user: {
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                purposeLinks: [
                  { purposes: ["ACCESS"], section: { id: "two", name: "Zulu" } },
                  { purposes: ["ANNOUNCEMENTS"], section: { id: "ignored", name: "Ignored" } },
                ],
              },
            },
          ],
        },
        allUserGroups: [
          {
            membershipStatuses: ["REGULAR"],
            purposeLinks: [
              { purposes: ["MODERATOR"], section: { id: "one", name: "Alpha" } },
              { purposes: ["ACCESS"], section: { id: "two", name: "Zulu" } },
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
