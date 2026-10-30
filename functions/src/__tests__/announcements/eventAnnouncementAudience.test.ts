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
const resolveBookers = (filters = {}) => resolveEventAnnouncementAudience(sectionId, { eventId, filters: { ...emptyEventAttendeeTicketFilters, ...filters }, recipientTarget: "BOOKERS" });

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
  it("keeps the same fingerprint when Data Connect returns contact properties in a different order", async () => {
    const b = booking("member");
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    const original = await resolve();
    const reordered = Object.fromEntries(Object.entries(b.booker).reverse());
    bookings.mockResolvedValue({ data: { bookings: [{ ...b, booker: reordered }] } } as never);
    const next = await resolve();
    expect(next.preview.recipients).toEqual(original.preview.recipients);
    expect(next.preview.fingerprint).toBe(original.preview.fingerprint);
  });
  it("keeps shared-email contact selection stable when ticket rows are reordered", async () => {
    const b = booking("member");
    b.lines = [line("a", "GUEST", person("guest-a", "shared@example.com")), line("b", "GUEST", person("guest-b", "shared@example.com"))];
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    const original = await resolve();
    b.lines.reverse();
    const next = await resolve();
    expect(next.preview.fingerprint).toBe(original.preview.fingerprint);
    expect(next.preview.recipients).toEqual(original.preview.recipients);
  });
  it.each(["email", "firstName", "serviceNumber", "membershipStatus"] as const)("requires a new preview when contact %s changes", async (field) => {
    const b = booking("member");
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    const original = await resolve();
    b.booker[field] = field === "email" ? "new@example.com" : "Changed";
    expect((await resolve()).preview.fingerprint).not.toBe(original.preview.fingerprint);
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
  it("keeps the legacy fingerprint and normalizes explicit ATTENDEES to the original snapshot shape", async () => {
    bookings.mockResolvedValue({ data: { bookings: [booking("member")] } } as never);
    expect((await resolve()).preview.fingerprint).toBe("9116fb05503714b3e4708a22670b871f0a1034a574199335a794019a4ac3b031");
    const original = { eventId, filters: { ...emptyEventAttendeeTicketFilters } };
    expect(JSON.stringify(parseEventAnnouncementSelection(original))).toBe(JSON.stringify(original));
    expect(parseEventAnnouncementSelection({ ...original, recipientTarget: "ATTENDEES" })).toEqual(original);
    expect(parseEventAnnouncementSelection({ ...original, recipientTarget: "ATTENDEES" })).not.toHaveProperty("recipientTarget");
    expect(parseEventAnnouncementSelection({ ...original, recipientTarget: "BOOKERS" })).toEqual({ ...original, recipientTarget: "BOOKERS" });
    for (const recipientTarget of ["GUESTS", "bookers", "", null, false, [], {}]) {
      expect(() => parseEventAnnouncementSelection({ ...original, recipientTarget })).toThrow(expect.objectContaining({ code: "invalid-argument" }));
    }
  });
  it("contacts the owner for an unpaid linked guest even when the member ticket is paid", async () => {
    const b = { ...booking("owner"), lines: [
      { ...line("member"), bookingPlace: { ...line("member").bookingPlace, paymentAllocations: [{ ticketOrderId: "paid", allocatedAmountMinor: 1000, refundedAmountMinor: 0 }] } },
      line("linked", "GUEST", person("different-guest")),
    ] };
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    vi.mocked(admin.getAnnouncementAttendeeOrders).mockResolvedValue({ data: { ticketOrders: [{ id: "paid", status: "PAID" }] } } as never);
    expect((await resolve({ paymentState: "UNPAID" })).deliverable.map(r => r.email)).toEqual(["different-guest@example.com"]);
    const result = await resolveBookers({ paymentState: "UNPAID" });
    expect(result.preview.matchedTicketCount).toBe(1);
    expect(result.deliverable.map(r => r.email)).toEqual(["owner@example.com"]);
    expect(result.audienceSummary).toBe("Dinner 2026 — booking owners for current attendees (Payment: UNPAID)");
  });
  it("deduplicates owners across matching member and guest tickets and excludes organiser guests", async () => {
    const b = booking("owner");
    b.lines.push(line("guest-one", "GUEST", person("guest-one")), line("guest-two", "GUEST", person("guest-two")));
    bookings.mockResolvedValue({ data: { bookings: [b, booking("second-booking", person("owner"))] } } as never);
    guests.mockResolvedValue({ data: { organiserGuests: [{ ...guest("unpaid-organiser"), priceMinor: 1000 }] } } as never);
    const result = await resolveBookers({ paymentState: "UNPAID" });
    expect(result.preview.matchedTicketCount).toBe(4);
    expect(result.deliverable.map(r => r.email)).toEqual(["owner@example.com"]);
    expect(guests).not.toHaveBeenCalled();
  });
  it("does not substitute a guest address when the owner has no usable email", async () => {
    const b = { ...booking("owner", person("owner", "invalid-address")), lines: [line("linked", "GUEST", person("usable-guest"))] };
    bookings.mockResolvedValue({ data: { bookings: [b] } } as never);
    const result = await resolveBookers({ paymentState: "UNPAID" });
    expect(result.deliverable).toEqual([]);
    expect(result.preview.skipped).toEqual([{ name: "owner Smith", email: "", reason: "missing_contact" }]);
    expect(result.skippedRecipients[0].userId).toBe("missing:linked");
  });
  it("keeps latest revision, removed-place and exact payment filters for owners", async () => {
    const previous = booking("stale-owner");
    const latest = { ...previous, revisionNumber: 2, booker: person("current-owner"), lines: [
      line("unpaid", "GUEST", person("guest")),
      { ...line("partial"), bookingPlace: { ...line("partial").bookingPlace, paymentAllocations: [{ ticketOrderId: "paid", allocatedAmountMinor: 500, refundedAmountMinor: 0 }] } },
      { ...line("pending"), bookingPlace: { ...line("pending").bookingPlace, paymentAllocations: [{ ticketOrderId: "pending", allocatedAmountMinor: 1000, refundedAmountMinor: 0 }] } },
      { ...line("removed"), bookingPlace: { ...line("removed").bookingPlace, attendanceRemoved: true } },
    ] };
    bookings.mockResolvedValue({ data: { bookings: [previous, latest] } } as never);
    vi.mocked(admin.getAnnouncementAttendeeOrders).mockResolvedValue({ data: { ticketOrders: [{ id: "paid", status: "PAID" }, { id: "pending", status: "PENDING" }] } } as never);
    const result = await resolveBookers({ paymentState: "UNPAID" });
    expect(result.preview.matchedTicketCount).toBe(1);
    expect(result.deliverable.map(r => r.email)).toEqual(["current-owner@example.com"]);
    expect((await resolveBookers({ paymentState: "PARTIALLY_PAID" })).preview.matchedTicketCount).toBe(1);
    expect((await resolveBookers({ paymentState: "PAYMENT_PENDING" })).preview.matchedTicketCount).toBe(1);
    expect((await resolveBookers()).preview.matchedTicketCount).toBe(3);
  });
  it("fingerprints the owner target even for identical contacts and retains section authority", async () => {
    bookings.mockResolvedValue({ data: { bookings: [booking("member")] } } as never);
    const attendeeResult = await resolve();
    const bookerResult = await resolveBookers();
    expect(bookerResult.preview.recipients).toEqual(attendeeResult.preview.recipients);
    expect(bookerResult.preview.fingerprint).not.toBe(attendeeResult.preview.fingerprint);
    event.mockResolvedValue({ data: { event: { section: { id: eventId } } } } as never);
    bookings.mockClear();
    await expect(resolveBookers()).rejects.toMatchObject({ code: "not-found" });
    expect(bookings).not.toHaveBeenCalled();
  });
  it("normalizes selection and rejects malformed filters", () => {
    expect(parseEventAnnouncementSelection({ eventId: eventId.replaceAll("-", ""), filters: { rank: " Sqn Ldr " } })).toEqual({ eventId, filters: { ...emptyEventAttendeeTicketFilters, rank: "Sqn Ldr" } });
    for (const value of [null, [], { eventId, filters: { unknown: "YES" } }, { eventId, filters: { rank: false } }, { eventId: "bad", filters: {} }]) expect(() => parseEventAnnouncementSelection(value)).toThrow();
    expect(parseEventAnnouncementSelection(undefined)).toBeUndefined();
  });
});
