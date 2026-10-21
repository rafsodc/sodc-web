import { afterEach, describe, expect, it, vi } from "vitest";
import * as dc from "@dataconnect/admin-generated";
import { legacyStaffEventMatchesMode, hasLegacyPrivilegedNotificationEvent } from "../../privilegedNotificationLegacy";
import { STAFF_BOOKING_ID } from "./notificationTestRepository";

afterEach(() => vi.restoreAllMocks());
describe("legacy staff event cutover", () => {
  it.each(["LIVE", "TEAM_TEST", "SIMULATION"] as const)("respects the recorded %s delivery mode", (mode) => {
    for (const current of ["LIVE", "TEAM_TEST", "SIMULATION"] as const) {
      expect(legacyStaffEventMatchesMode({ deliveryKey: "old", deliveryMode: mode }, current)).toBe(mode === current);
      expect(legacyStaffEventMatchesMode({ deliveryKey: "old", recoveryPayload: JSON.stringify({ deliveryMode: mode }) }, current)).toBe(mode === current);
      expect(legacyStaffEventMatchesMode({ deliveryKey: `old:notify-${mode.toLowerCase()}` }, current)).toBe(mode === current);
    }
  });
  it.each([null, "malformed", "{}"])("conservatively fences all modes for an unscoped/unreadable old event", (recoveryPayload) => {
    expect(legacyStaffEventMatchesMode({ deliveryKey: "old", recoveryPayload }, "SIMULATION")).toBe(true);
    expect(legacyStaffEventMatchesMode({ deliveryKey: "old", recoveryPayload }, "LIVE")).toBe(true);
  });
  it("fences contradictory historical mode evidence instead of replaying the event", () => {
    const row = { deliveryKey: "old:notify-simulation", deliveryMode: "LIVE" };
    for (const mode of ["LIVE", "TEAM_TEST", "SIMULATION"] as const) expect(legacyStaffEventMatchesMode(row, mode)).toBe(true);
  });
  it("uses the booking subject and every legacy state, not the current staff address", async () => {
    const query = vi.spyOn(dc, "listLegacyBookingStaffNotificationDeliveries").mockResolvedValue({ data: {
      notificationDeliveries: [{ deliveryKey: "old:notify-live", recoveryPayload: null }] } } as never);
    expect(await hasLegacyPrivilegedNotificationEvent({ kind: "BOOKING", bookingId: STAFF_BOOKING_ID }, "LIVE")).toBe(true);
    expect(query).toHaveBeenCalledWith({ bookingId: STAFF_BOOKING_ID });
    expect(await hasLegacyPrivilegedNotificationEvent({ kind: "BOOKING", bookingId: STAFF_BOOKING_ID }, "SIMULATION")).toBe(false);
  });
  it("uses the applicant subject independently of the recipient UID", async () => {
    const query = vi.spyOn(dc, "listLegacyApplicantStaffNotificationDeliveries").mockResolvedValue({ data: { notificationDeliveries: [] } } as never);
    expect(await hasLegacyPrivilegedNotificationEvent({ kind: "APPLICANT", subjectUserId: "applicant" }, "LIVE")).toBe(false);
    expect(query).toHaveBeenCalledWith({ subjectUserId: "applicant" });
  });
  it("does not reinterpret lookup outages or truncated results as an empty legacy history", async () => {
    const query = vi.spyOn(dc, "listLegacyApplicantStaffNotificationDeliveries").mockRejectedValue(new Error("private db error"));
    await expect(hasLegacyPrivilegedNotificationEvent({ kind: "APPLICANT", subjectUserId: "applicant" }, "LIVE"))
      .rejects.toMatchObject({ code: "LEGACY_NOTIFICATION_LOOKUP_FAILED" });
    query.mockResolvedValueOnce({ data: { notificationDeliveries: Array.from({ length: 1000 }, () => ({ deliveryKey: "old" })) } } as never);
    await expect(hasLegacyPrivilegedNotificationEvent({ kind: "APPLICANT", subjectUserId: "applicant" }, "LIVE"))
      .rejects.toMatchObject({ code: "LEGACY_NOTIFICATION_LOOKUP_LIMIT" });
  });
});
