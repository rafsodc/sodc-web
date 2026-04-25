import { describe, expect, it } from "vitest";
import { ROUTES } from "../../../../constants";
import { getSectionAdminDestination } from "../sectionDetailAdminNavigation";

describe("getSectionAdminDestination", () => {
  it("routes member sections to the section edit dialog", () => {
    expect(
      getSectionAdminDestination({ id: "section-1", name: "Members" }, true, null)
    ).toEqual({
      to: ROUTES.MANAGE_SECTIONS,
      state: { editSectionId: "section-1" },
    });
  });

  it("routes event sections to event administration with selected event context", () => {
    expect(
      getSectionAdminDestination({ id: "section-2", name: "Events" }, false, "event-1")
    ).toEqual({
      to: ROUTES.MANAGE_SECTIONS,
      state: {
        managedSection: {
          id: "section-2",
          name: "Events",
        },
        eventId: "event-1",
      },
    });
  });
});
