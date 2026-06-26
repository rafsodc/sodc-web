import { describe, expect, it } from "vitest";
import { ROUTES } from "../../../constants";
import { getSectionReturnTo, sectionDetailLocationState } from "../sectionNavigationState";

describe("sectionNavigationState", () => {
  it("defaults section back navigation to the sections list", () => {
    expect(getSectionReturnTo(null)).toBe(ROUTES.SECTIONS);
    expect(getSectionReturnTo({})).toBe(ROUTES.SECTIONS);
  });

  it("reads the configured return route from location state", () => {
    expect(getSectionReturnTo(sectionDetailLocationState(ROUTES.HOME))).toBe(ROUTES.HOME);
    expect(getSectionReturnTo(sectionDetailLocationState(ROUTES.SECTIONS))).toBe(ROUTES.SECTIONS);
  });

  it("can include a selected event id for deep links", () => {
    expect(sectionDetailLocationState(ROUTES.HOME, { selectedEventId: "event-1" })).toEqual({
      sectionReturnTo: ROUTES.HOME,
      selectedEventId: "event-1",
    });
  });

  it("ignores unknown return routes", () => {
    expect(getSectionReturnTo({ sectionReturnTo: "/elsewhere" })).toBe(ROUTES.SECTIONS);
  });
});
