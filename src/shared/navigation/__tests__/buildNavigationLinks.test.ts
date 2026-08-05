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

  it("shows Manage Sections (with no children) for a section moderator", () => {
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
      { label: "Signals", to: "/sections/section-1", state: homeSectionState },
    ]);
    expect(links.admin).toEqual([{ label: "Manage Sections", to: ROUTES.MANAGE_SECTIONS }]);
  });

  it("shows Manage Sections for a status-based moderator", () => {
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
      { label: "Events", to: "/sections/section-2", state: homeSectionState },
    ]);
    expect(links.admin).toEqual([{ label: "Manage Sections", to: ROUTES.MANAGE_SECTIONS }]);
  });

  it("shows the full global admin link set only for admins", () => {
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
      } as Partial<GetSectionsForUserData>),
    });

    expect(nonAdmin.admin).toEqual([]);
    expect(nonAdmin.sections).toEqual([
      { label: "Signals", to: "/sections/section-1", state: homeSectionState },
    ]);
    expect(admin.sections).toEqual([
      { label: "Signals", to: "/sections/section-1", state: homeSectionState },
    ]);
    expect(admin.admin).toEqual([
      { label: "Manage Users", to: ROUTES.MANAGE_USERS },
      { label: "Approvals", to: ROUTES.APPROVE_USERS },
      { label: "Manage Sections", to: ROUTES.MANAGE_SECTIONS },
      { label: "User Groups", to: ROUTES.USER_GROUPS },
      { label: "Payment Reconciliation", to: ROUTES.PAYMENT_RECONCILIATION },
      { label: "Email Templates", to: ROUTES.EMAIL_TEMPLATES },
      { label: "Email Delivery", to: ROUTES.EMAIL_DELIVERY },
      { label: "Audit Logs", to: ROUTES.AUDIT_LOGS },
    ]);
  });

  it("deduplicates and sorts section links", () => {
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
      { label: "Alpha", to: "/sections/section-1", state: homeSectionState },
      { label: "Zulu", to: "/sections/section-2", state: homeSectionState },
    ]);
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
