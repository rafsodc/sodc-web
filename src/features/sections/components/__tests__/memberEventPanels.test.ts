import { expect, it, vi } from "vitest";
import { loadEventBookingWizard, loadEventAttendees, loadEventDetailsContent, preloadMemberEventPanel } from "../memberEventPanels";

const imports = vi.hoisted(() => ({ booking: vi.fn(), attendees: vi.fn(), details: vi.fn() }));
vi.mock("../EventBookingWizard", () => { imports.booking(); return { default: () => null }; });
vi.mock("../EventAttendees", () => { imports.attendees(); throw new Error("Failed to fetch dynamically imported module"); });
vi.mock("../EventDetailsContent", () => { imports.details(); return { default: () => null }; });

it("preloads only About code and shares successful module promises with explicit panel intent", async () => {
  await preloadMemberEventPanel("about");
  const details = loadEventDetailsContent();
  expect(loadEventDetailsContent()).toBe(details);
  expect(imports.details).toHaveBeenCalledOnce();
  expect(imports.booking).not.toHaveBeenCalled();
  expect(imports.attendees).not.toHaveBeenCalled();
  const first = loadEventBookingWizard();
  const second = loadEventBookingWizard();
  expect(second).toBe(first);
  await Promise.all([first, preloadMemberEventPanel("book")]);
  expect(imports.booking).toHaveBeenCalledOnce();
  expect(imports.attendees).not.toHaveBeenCalled();
  expect(imports.details).toHaveBeenCalledOnce();
});

it("shares a rejected module promise without automatically retrying the import", async () => {
  await expect(preloadMemberEventPanel("attendees")).rejects.toThrow();
  const first = loadEventAttendees();
  expect(loadEventAttendees()).toBe(first);
  await expect(first).rejects.toThrow();
  await expect(preloadMemberEventPanel("attendees")).rejects.toThrow();
  expect(imports.attendees).toHaveBeenCalledOnce();
});
