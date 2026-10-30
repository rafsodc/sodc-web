import { describe, expect, it } from "vitest";
import {
  eventEditorPath,
  eventManagementPath,
  memberEventPath,
  readEventManagementTask,
  readMemberEventTab,
  sectionConfigurationPath,
  sectionManagementPath,
  sectionPath,
  ticketEditorPath,
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
  it("uses overview as the default while keeping details explicitly linkable", () => {
    expect(eventManagementPath("section", "event")).toBe(
      "/sections/section/manage/events/event",
    );
    expect(eventManagementPath("section", "event", "overview")).toBe(
      "/sections/section/manage/events/event",
    );
    expect(eventManagementPath("section", "event", "details")).toBe(
      "/sections/section/manage/events/event?task=details",
    );
    expect(readEventManagementTask("")).toBe("overview");
    expect(readEventManagementTask("?task=")).toBe("overview");
  });
  it("builds editor links with an explicit task and encoded identifiers", () => {
    expect(eventEditorPath("section/a", "event?b")).toBe(
      "/sections/section%2Fa/manage/events/event%3Fb?task=details&edit=event",
    );
    expect(eventEditorPath("section/a")).toBe(
      "/sections/section%2Fa/manage/events?edit=new-event",
    );
    expect(ticketEditorPath("section", "event", "ticket&id=other")).toBe(
      "/sections/section/manage/events/event?task=tickets&ticket=ticket%26id%3Dother",
    );
    expect(ticketEditorPath("section", "event")).toBe(
      "/sections/section/manage/events/event?task=tickets&ticket=new",
    );
  });
  it("recognises new tasks and every valid legacy task token", () => {
    for (const task of [
      "overview", "details", "tickets", "approvals", "attendees", "guests",
      "removed", "activity", "payments", "communications", "announcement",
    ]) {
      expect(readEventManagementTask(`?task=${task}`)).toBe(task);
    }
    expect(readEventManagementTask("?task=announcement&audience.audience=MEMBER")).toBe(
      "announcement",
    );
  });
  it("normalizes UUIDs before encoding resource identifiers", () => {
    expect(eventManagementPath(
      "56ABE1857FBD47438C46A0061B3D2F5A",
      "90AB98A4523244488C018AE0111156AF",
      "communications",
    )).toBe(
      "/sections/56abe185-7fbd-4743-8c46-a0061b3d2f5a/manage/events/90ab98a4-5232-4448-8c01-8ae0111156af?task=communications",
    );
  });
  it("admits only known task and tab selectors", () => {
    expect(readEventManagementTask("?task=payments")).toBe("payments");
    expect(readEventManagementTask("?task=../../admin/users")).toBe("overview");
    expect(readMemberEventTab("?tab=attendees")).toBe("attendees");
    expect(readMemberEventTab("?tab=unknown")).toBe("about");
  });
});
