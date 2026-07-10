import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { getAnnouncementSendRecipients } from "../announcements";

const mockGetAnnouncementSendById = vi.spyOn(admin, "getAnnouncementSendById");
const mockGetAnnouncementSendRecipients = vi.spyOn(admin, "getAnnouncementSendRecipients");

const sectionAId = "00000000-0000-4000-8000-00000000000a";
const sectionBId = "00000000-0000-4000-8000-00000000000b";
const sendIdForSectionB = "00000000-0000-4000-8000-0000000000b1";

function callAsAdmin(data: Record<string, unknown>) {
  return getAnnouncementSendRecipients.run({
    auth: { uid: "admin-1", token: { admin: true } },
    data,
  } as unknown as Parameters<typeof getAnnouncementSendRecipients.run>[0]);
}

describe("getAnnouncementSendRecipients", () => {
  beforeEach(() => {
    mockGetAnnouncementSendById.mockReset();
    mockGetAnnouncementSendRecipients.mockReset();
  });

  it("rejects a sendId that belongs to a different section than the one the caller was authorized for", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);

    await expect(
      callAsAdmin({ sectionId: sectionAId, sendId: sendIdForSectionB })
    ).rejects.toMatchObject({ code: "not-found" });

    expect(mockGetAnnouncementSendRecipients).not.toHaveBeenCalled();
  });

  it("returns recipients when the sendId belongs to the authorized section", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);
    mockGetAnnouncementSendRecipients.mockResolvedValue({
      data: {
        announcementRecipients: [
          {
            id: "recipient-1",
            userId: "user-1",
            email: "user1@example.com",
            firstName: "First",
            lastName: "Last",
            status: "sent",
            skippedReason: null,
            sentAt: "2026-01-01T00:00:00Z",
            failureReason: null,
          },
        ],
      },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendRecipients>>);

    const result = await callAsAdmin({ sectionId: sectionBId, sendId: sendIdForSectionB });

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].email).toBe("user1@example.com");
  });

  it("rejects when the send does not exist", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: undefined },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);

    await expect(
      callAsAdmin({ sectionId: sectionAId, sendId: "00000000-0000-4000-8000-000000000000" })
    ).rejects.toMatchObject({ code: "not-found" });
  });
});
