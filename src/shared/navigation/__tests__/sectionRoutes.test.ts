import { describe, expect, it } from "vitest";
import {
  eventManagementPath,
  memberEventPath,
  readEventManagementTask,
  readMemberEventTab,
  sectionConfigurationPath,
  sectionManagementPath,
  sectionPath,
} from "../sectionRoutes";
describe("canonical section routes", () => {
  it("encodes every resource ID as a single path segment", () => {
    expect(sectionPath("a/b?c")).toBe("/sections/a%2Fb%3Fc");
    expect(memberEventPath("a", "b/c", "book")).toBe(
      "/sections/a/events/b%2Fc?tab=book",
    );
    expect(eventManagementPath("a", "b", "approvals")).toBe(
      "/sections/a/manage/events/b?task=approvals",
    );
    expect(sectionManagementPath("a", "files")).toBe(
      "/sections/a/manage/files",
    );
    expect(sectionConfigurationPath("a/b")).toBe(
      "/admin/sections?section=a%2Fb",
    );
  });
  it("admits only known task and tab selectors", () => {
    expect(readEventManagementTask("?task=payments")).toBe("payments");
    expect(readEventManagementTask("?task=../../admin/users")).toBe("details");
    expect(readMemberEventTab("?tab=attendees")).toBe("attendees");
    expect(readMemberEventTab("?tab=unknown")).toBe("about");
  });
});
