import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import {
  getOrganiserGuestEvent, getAnnouncementAudienceSection, getAnnouncementAttendeeBookings,
  getAnnouncementAttendeeOrders, listOrganiserGuests, getAnnouncementContactUsers,
  getSectionAnnouncementOptOutsPaged, getAnnouncementEmailOptOuts,
} from "@dataconnect/admin-generated";
import { requireString, validateUUID } from "./helpers";
import { announcementEmailOptOutId } from "./announcementEmailOptOut";
import type { AnnouncementAudienceRecipient } from "./announcementRecipients";
import { attendeePaymentState, emptyEventAttendeeTicketFilters, filterEventAttendeeTicketRows,
  type EventAttendeeTicketFilters, type FilterableAttendee } from "./shared/attendeeFilters";

export interface EventAnnouncementSelection { eventId: string; filters: EventAttendeeTicketFilters }
export function parseEventAnnouncementSelection(value: unknown): EventAnnouncementSelection | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpsError("invalid-argument", "Invalid event audience");
  const input = value as Record<string, unknown>;
  const eventId = validateUUID(requireString(input.eventId, "eventId"), "eventId");
  if (!input.filters || typeof input.filters !== "object" || Array.isArray(input.filters)) throw new HttpsError("invalid-argument", "Invalid attendee filters");
  const supplied = input.filters as Record<string, unknown>;
  const filters = { ...emptyEventAttendeeTicketFilters };
  if (Object.keys(supplied).some((key) => !Object.prototype.hasOwnProperty.call(filters, key))) throw new HttpsError("invalid-argument", "Unknown attendee filter");
  for (const key of Object.keys(filters) as Array<keyof EventAttendeeTicketFilters>) {
    const filter = supplied[key] ?? "";
    if (typeof filter !== "string" || filter.length > 200) throw new HttpsError("invalid-argument", "Invalid attendee filter");
    filters[key] = filter.trim();
  }
  return { eventId, filters };
}

async function pages<T>(fetch: (offset: number) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await fetch(offset);
    result.push(...page);
    if (page.length < 500) return result;
  }
}
const emailKey = (email: string) => email.trim().toLowerCase();
const usableEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
type Contact = AnnouncementAudienceRecipient & { emailContact?: boolean };
type Row = FilterableAttendee & { key: string; contact: Contact };
export interface EventAnnouncementPreview {
  eventTitle: string; fingerprint: string; matchedTicketCount: number;
  recipients: Array<{ name: string; email: string }>;
  skipped: Array<{ name: string; email: string; reason: string }>;
}

export async function resolveEventAnnouncementAudience(sectionId: string, selection: EventAnnouncementSelection) {
  const { eventId, filters } = selection;
  const event = (await getOrganiserGuestEvent({ eventId })).data.event;
  if (!event || event.section.id.replace(/-/g, "").toLowerCase() !== sectionId.replace(/-/g, "").toLowerCase()) {
    throw new HttpsError("not-found", "Event not found in this section");
  }
  const [section, bookings, orders, guests, sectionOptOuts] = await Promise.all([
    getAnnouncementAudienceSection({ sectionId }),
    pages(async (offset) => (await getAnnouncementAttendeeBookings({ eventId, offset })).data.bookings),
    pages(async (offset) => (await getAnnouncementAttendeeOrders({ eventId, offset })).data.ticketOrders),
    pages(async (offset) => (await listOrganiserGuests({ eventId, offset })).data.organiserGuests),
    pages(async (offset) => (await getSectionAnnouncementOptOutsPaged({ sectionId, limit: 500, offset })).data.sectionAnnouncementOptOuts),
  ]);
  const latest = new Map<string, typeof bookings[number]>();
  for (const booking of bookings) {
    if ((latest.get(booking.revisionGroupId)?.revisionNumber ?? -1) < booking.revisionNumber) latest.set(booking.revisionGroupId, booking);
  }
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const rows: Row[] = [...latest.values()].flatMap((booking) => booking.lines
    .filter((line) => !line.bookingPlace.attendanceRemoved)
    .map((line): Row => {
      const member = line.ticketType.audience === "MEMBER";
      const person = member ? booking.booker : line.guestUser;
      const contact = person && usableEmail(person.email) ? person : booking.booker;
      const ticket = line.bookingPlace.attendanceTicketType ?? line.ticketType;
      const name = member ? `${booking.booker.firstName} ${booking.booker.lastName}`.trim()
        : line.guestDisplayName?.trim() || (person ? `${person.firstName} ${person.lastName}`.trim() : "Guest");
      return { key: line.id, attendeeName: line.bookingPlace.attendanceName ?? name,
        rank: person?.rank?.trim() || null, membershipStatus: person?.membershipStatus ?? null,
        audience: line.ticketType.audience, ticketType: ticket.title,
        includesDinner: ticket.includesDinner, includesSymposium: ticket.includesSymposium,
        accommodationRequested: line.bookingPlace.attendanceAccommodationRequested ?? booking.accommodationRequested,
        approvalStatus: booking.approvalStatus, paymentState: attendeePaymentState(line, orderMap), contact };
    }));
  for (const guest of guests) {
    if (guest.cancelledAt) continue;
    const ticket = guest.standardTicketType ?? guest.ticketType;
    rows.push({ key: guest.id, attendeeName: `${guest.firstName} ${guest.lastName}`,
      rank: null, membershipStatus: null, audience: "ORGANISER_GUEST",
      ticketType: `${ticket?.title ?? "Guest"} (organiser guest)`, includesDinner: guest.includesDinner,
      includesSymposium: guest.includesSymposium, accommodationRequested: guest.accommodationRequested,
      approvalStatus: "NOT_REQUIRED", paymentState: guest.paidAt && guest.refundedAmountMinor >= guest.priceMinor ? "REFUNDED"
        : guest.refundPendingMinor > 0 ? "REFUND_PENDING" : guest.paidAt ? guest.refundedAmountMinor > 0 ? "PARTIALLY_REFUNDED" : "PAID"
          : guest.priceMinor === 0 ? "FREE" : "UNPAID",
      contact: { id: `organiser-guest:${guest.id}`, firstName: guest.firstName, lastName: guest.lastName,
        email: guest.email ?? "", serviceNumber: "", membershipStatus: "", emailContact: true } });
  }
  const matching = filterEventAttendeeTicketRows(rows, filters);
  const missing = matching.filter((row) => !usableEmail(row.contact.email));
  const contacts = new Map<string, Contact>();
  // Prefer a member identity when a member and a guest share a contact address.
  for (const { contact } of matching) {
    const key = emailKey(contact.email);
    if (usableEmail(key) && (!contacts.has(key) || contacts.get(key)?.emailContact)) contacts.set(key, { ...contact, email: key });
  }
  const emails = [...contacts.keys()].sort();
  const optedOutIds = new Set(sectionOptOuts.map((row) => row.user.id));
  const optedOutEmails = new Set<string>();
  for (let index = 0; index < emails.length; index += 100) {
    const batch = emails.slice(index, index + 100);
    const pattern = `(?i)^\\s*(${batch.map((email) => email.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})\\s*$`;
    const users = await pages(async (offset) => (await getAnnouncementContactUsers({ pattern, offset })).data.users);
    const emailOptOuts = (await getAnnouncementEmailOptOuts({ ids: batch.map((email) => announcementEmailOptOutId(sectionId, email)) })).data.announcementEmailOptOuts;
    const hashes = new Set(emailOptOuts.map((row) => row.id));
    for (const email of batch) if (hashes.has(announcementEmailOptOutId(sectionId, email))) optedOutEmails.add(email);
    for (const user of users) {
      const key = emailKey(user.email);
      if (user.announcementOptOutAll || optedOutIds.has(user.id)) optedOutEmails.add(key);
      if (contacts.get(key)?.emailContact) contacts.set(key, { ...user, email: key });
    }
  }
  const deliverable: Contact[] = [];
  const skippedRecipients: Array<{ userId: string; firstName: string; lastName: string; email: string; reason: string }> = [];
  for (const email of emails) {
    const contact = contacts.get(email)!;
    if (contact.announcementOptOutAll || optedOutIds.has(contact.id) || optedOutEmails.has(email)) {
      skippedRecipients.push({ userId: contact.id, firstName: contact.firstName, lastName: contact.lastName, email, reason: "opted_out" });
    } else deliverable.push(contact);
  }
  for (const row of missing) skippedRecipients.push({ userId: `missing:${row.key}`, firstName: row.attendeeName, lastName: "", email: "", reason: "missing_contact" });
  skippedRecipients.sort((a, b) => a.userId.localeCompare(b.userId));
  const fingerprint = createHash("sha256").update(JSON.stringify({ selection, deliverable, skippedRecipients, matchedTicketCount: matching.length })).digest("hex");
  const preview: EventAnnouncementPreview = { eventTitle: event.title, fingerprint, matchedTicketCount: matching.length,
    recipients: deliverable.map((r) => ({ name: `${r.firstName} ${r.lastName}`.trim(), email: r.email })),
    skipped: skippedRecipients.map((r) => ({ name: `${r.firstName} ${r.lastName}`.trim(), email: r.email, reason: r.reason })) };
  const labels: Record<keyof EventAttendeeTicketFilters, string> = {
    attendeeName: "Attendee", rank: "Rank", membershipStatus: "Membership", audience: "Audience", ticketType: "Ticket",
    includesDinner: "Dinner", includesSymposium: "Symposium", accommodationRequested: "Accommodation",
    approvalStatus: "Approval", paymentState: "Payment",
  };
  const applied = (Object.keys(filters) as Array<keyof EventAttendeeTicketFilters>).filter((key) => filters[key])
    .map((key) => `${labels[key]}: ${filters[key].replace(/_/g, " ")}`).join(", ");
  return { deliverable, skippedRecipients, preview, sectionName: section.data.section?.name ?? sectionId,
    audienceSummary: `${event.title} — current attendees${applied ? ` (${applied})` : " (all)"}` };
}
