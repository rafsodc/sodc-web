import { describe, it, expect } from "vitest";
import { buildAnnouncementReference, parseAnnouncementReference } from "../announcementReference";

const sendId = "11111111-1111-4111-8111-111111111111";
const recipientId = "22222222-2222-4222-8222-222222222222";

describe("announcementReference", () => {
  it("round-trips sendId and recipientId through build/parse", () => {
    const reference = buildAnnouncementReference(sendId, recipientId);
    expect(parseAnnouncementReference(reference)).toEqual({ sendId, recipientId });
  });

  it("returns null for undefined/empty references", () => {
    expect(parseAnnouncementReference(undefined)).toBeNull();
    expect(parseAnnouncementReference(null)).toBeNull();
    expect(parseAnnouncementReference("")).toBeNull();
  });

  it("returns null for references from other transactional emails sharing the same webhook", () => {
    expect(parseAnnouncementReference("booking-confirmation-abc123")).toBeNull();
    expect(parseAnnouncementReference("guest-ticket-request-xyz")).toBeNull();
  });

  it("returns null for a malformed announcement reference missing a segment", () => {
    expect(parseAnnouncementReference("announcement:onlyOnePart")).toBeNull();
    expect(parseAnnouncementReference("announcement:")).toBeNull();
  });
});
