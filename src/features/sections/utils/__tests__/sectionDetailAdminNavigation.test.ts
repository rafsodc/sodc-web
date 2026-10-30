import { describe, expect, it } from "vitest";
import { getSectionAdminDestination } from "../sectionDetailAdminNavigation";
describe("getSectionAdminDestination", () => {
  it("links the section to its canonical management hub", () => {
    expect(getSectionAdminDestination({id:"section-1",name:"Members",type:"MEMBERS"},true,null)).toEqual({to:"/sections/section-1/manage",state:undefined});
  });
  it("keeps the selected event in the management URL", () => {
    expect(getSectionAdminDestination({id:"section-2",name:"Events",type:"EVENTS"},false,"event-1")).toEqual({to:"/sections/section-2/manage/events/event-1",state:undefined});
  });
});
