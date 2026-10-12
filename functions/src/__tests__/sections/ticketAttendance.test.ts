import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "@dataconnect/admin-generated";
import { HttpsError } from "firebase-functions/v2/https";
import { manageTicketAttendance, getManagedEventTickets } from "../../ticketAttendance";
import { requireSectionModerator } from "../../sectionAccess";
import { readFileSync } from "node:fs";

vi.mock("../../rateLimiter", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("../../sectionAccess", () => ({ requireSectionModerator: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const read = vi.spyOn(db, "getTicketAttendanceForManagement");
const ticket = vi.spyOn(db, "getAttendanceTicketType");
const write = vi.spyOn(db, "updateTicketAttendance");
const list = vi.spyOn(db, "listEventBookingsForAdmin");
const line = () => ({ id, ticketType: { audience: "MEMBER" }, bookingPlace: { id, attendanceVersion: 0, attendanceRemoved: false }, booking: { id, status: "CONFIRMED", approvalStatus: "APPROVED", supersededAt: null, event: { id, section: { id } } } });
function request(data = {}, token: Record<string, unknown> = { enabled: true }) {
  return { auth: { uid: "organiser", token }, data: { id, eventId: id, action: "edit", version: 0, ticketTypeId: other, attendeeName: "Updated attendee", dietaryNote: "Vegetarian", ...data } } as Parameters<typeof manageTicketAttendance.run>[0];
}
beforeEach(() => {
  vi.resetAllMocks();
  read.mockResolvedValue({ data: { bookingLine: line() } } as never);
  ticket.mockResolvedValue({ data: { ticketType: { id: other, audience: "MEMBER", event: { id } } } } as never);
  write.mockResolvedValue({} as never);
});
describe("attendance-only ticket management", () => {
  it.each(["edit", "delete"])("%s changes only attendance and preserves the booking/place identity", async (action) => {
    expect(await manageTicketAttendance.run(request({ action }))).toEqual({ success: true });
    expect(requireSectionModerator).toHaveBeenCalledWith(id, "organiser", false);
    expect(write).toHaveBeenCalledWith({ accommodationRequested: null, accommodationNote: null, sitNextToUserIds: null, bookingId: id, placeId: id, version: 0, ticketTypeId: other, name: "Updated attendee", dietaryNote: "Vegetarian", removed: action === "delete", actor: "organiser" });
  });
  it("updates per-ticket preferences and preserves explicit clearing", async () => {
    await manageTicketAttendance.run(request({ accommodationRequested: false, accommodationNote: "", sitNextToUserIds: [] }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ accommodationRequested: false, accommodationNote: "", sitNextToUserIds: [] }));
  });
  it("preserves preferences when an older client omits them or deletes a ticket", async () => {
    const current = line();
    Object.assign(current.bookingPlace, { attendanceAccommodationRequested: true, attendanceAccommodationNote: "Room", attendanceSitNextToUserIds: ["Friend"] });
    read.mockResolvedValue({ data: { bookingLine: current } } as never);
    await manageTicketAttendance.run(request());
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ accommodationRequested: true, accommodationNote: "Room", sitNextToUserIds: ["Friend"] }));
    await manageTicketAttendance.run(request({ action: "delete", accommodationRequested: false }));
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ accommodationRequested: true, removed: true }));
  });
  it("supports admins and compact UUIDs returned by Data Connect", async () => {
    const current = line(); current.booking.event.id = id.replaceAll("-", "");
    read.mockResolvedValue({ data: { bookingLine: current } } as never);
    await manageTicketAttendance.run(request({}, { enabled: true, admin: true }));
    expect(requireSectionModerator).toHaveBeenCalledWith(id, "organiser", true);
  });
  it.each([{ enabled: false }, {}])("rejects disabled callers %j", async (token) => {
    await expect(manageTicketAttendance.run(request({}, token))).rejects.toMatchObject({ code: "permission-denied" });
    expect(write).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated and cross-section callers", async () => {
    await expect(manageTicketAttendance.run({ data: {} } as never)).rejects.toMatchObject({ code: "unauthenticated" });
    vi.mocked(requireSectionModerator).mockRejectedValue(new HttpsError("not-found", "Resource not found"));
    await expect(manageTicketAttendance.run(request())).rejects.toMatchObject({ code: "not-found" });
    expect(write).not.toHaveBeenCalled();
  });
  it.each([{ eventId: other }, { version: 2 }, { action: "refund" }, { version: -1 }, { attendeeName: " " }, { dietaryNote: "a".repeat(2001) }])("rejects invalid or stale requests %j", async (data) => {
    await expect(manageTicketAttendance.run(request(data))).rejects.toBeDefined();
    expect(write).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "DRAFT", "superseded", "removed", "pending"])("rejects inactive tickets: %s", async (state) => {
    const current = line();
    if (state === "superseded") Object.assign(current.booking, { supersededAt: "2026-01-01" });
    else if (state === "removed") current.bookingPlace.attendanceRemoved = true;
    else if (state === "pending") current.booking.approvalStatus = "PENDING";
    else current.booking.status = state;
    read.mockResolvedValue({ data: { bookingLine: current } } as never);
    await expect(manageTicketAttendance.run(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(write).not.toHaveBeenCalled();
  });
  it.each([{ audience: "GUEST", event: { id } }, { audience: "MEMBER", event: { id: other } }])("rejects ticket types from another event or audience", async (type) => {
    ticket.mockResolvedValue({ data: { ticketType: { id: other, ...type } } } as never);
    await expect(manageTicketAttendance.run(request())).rejects.toMatchObject({ code: "invalid-argument" });
    expect(write).not.toHaveBeenCalled();
  });
  it("reports an atomic version conflict without retrying writes", async () => {
    write.mockRejectedValue(new Error("ATTENDANCE_CONFLICT"));
    await expect(manageTicketAttendance.run(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("checks moderator access before exposing the management list", async () => {
    vi.spyOn(db, "getAttendeeEventSection").mockResolvedValue({ data: { event: { section: { id } } } });
    vi.mocked(requireSectionModerator).mockRejectedValue(new HttpsError("not-found", "Resource not found"));
    await expect(getManagedEventTickets.run(request())).rejects.toMatchObject({ code: "not-found" });
    expect(list).not.toHaveBeenCalled();
  });
  it("loads tickets for an authorised moderator", async () => {
    vi.spyOn(db, "getAttendeeEventSection").mockResolvedValue({ data: { event: { section: { id } } } });
    list.mockResolvedValue({ data: { event: { bookings: [], bookingTicketOrders: [] } } } as never);
    vi.spyOn(db, "getEventById").mockResolvedValue({ data: { event: { ticketTypes: [] } } } as never);
    expect(await getManagedEventTickets.run(request())).toEqual({ seatingUsers: [], bookings: [], orders: [], ticketTypes: [] });
    expect(requireSectionModerator).toHaveBeenCalledWith(id, "organiser", false);
    expect(list).toHaveBeenCalledWith({ eventId: id });
  });
  it("resolves inherited seating names for the authorised moderator", async () => {
    vi.spyOn(db, "getAttendeeEventSection").mockResolvedValue({ data: { event: { section: { id } } } });
    list.mockResolvedValue({ data: { event: { bookings: [{ lines: [], sitNextToUserIds: ["friend", "friend"] }], bookingTicketOrders: [] } } } as never);
    vi.spyOn(db, "getEventById").mockResolvedValue({ data: { event: { ticketTypes: [] } } } as never);
    const users = [{ id: "friend", firstName: "Alex", lastName: "Member" }];
    const names = vi.spyOn(db, "listUserNamesByIds").mockResolvedValue({ data: { users } });
    expect(await getManagedEventTickets.run(request())).toMatchObject({ seatingUsers: users });
    expect(names).toHaveBeenCalledWith({ ids: ["friend"] });
  });
  it("does not load tickets for a missing event", async () => {
    vi.spyOn(db, "getAttendeeEventSection").mockResolvedValue({ data: {} });
    await expect(getManagedEventTickets.run(request())).rejects.toMatchObject({ code: "not-found" });
    expect(list).not.toHaveBeenCalled();
  });
  it("keeps attendance mutations inaccessible to clients and excludes financial writes", () => {
    const source = readFileSync("../dataconnect/api/ticket-attendance.gql", "utf8");
    expect(source.match(/@auth\(level: NO_ACCESS\)/g)).toHaveLength(4);
    expect(source).not.toMatch(/(?:ticketOrder|bookingPlacePaymentAllocation|bookingPaymentAdjustment)_(?:update|insert|delete|upsert)/);
    expect(source).not.toMatch(/priceMinor:|price:|checkoutKey:|stripeSessionId:/);
    expect(source).toContain("attendanceVersion: { eq: $version }");
    expect(source).toContain("message: \"ATTENDANCE_CONFLICT\"");
  });
});
