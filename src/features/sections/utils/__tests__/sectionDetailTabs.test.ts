import { describe, expect, it } from "vitest";
import { eventDetailTabLabel } from "../sectionDetailTabs";

describe("sectionDetailTabs", () => {
  it("maps event detail tab ids to labels", () => {
    expect(eventDetailTabLabel("about")).toBe("About");
    expect(eventDetailTabLabel("book")).toBe("Book");
  });
});
