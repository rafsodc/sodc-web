import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import { NotifyClient } from "notifications-node-client";

const taskQueueMocks = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("firebase-admin/functions", () => ({
  getFunctions: vi.fn(() => ({
    taskQueue: vi.fn(() => ({ enqueue: taskQueueMocks.enqueue })),
  })),
}));

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
import { govNotifyApiKey } from "../mailer";
import { unsubscribeSecret } from "../unsubscribe";

const mockGetAnnouncementSendById = vi.spyOn(admin, "getAnnouncementSendById");
const mockGetAnnouncementSendRecipients = vi.spyOn(admin, "getAnnouncementSendRecipients");
const mockGetSectionById = vi.spyOn(admin, "getSectionById");
const mockGetSectionMembers = vi.spyOn(admin, "getSectionMembers");
const mockListUsers = vi.spyOn(admin, "listUsers");
const mockConsumeCallableRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const mockEnsureCallableRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const mockGetSectionAnnouncementOptOuts = vi.spyOn(admin, "getSectionAnnouncementOptOuts");
const mockCreateAnnouncementSend = vi.spyOn(admin, "createAnnouncementSend");
const mockCreateAnnouncementRecipient = vi.spyOn(admin, "createAnnouncementRecipient");
const mockGetAnnouncementRecipientsForResume = vi.spyOn(admin, "getAnnouncementRecipientsForResume");
const mockTryMarkAnnouncementRecipientEnqueueFailed = vi.spyOn(admin, "tryMarkAnnouncementRecipientEnqueueFailed");
const mockTryUpdateAnnouncementRecipientProcessingStatus = vi.spyOn(admin, "tryUpdateAnnouncementRecipientProcessingStatus");

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

describe("sendSectionAnnouncement durable enqueue", () => {
  const requestId = "00000000-0000-4000-8000-000000000408";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(govNotifyApiKey, "value").mockReturnValue("notify-key");
    vi.spyOn(unsubscribeSecret, "value").mockReturnValue("unsubscribe-secret-that-is-long-enough");
    vi.spyOn(NotifyClient.prototype, "getTemplateById").mockResolvedValue({
      data: { body: "Hello ((firstName))", subject: "Section update" },
    } as never);
  });

  it("persists and enqueues a large audience, reports one failure, then resumes the same snapshot", async () => {
    const audience = Array.from({ length: 800 }, (_, index) => ({
      id: `user-${index}`,
      firstName: `First${index}`,
      lastName: `Last${index}`,
      email: `user-${index}@example.com`,
      serviceNumber: `S${index}`,
      membershipStatus: "REGULAR",
    }));
    mockGetSectionMembers.mockResolvedValue({
      data: {
        section: {
          id: sectionAId,
          name: "Signals",
          purposeLinks: [{
            purposes: ["ACCESS"],
            userGroup: {
              id: "direct-members",
              membershipStatuses: [],
              users: audience.map((user) => ({ user })),
            },
          }],
        },
      },
    } as never);
    mockGetSectionAnnouncementOptOuts.mockResolvedValue({
      data: { sectionAnnouncementOptOuts: [] },
    } as never);

    let sendRecord: Record<string, unknown> | undefined;
    const rows: Array<{ id: string; userId: string; status: string }> = [];
    mockGetAnnouncementSendById.mockImplementation(async () => ({
      data: { announcementSend: sendRecord },
    }) as never);
    mockCreateAnnouncementSend.mockImplementation(async (variables) => {
      sendRecord = {
        id: variables.id,
        sectionId: variables.sectionId,
        templateUuid: variables.templateUuid,
        templateName: variables.templateName,
        sentBy: variables.sentBy,
        recipientCount: variables.recipientCount,
        skippedCount: variables.skippedCount,
        recipientSnapshot: variables.recipientSnapshot,
      };
      return { data: {} } as never;
    });
    mockGetAnnouncementRecipientsForResume.mockImplementation(async () => ({
      data: { announcementRecipients: rows.map((row) => ({ ...row })) },
    }) as never);
    mockCreateAnnouncementRecipient.mockImplementation(async (variables) => {
      rows.push({ id: variables.id, userId: variables.userId, status: variables.status });
      return { data: { announcementRecipient_insert: { id: variables.id } } } as never;
    });
    mockTryMarkAnnouncementRecipientEnqueueFailed.mockImplementation(async ({ id }) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row?.status === "queued") row.status = "enqueue_failed";
      return { data: { announcementRecipient_updateMany: row ? 1 : 0 } } as never;
    });
    mockTryUpdateAnnouncementRecipientProcessingStatus.mockImplementation(async (variables) => {
      const row = rows.find((candidate) => candidate.id === variables.id);
      if (row && row.status === variables.expectedStatus) row.status = variables.status;
      return { data: { announcementRecipient_updateMany: row ? 1 : 0 } } as never;
    });

    const acceptedTaskIds = new Set<string>();
    let failUserFive = true;
    taskQueueMocks.enqueue.mockImplementation(async (data, options) => {
      const taskData = data as { recipientId: string };
      const taskId = (options as { id: string }).id;
      if (taskData.recipientId === "user-5" && failUserFive) {
        failUserFive = false;
        throw new Error("transient enqueue failure");
      }
      if (acceptedTaskIds.has(taskId)) {
        throw Object.assign(new Error("Task already exists"), {
          code: "functions/task-already-exists",
        });
      }
      acceptedTaskIds.add(taskId);
    });

    const call = () => sendSectionAnnouncement.run({
      auth: { uid: "admin-1", token: { admin: true, enabled: true } },
      data: {
        sectionId: sectionAId,
        templateUuid: "template-1",
        templateName: "BULK: Update",
        requestId,
      },
    } as never);

    await expect(call()).resolves.toMatchObject({
      sendId: requestId,
      queuedCount: 799,
      failedToEnqueueCount: 1,
      resumed: false,
    });
    expect(rows).toHaveLength(800);
    expect(new Set(taskQueueMocks.enqueue.mock.calls.map((call) => (call[1] as { id: string }).id)).size)
      .toBe(800);

    await expect(call()).resolves.toMatchObject({
      sendId: requestId,
      queuedCount: 800,
      failedToEnqueueCount: 0,
      resumed: true,
    });
    expect(mockGetSectionMembers).toHaveBeenCalledOnce();
    expect(mockCreateAnnouncementSend).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(800);
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

  it("extracts a placeholder wrapped in markdown link syntax, e.g. [Unsubscribe](((unsubscribeUrl))) (#421)", () => {
    const body =
      "Dear ((firstName)),\n\nYou are a member of the ((section)) section.\n\n" +
      "[Unsubscribe](((unsubscribeUrl)))\n\nSODC";

    expect(extractTemplateVariables(body, "Test Message")).toEqual(
      expect.arrayContaining(["firstName", "section", "unsubscribeUrl"])
    );
    // The historical bug produced a corrupted name with a leading "(" instead.
    expect(extractTemplateVariables(body, "Test Message")).not.toEqual(
      expect.arrayContaining(["(unsubscribeUrl"])
    );
  });

  it("stays linear time with many placeholders each preceded by an extra '(' (#421)", () => {
    const adversarial = "[link](((placeholder)))".repeat(20_000);
    const start = performance.now();
    const result = extractTemplateVariables(adversarial, "");
    const elapsedMs = performance.now() - start;

    expect(result).toEqual(["placeholder"]);
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
