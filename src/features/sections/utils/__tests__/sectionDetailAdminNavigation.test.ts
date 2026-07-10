import { describe, expect, it } from "vitest";
import { ROUTES } from "../../../../constants";
import { getSectionAdminDestination } from "../sectionDetailAdminNavigation";

describe("getSectionAdminDestination", () => {
  it("routes member sections to the section admin hub", () => {
    expect(
      getSectionAdminDestination({ id: "section-1", name: "Members", type: "MEMBERS" }, true, null)
    ).toEqual({
      to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-1"),
      state: { sectionName: "Members", sectionType: "MEMBERS" },
    });
  });

  it("routes event sections to the section admin hub", () => {
    expect(
      getSectionAdminDestination({ id: "section-2", name: "Events", type: "EVENTS" }, false, "event-1")
    ).toEqual({
      to: ROUTES.SECTION_ADMIN.replace(":sectionId", "section-2"),
      state: { sectionName: "Events", sectionType: "EVENTS" },
    });
  });
});
