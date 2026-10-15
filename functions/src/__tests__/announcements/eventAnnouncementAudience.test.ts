import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { parseEventAnnouncementSelection, resolveEventAnnouncementAudience } from "../../eventAnnouncementAudience";
import { emptyEventAttendeeTicketFilters } from "../../shared/attendeeFilters";

const eventId = "11111111-1111-4111-8111-111111111111";
const sectionId = "22222222-2222-4222-8222-222222222222";
const person = (id: string, email = `${id}@example.com`) => ({ id, email, firstName: id, lastName: "Smith", rank: "Sqn Ldr", membershipStatus: "REGULAR", serviceNumber: "123", announcementOptOutAll: false });
const line = (id: string, audience = "MEMBER", guestUser: ReturnType<typeof person> | null = null) => ({
  id, guestUser, guestDisplayName: audience === "GUEST" ? "Dinner guest" : null,
  ticketType: { title: "Dinner", audience, price: 10, includesDinner: true, includesSymposium: false },
  bookingPlace: { attendanceRemoved: false, attendanceName: null, attendanceAccommodationRequested: null, attendanceTicketType: null, paymentAllocations: [] },
});
const booking = (id: string, booker = person(id)) => ({ id, revisionGroupId: id, revisionNumber: 1, approvalStatus: "APPROVED", accommodationRequested: false, booker, lines: [line(id)] });
const guest = (id: string, email = `${id}@example.com`) => ({ id, firstName: id, lastName: "Guest", email, cancelledAt: null, accommodationRequested: false, paidAt: null, priceMinor: 0, refundedAmountMinor: 0, refundPendingMinor: 0, ticketType: { title: "VIP" }, standardTicketType: null, includesDinner: true, includesSymposium: true });
const bookings = vi.spyOn(admin, "getAnnouncementAttendeeBookings");
const guests = vi.spyOn(admin, "listOrganiserGuests");
const event = vi.spyOn(admin, "getOrganiserGuestEvent");
const sectionOptOuts = vi.spyOn(admin, "getSectionAnnouncementOptOutsPaged");
const resolve = (filters = {}) => resolveEventAnnouncementAudience(sectionId, { eventId, filters: { ...emptyEventAttendeeTicketFilters, ...filters } });

beforeEach(() => {
  vi.clearAllMocks();
  event.mockResolvedValue({ data: { event: { id: eventId, title: "Dinner 2026", section: { id: sectionId } } } } as never);
  vi.spyOn(admin, "getAnnouncementAudienceSection").mockResolvedValue({ data: { section: { name: "Signals" } } } as never);
  bookings.mockResolvedValue({ data: { bookings: [] } } as never);
  guests.mockResolvedValue({ data: { organiserGuests: [] } } as never);
  vi.spyOn(admin, "getAnnouncementAttendeeOrders").mockResolvedValue({ data: { ticketOrders: [] } } as never);
  sectionOptOuts.mockResolvedValue({ data: { sectionAnnouncementOptOuts: [] } } as never);
});

describe("event announcement audience", () => {
  it("includes unpaid bookings, linked guests and organiser guests, deduping normalized contacts", async () => {
    const b = booking("member");
    b.lines.push(line("linked", "GUEST", person("linked")), line("fallback", "GUEST"));
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    guests.mockResolvedValue({ data: { organiserGuests: [guest("vip"), guest("duplicate", " MEMBER@EXAMPLE.COM "), { ...guest("cancelled"), cancelledAt: "2026-01-01" }] } } as never);
    const result = await resolve();
    expect(result.preview.matchedTicketCount).toBe(5);
    expect(result.deliverable.map(r => r.email)).toEqual(["linked@example.com", "member@example.com", "vip@example.com"]);
  });
  it("filters ticket rows before contact resolution and intersects filters", async () => {
    const b = booking("member");
    b.lines.push(line("fallback", "GUEST"));
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    expect((await resolve({ attendeeName: "dinner guest", audience: "GUEST", includesDinner: "YES", paymentState: "UNPAID" })).deliverable.map(r => r.id)).toEqual(["member"]);
    expect((await resolve({ audience: "GUEST", includesSymposium: "YES" })).deliverable).toEqual([]);
  });
  it("keeps the latest eligible revision, honours attendance edits, and excludes removed places", async () => {
    const b = booking("member");
    const latest = { ...b, revisionNumber: 2, lines: [{ ...line("new"), bookingPlace: { ...line("new").bookingPlace, attendanceName: "Edited name", attendanceAccommodationRequested: true, attendanceTicketType: { title: "Conference", includesDinner: false, includesSymposium: true } } }, { ...line("removed"), bookingPlace: { attendanceRemoved: true } }] };
    bookings.mockResolvedValue({ data: { bookings: [latest, b] } } as never);
    const result = await resolve({ attendeeName: "edited", ticketType: "conference", includesDinner: "NO", accommodationRequested: "YES" });
    expect(result.preview.matchedTicketCount).toBe(1);
    expect((await resolve()).preview.matchedTicketCount).toBe(1);
  });
  it("includes opted-out members and guest contacts without consulting section preferences", async () => {
    const global = { ...person("global"), announcementOptOutAll: true };
    const b = booking("global", global);
    b.lines.push(line("linked", "GUEST", { ...person("linked"), announcementOptOutAll: true }));
    bookings.mockResolvedValue({ data: { bookings: [b, booking("section")] } } as never);
    guests.mockResolvedValue({ data: { organiserGuests: [guest("duplicate", "global@example.com"), guest("other")] } } as never);
    sectionOptOuts.mockResolvedValue({ data: { sectionAnnouncementOptOuts: [{ user: { id: "section" } }] } } as never);
    const result = await resolve();
    expect(result.deliverable.map(r => r.email)).toEqual(["global@example.com", "linked@example.com", "other@example.com", "section@example.com"]);
    expect(result.skippedRecipients).toEqual([]);
    expect(sectionOptOuts).not.toHaveBeenCalled();
  });
  it("reports missing or invalid contacts without submitting them", async () => {
    bookings.mockResolvedValue({ data: { bookings: [booking("missing", person("missing", ""))] } } as never);
    guests.mockResolvedValue({ data: { organiserGuests: [guest("invalid", "no address")] } } as never);
    const result = await resolve();
    expect(result.deliverable).toEqual([]);
    expect(result.preview.skipped).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "missing_contact" })]));
    expect(result.skippedRecipients).toHaveLength(2);
  });
  it("pages attendees and changes the fingerprint when the audience changes", async () => {
    const all = Array.from({ length: 501 }, (_, i) => booking(String(i)));
    bookings.mockImplementation(async ({ offset }) => ({ data: { bookings: all.slice(offset, offset + 500) } }) as never);
    const result = await resolve();
    expect(result.deliverable).toHaveLength(501);
    expect(bookings).toHaveBeenCalledWith({ eventId, offset: 500 });
    expect((await resolve()).preview.fingerprint).toBe(result.preview.fingerprint);
    all.pop();
    expect((await resolve()).preview.fingerprint).not.toBe(result.preview.fingerprint);
  });
  it("checks the event belongs to the authorized section before reading contacts", async () => {
    event.mockResolvedValue({ data: { event: { section: { id: eventId } } } } as never);
    await expect(resolve()).rejects.toMatchObject({ code: "not-found" });
    expect(bookings).not.toHaveBeenCalled();
  });
  it("fails closed when audience data cannot be loaded", async () => {
    guests.mockRejectedValueOnce(new Error("unavailable"));
    await expect(resolve()).rejects.toThrow("unavailable");
  });
  it("normalizes selection and rejects malformed filters", () => {
    expect(parseEventAnnouncementSelection({ eventId: eventId.replaceAll("-", ""), filters: { rank: " Sqn Ldr " } })).toEqual({ eventId, filters: { ...emptyEventAttendeeTicketFilters, rank: "Sqn Ldr" } });
    for (const value of [null, [], { eventId, filters: { unknown: "YES" } }, { eventId, filters: { rank: false } }, { eventId: "bad", filters: {} }]) expect(() => parseEventAnnouncementSelection(value)).toThrow();
    expect(parseEventAnnouncementSelection(undefined)).toBeUndefined();
  });
});
