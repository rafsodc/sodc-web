import { describe, expect, it } from "vitest";
import {
  getDefaultSectionDetailTab,
  getSectionDetailTabs,
  sectionDetailTabLabel,
} from "../sectionDetailTabs";

describe("sectionDetailTabs", () => {
  it("returns About and Members tabs for member sections", () => {
    expect(getSectionDetailTabs(true)).toEqual(["about", "members"]);
    expect(getDefaultSectionDetailTab(true)).toBe("members");
  });

  it("returns About and Events tabs for event sections", () => {
    expect(getSectionDetailTabs(false)).toEqual(["about", "events"]);
    expect(getDefaultSectionDetailTab(false)).toBe("events");
  });

  it("maps tab ids to labels", () => {
    expect(sectionDetailTabLabel("about")).toBe("About");
    expect(sectionDetailTabLabel("events")).toBe("Events");
    expect(sectionDetailTabLabel("members")).toBe("Members");
  });
});
