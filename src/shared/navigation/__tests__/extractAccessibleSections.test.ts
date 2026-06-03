import { describe, expect, it } from "vitest";
import type { GetSectionsForUserData } from "@dataconnect/generated";
import { SectionType } from "@dataconnect/generated";
import { extractAccessibleSections } from "../extractAccessibleSections";

function purposeLink(purpose: "ACCESS" | "MODERATOR", id: string, name: string, type = SectionType.EVENTS) {
  return {
    purposes: [purpose],
    section: { id, name, type, description: `${name} description` },
  };
}

describe("extractAccessibleSections", () => {
  it("returns empty when sections data is undefined", () => {
    expect(extractAccessibleSections(undefined)).toEqual([]);
  });

  it("includes sections from explicit user groups with ACCESS", () => {
    const data = {
      user: {
        id: "u1",
        membershipStatus: "REGULAR",
        userGroups: [
          {
            userGroup: {
              id: "g1",
              name: "G1",
              membershipStatuses: null,
              purposeLinks: [purposeLink("ACCESS", "s1", "Signals")],
            },
          },
        ],
      },
      allUserGroups: [],
    } as GetSectionsForUserData;

    expect(extractAccessibleSections(data)).toEqual([
      {
        id: "s1",
        name: "Signals",
        type: SectionType.EVENTS,
        description: "Signals description",
      },
    ]);
  });

  it("includes sections inherited via membership status on allUserGroups", () => {
    const data = {
      user: {
        id: "u1",
        membershipStatus: "REGULAR",
        userGroups: [],
      },
      allUserGroups: [
        {
          id: "g2",
          name: "Regular pool",
          membershipStatuses: ["REGULAR"],
          purposeLinks: [purposeLink("ACCESS", "s2", "Dinners")],
        },
      ],
    } as GetSectionsForUserData;

    const sections = extractAccessibleSections(data);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe("s2");
  });

  it("dedupes sections linked from multiple groups", () => {
    const data = {
      user: {
        id: "u1",
        membershipStatus: "REGULAR",
        userGroups: [
          {
            userGroup: {
              id: "g1",
              name: "G1",
              membershipStatuses: null,
              purposeLinks: [purposeLink("ACCESS", "s1", "Signals")],
            },
          },
        ],
      },
      allUserGroups: [
        {
          id: "g2",
          name: "G2",
          membershipStatuses: ["REGULAR"],
          purposeLinks: [purposeLink("MODERATOR", "s1", "Signals")],
        },
      ],
    } as GetSectionsForUserData;

    expect(extractAccessibleSections(data)).toHaveLength(1);
  });
});
