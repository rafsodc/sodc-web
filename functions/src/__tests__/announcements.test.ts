import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import {
  getAnnouncementTemplates,
  previewAnnouncementTemplate,
  sendSectionAnnouncement,
  getAnnouncementSendHistory,
  getAnnouncementSendRecipients,
  resolveAnnouncementRecipients,
  extractTemplateVariables,
  buildRecipientPersonalisation,
} from "../announcements";

const mockGetAnnouncementSendById = vi.spyOn(admin, "getAnnouncementSendById");
const mockGetAnnouncementSendRecipients = vi.spyOn(admin, "getAnnouncementSendRecipients");
const mockGetSectionById = vi.spyOn(admin, "getSectionById");
const mockGetSectionMembers = vi.spyOn(admin, "getSectionMembers");
const mockListUsers = vi.spyOn(admin, "listUsers");
const mockConsumeCallableRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const mockEnsureCallableRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");

beforeEach(() => {
  mockEnsureCallableRateLimitBucket.mockResolvedValue({ data: {} } as never);
  mockConsumeCallableRateLimit.mockResolvedValue({ data: {} } as never);
});

const sectionAId = "00000000-0000-4000-8000-00000000000a";
const sectionBId = "00000000-0000-4000-8000-00000000000b";
const sendIdForSectionB = "00000000-0000-4000-8000-0000000000b1";

function callAsAdmin(data: Record<string, unknown>) {
  return getAnnouncementSendRecipients.run({
    auth: { uid: "admin-1", token: { admin: true, enabled: true } },
    data,
  } as unknown as Parameters<typeof getAnnouncementSendRecipients.run>[0]);
}

const announcementCallables = [
  getAnnouncementTemplates,
  previewAnnouncementTemplate,
  sendSectionAnnouncement,
  getAnnouncementSendHistory,
  getAnnouncementSendRecipients,
] as const;

describe("resolveAnnouncementRecipients", () => {
  beforeEach(() => {
    mockGetSectionMembers.mockReset();
    mockListUsers.mockReset();
  });

  it("loads and merges users matching an eligible group's membership statuses", async () => {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionAId,
          name: "Signals",
          purposeLinks: [
            {
              purposes: ["ACCESS"],
              userGroup: {
                id: "regular-access",
                membershipStatuses: ["REGULAR"],
                users: [],
              },
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "status-user",
            firstName: "Status",
            lastName: "User",
            email: "status@example.com",
            serviceNumber: "S123",
            membershipStatus: "REGULAR",
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof admin.listUsers>>);

    const result = await resolveAnnouncementRecipients(sectionAId);

    expect(result.sectionName).toBe("Signals");
    expect(result.recipients.map(({ id }) => id)).toEqual(["status-user"]);
    expect(mockListUsers).toHaveBeenCalledOnce();
  });

  it("does not load all users when no eligible inherited statuses are configured", async () => {
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionAId,
          name: "Signals",
          purposeLinks: [],
        },
      },
    } as unknown as Awaited<ReturnType<typeof admin.getSectionMembers>>);

    await expect(resolveAnnouncementRecipients(sectionAId)).resolves.toEqual({
      recipients: [],
      sectionName: "Signals",
    });
    expect(mockListUsers).not.toHaveBeenCalled();
  });
});

describe("announcement callable enabled-account boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { role: "moderator", admin: false },
    { role: "admin", admin: true },
  ])("rejects a disabled $role before section-role checks", async ({ admin: isAdmin }) => {
    for (const callable of announcementCallables) {
      await expect(
        callable.run({
          auth: { uid: "disabled-user", token: { admin: isAdmin, enabled: false } },
          data: {},
        } as never)
      ).rejects.toMatchObject({ code: "permission-denied", message: "Account must be enabled" });
    }

    expect(mockGetSectionById).not.toHaveBeenCalled();
  });
});

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

describe("extractTemplateVariables", () => {
  it("extracts placeholders from body and subject", () => {
    expect(extractTemplateVariables("Hi ((firstName)), see ((section)) news", "((section)) update")).toEqual(
      expect.arrayContaining(["firstName", "section"])
    );
  });

  it("deduplicates repeated placeholders", () => {
    expect(extractTemplateVariables("((firstName)) ((firstName))", "")).toEqual(["firstName"]);
  });

  it("returns an empty array for a template with no placeholders", () => {
    expect(extractTemplateVariables("Just plain text.", "A subject")).toEqual([]);
  });

  it("ignores an unclosed placeholder", () => {
    expect(extractTemplateVariables("Hi ((firstName, no closing", "")).toEqual([]);
  });

  it("runs in linear time on adversarial input (no regex backtracking blowup)", () => {
    // A long run of unmatched "(" is the classic trigger for catastrophic/polynomial regex
    // backtracking on patterns like /\(\(([^)]+)\)\)/g. Template body/subject comes from GOV
    // Notify, not something this app controls the shape of, so this must stay fast regardless.
    const adversarial = "(".repeat(200_000);
    const start = performance.now();
    const result = extractTemplateVariables(adversarial, "");
    const elapsedMs = performance.now() - start;

    expect(result).toEqual([]);
    expect(elapsedMs).toBeLessThan(200);
  });
});

describe("buildRecipientPersonalisation (#362)", () => {
  const recipient = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    serviceNumber: "S123456",
    membershipStatus: "REGULAR",
  };

  it("includes only the fields the template actually references", () => {
    const result = buildRecipientPersonalisation(
      recipient,
      "Signals",
      "https://example.com/unsubscribe?token=abc",
      ["firstName", "section"]
    );

    expect(result).toEqual({ firstName: "Ada", section: "Signals" });
  });

  it("returns an empty object for a template with no placeholders", () => {
    const result = buildRecipientPersonalisation(
      recipient,
      "Signals",
      "https://example.com/unsubscribe?token=abc",
      []
    );

    expect(result).toEqual({});
  });

  it("never includes fields the template doesn't reference, even PII fields like serviceNumber/membershipStatus", () => {
    const result = buildRecipientPersonalisation(
      recipient,
      "Signals",
      "https://example.com/unsubscribe?token=abc",
      ["firstName"]
    );

    expect(result).not.toHaveProperty("serviceNumber");
    expect(result).not.toHaveProperty("membershipStatus");
    expect(result).not.toHaveProperty("email");
  });

  it("includes unsubscribeUrl in personalisation only when the template references it", () => {
    const withRef = buildRecipientPersonalisation(recipient, "Signals", "https://x/unsub", ["unsubscribeUrl"]);
    const withoutRef = buildRecipientPersonalisation(recipient, "Signals", "https://x/unsub", ["firstName"]);

    expect(withRef.unsubscribeUrl).toBe("https://x/unsub");
    expect(withoutRef).not.toHaveProperty("unsubscribeUrl");
  });
});
