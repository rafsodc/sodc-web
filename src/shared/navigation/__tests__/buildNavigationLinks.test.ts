import { describe, expect, it } from "vitest";
import type { GetSectionsForUserData } from "@dataconnect/generated";
import { ROUTES } from "../../../constants";
import { buildNavigationLinks } from "../buildNavigationLinks";
import { sectionDetailLocationState } from "../sectionNavigationState";

const homeSectionState = sectionDetailLocationState(ROUTES.HOME);

function sectionsData(overrides: Partial<GetSectionsForUserData> = {}): GetSectionsForUserData {
  return {
    user: {
      id: "user-1",
      membershipStatus: "REGULAR",
      userGroups: [],
    },
    allUserGroups: [],
    ...overrides,
  } as GetSectionsForUserData;
}

function purposeLink(purpose: "ACCESS" | "MODERATOR", id: string, name: string) {
  return {
    purposes: [purpose],
    section: {
      id,
      name,
      type: "EVENTS",
      description: null,
    },
  };
}

describe("buildNavigationLinks", () => {
  it("returns no links when user is not enabled", () => {
    expect(
      buildNavigationLinks({
        isEnabled: false,
        isAdmin: true,
        sectionsData: sectionsData(),
      })
    ).toEqual({ sections: [], admin: [] });
  });

  it("builds section links from ACCESS purpose links", () => {
    const links = buildNavigationLinks({
      isEnabled: true,
      isAdmin: false,
      sectionsData: sectionsData({
        user: {
          id: "user-1",
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                id: "group-1",
                name: "Access group",
                membershipStatuses: null,
                purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
              },
            },
          ],
        },
      } as Partial<GetSectionsForUserData>),
    });

    expect(links.sections).toEqual([
      { label: "Signals", to: "/sections/section-1", state: homeSectionState },
    ]);
    expect(links.admin).toEqual([]);
  });

  it("nests moderator section links under Manage Sections", () => {
    const links = buildNavigationLinks({
      isEnabled: true,
      isAdmin: false,
      sectionsData: sectionsData({
        user: {
          id: "user-1",
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                id: "group-1",
                name: "Moderator group",
                membershipStatuses: null,
                purposeLinks: [purposeLink("MODERATOR", "section-1", "Signals")],
              },
            },
          ],
        },
      } as Partial<GetSectionsForUserData>),
    });

    expect(links.sections).toEqual([
      {
        label: "Signals",
        to: "/sections/section-1",
        state: homeSectionState,
        children: [
          {
            label: "Administer",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
            state: { sectionName: "Signals", sectionType: "EVENTS" },
          },
        ],
      },
    ]);
    expect(links.admin).toEqual([
      {
        label: "Manage Sections",
        to: ROUTES.MANAGE_SECTIONS,
        state: null,
        children: [
          {
            label: "Signals",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
            state: { sectionName: "Signals", sectionType: "EVENTS" },
          },
        ],
      },
    ]);
  });

  it("nests status-based moderator section links under Manage Sections", () => {
    const links = buildNavigationLinks({
      isEnabled: true,
      isAdmin: false,
      sectionsData: sectionsData({
        allUserGroups: [
          {
            id: "status-group-1",
            name: "Regular moderators",
            membershipStatuses: ["REGULAR"],
            purposeLinks: [purposeLink("MODERATOR", "section-2", "Events")],
          },
        ],
      } as Partial<GetSectionsForUserData>),
    });

    expect(links.sections).toEqual([
      {
        label: "Events",
        to: "/sections/section-2",
        state: homeSectionState,
        children: [
          {
            label: "Administer",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-2"),
            state: { sectionName: "Events", sectionType: "EVENTS" },
          },
        ],
      },
    ]);
    expect(links.admin).toEqual([
      {
        label: "Manage Sections",
        to: ROUTES.MANAGE_SECTIONS,
        state: null,
        children: [
          {
            label: "Events",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-2"),
            state: { sectionName: "Events", sectionType: "EVENTS" },
          },
        ],
      },
    ]);
  });

  it("shows global admin links with section and user group children only for admins", () => {
    const nonAdmin = buildNavigationLinks({
      isEnabled: true,
      isAdmin: false,
      sectionsData: sectionsData({
        user: {
          id: "user-1",
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                id: "group-1",
                name: "Access group",
                membershipStatuses: null,
                purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
              },
            },
          ],
        },
        allUserGroups: [
          {
            id: "group-1",
            name: "Access group",
            membershipStatuses: ["REGULAR"],
            purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
          },
        ],
      } as Partial<GetSectionsForUserData>),
    });
    const admin = buildNavigationLinks({
      isEnabled: true,
      isAdmin: true,
      sectionsData: sectionsData({
        user: {
          id: "user-1",
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                id: "group-1",
                name: "Access group",
                membershipStatuses: null,
                purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
              },
            },
          ],
        },
        allUserGroups: [
          {
            id: "group-1",
            name: "Access group",
            membershipStatuses: ["REGULAR"],
            purposeLinks: [purposeLink("ACCESS", "section-1", "Signals")],
          },
        ],
      } as Partial<GetSectionsForUserData>),
    });

    expect(nonAdmin.admin).toEqual([]);
    expect(nonAdmin.sections).toEqual([
      { label: "Signals", to: "/sections/section-1", state: homeSectionState },
    ]);
    expect(admin.sections).toEqual([
      {
        label: "Signals",
        to: "/sections/section-1",
        state: homeSectionState,
        children: [
          {
            label: "Administer",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
            state: { sectionName: "Signals", sectionType: "EVENTS" },
          },
        ],
      },
    ]);
    expect(admin.admin).toEqual(
      expect.arrayContaining([
        { label: "Manage Users", to: ROUTES.MANAGE_USERS },
        {
          label: "Manage Sections",
          to: ROUTES.MANAGE_SECTIONS,
          state: null,
          children: [
            {
              label: "Signals",
              to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
              state: { sectionName: "Signals", sectionType: "EVENTS" },
            },
          ],
        },
        {
          label: "User Groups",
          to: ROUTES.USER_GROUPS,
          state: null,
          children: [
            {
              label: "Access group",
              to: ROUTES.USER_GROUPS,
              state: { expandedGroupId: "group-1" },
            },
          ],
        },
      ])
    );
    expect(admin.admin.at(-1)).toEqual({ label: "Audit Logs", to: ROUTES.AUDIT_LOGS });
  });

  it("deduplicates and sorts section links and admin section children", () => {
    const links = buildNavigationLinks({
      isEnabled: true,
      isAdmin: true,
      sectionsData: sectionsData({
        user: {
          id: "user-1",
          membershipStatus: "REGULAR",
          userGroups: [
            {
              userGroup: {
                id: "group-1",
                name: "Moderator group",
                membershipStatuses: null,
                purposeLinks: [
                  purposeLink("MODERATOR", "section-2", "Zulu"),
                  purposeLink("MODERATOR", "section-1", "Alpha"),
                  purposeLink("ACCESS", "section-1", "Alpha"),
                ],
              },
            },
          ],
        },
      } as Partial<GetSectionsForUserData>),
    });

    expect(links.sections).toEqual([
      {
        label: "Alpha",
        to: "/sections/section-1",
        state: homeSectionState,
        children: [
          {
            label: "Administer",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
            state: { sectionName: "Alpha", sectionType: "EVENTS" },
          },
        ],
      },
      {
        label: "Zulu",
        to: "/sections/section-2",
        state: homeSectionState,
        children: [
          {
            label: "Administer",
            to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-2"),
            state: { sectionName: "Zulu", sectionType: "EVENTS" },
          },
        ],
      },
    ]);
    expect(links.admin).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Manage Sections",
          children: [
            {
              label: "Alpha",
              to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
              state: { sectionName: "Alpha", sectionType: "EVENTS" },
            },
            {
              label: "Zulu",
              to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-2"),
              state: { sectionName: "Zulu", sectionType: "EVENTS" },
            },
          ],
        }),
      ])
    );
  });

  it("moves Audit Logs to the bottom of admin links", () => {
    const links = buildNavigationLinks({
      isEnabled: true,
      isAdmin: true,
      sectionsData: sectionsData(),
    });

    expect(links.admin.at(-1)).toEqual({ label: "Audit Logs", to: ROUTES.AUDIT_LOGS });
  });
});
