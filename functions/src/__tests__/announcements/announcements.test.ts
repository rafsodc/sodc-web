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
  prepareAnnouncementSendTask,
  retryAnnouncementPreparation,
  resolveAnnouncementRecipients,
  extractTemplateVariables,
  buildRecipientPersonalisation,
} from "../../announcements";
import { govNotifyLiveApiKey } from "../../mailer";
import { unsubscribeSecret } from "../../unsubscribe";

const mockGetAnnouncementSendById = vi.spyOn(admin, "getAnnouncementSendById");
const mockGetAnnouncementSendRecipientPage = vi.spyOn(admin, "getAnnouncementSendRecipientPage");
const mockGetSectionById = vi.spyOn(admin, "getSectionById");
const mockGetAnnouncementAudienceSection = vi.spyOn(admin, "getAnnouncementAudienceSection");
const mockGetAnnouncementAudiencePurposeLinks = vi.spyOn(admin, "getAnnouncementAudiencePurposeLinksPaged");
const mockGetAnnouncementExplicitMembers = vi.spyOn(admin, "getAnnouncementExplicitMembersPaged");
const mockGetAnnouncementStatusMembers = vi.spyOn(admin, "getAnnouncementStatusMembersPaged");
const mockGetAnnouncementProgressSummary = vi.spyOn(admin, "getAnnouncementRecipientProgressSummary");
const mockGetAnnouncementHistory = vi.spyOn(admin, "getAnnouncementSendHistory");
const mockConsumeCallableRateLimit = vi.spyOn(admin, "consumeCallableRateLimit");
const mockEnsureCallableRateLimitBucket = vi.spyOn(admin, "ensureCallableRateLimitBucket");
const mockGetSectionAnnouncementOptOuts = vi.spyOn(admin, "getSectionAnnouncementOptOutsPaged");
const mockCreateAnnouncementSend = vi.spyOn(admin, "createAnnouncementSendWithDeliveryMode");
const mockCreateAnnouncementRecipient = vi.spyOn(
  admin,
  "createAnnouncementRecipientWithDeliveryMode",
);
const mockGetAnnouncementRecipientsForResume = vi.spyOn(admin, "getAnnouncementRecipientsForResumePaged");
const mockTryMarkAnnouncementRecipientEnqueueFailed = vi.spyOn(admin, "tryMarkAnnouncementRecipientEnqueueFailed");
const mockTryUpdateAnnouncementRecipientProcessingStatus = vi.spyOn(admin, "tryUpdateAnnouncementRecipientProcessingStatus");
const mockGetGovNotifyDeliveryConfiguration = vi.spyOn(admin, "getGovNotifyDeliveryConfiguration");
const mockGetNotifyReplyToConfiguration = vi.spyOn(admin, "getNotifyReplyToConfiguration");

beforeEach(() => {
  process.env.GOV_NOTIFY_DELIVERY_MODE = "LIVE";
  mockGetGovNotifyDeliveryConfiguration.mockResolvedValue({
    data: {
      govNotifyDeliveryConfiguration: {
        mode: "LIVE",
        version: 1,
        updatedAt: "2026-07-27T08:00:00.000Z",
        updatedBy: "admin-1",
      },
    },
  } as never);
  mockGetNotifyReplyToConfiguration.mockResolvedValue({
    data: {
      notifyEmailConfiguration: {
        version: 1,
        updatedAt: "2026-08-03T08:00:00.000Z",
        updatedBy: "admin-1",
        defaultReplyToAddress: null,
      },
      notifyReplyToAddresses: [],
      notifyTemplateReplyToOverrides: [],
    },
  } as never);
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
  retryAnnouncementPreparation,
] as const;

describe("resolveAnnouncementRecipients", () => {
  beforeEach(() => {
    mockGetAnnouncementAudienceSection.mockReset();
    mockGetAnnouncementAudiencePurposeLinks.mockReset();
    mockGetAnnouncementExplicitMembers.mockReset();
    mockGetAnnouncementStatusMembers.mockReset();
    mockGetAnnouncementAudienceSection.mockResolvedValue({
      data: { section: { id: sectionAId, name: "Signals" } },
    } as never);
  });

  it("loads and merges users matching an eligible group's membership statuses", async () => {
    mockGetAnnouncementAudiencePurposeLinks.mockResolvedValue({
      data: { sectionUserGroupPurposeLinks: [{
        purposes: ["ACCESS"],
        userGroup: { id: "regular-access", membershipStatuses: ["REGULAR"] },
      }] },
    } as never);
    mockGetAnnouncementExplicitMembers.mockResolvedValue({ data: { userUserGroups: [] } } as never);
    mockGetAnnouncementStatusMembers.mockResolvedValue({
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
    } as never);

    const result = await resolveAnnouncementRecipients(sectionAId);

    expect(result.sectionName).toBe("Signals");
    expect(result.recipients.map(({ id }) => id)).toEqual(["status-user"]);
    expect(mockGetAnnouncementStatusMembers).toHaveBeenCalledOnce();
  });

  it("does not load all users when no eligible inherited statuses are configured", async () => {
    mockGetAnnouncementAudiencePurposeLinks.mockResolvedValue({
      data: { sectionUserGroupPurposeLinks: [] },
    } as never);

    await expect(resolveAnnouncementRecipients(sectionAId)).resolves.toEqual({
      recipients: [],
      sectionName: "Signals",
    });
    expect(mockGetAnnouncementStatusMembers).not.toHaveBeenCalled();
    expect(mockGetAnnouncementExplicitMembers).not.toHaveBeenCalled();
  });

  it("pages explicit group membership without an audience ceiling", async () => {
    const users = Array.from({ length: 1001 }, (_, index) => ({
      userGroupId: "regular-access",
      user: {
        id: `user-${index}`,
        firstName: "Member",
        lastName: String(index),
        email: `member-${index}@example.com`,
        serviceNumber: `S${index}`,
        membershipStatus: "REGULAR",
      },
    }));
    mockGetAnnouncementAudiencePurposeLinks.mockResolvedValue({
      data: { sectionUserGroupPurposeLinks: [{
        purposes: ["ACCESS"],
        userGroup: { id: "regular-access", membershipStatuses: [] },
      }] },
    } as never);
    mockGetAnnouncementExplicitMembers.mockImplementation(async ({ limit, offset }) => ({
      data: { userUserGroups: users.slice(offset, offset + limit) },
    }) as never);

    const result = await resolveAnnouncementRecipients(sectionAId);

    expect(result.recipients).toHaveLength(1001);
    expect(mockGetAnnouncementExplicitMembers).toHaveBeenNthCalledWith(1, expect.objectContaining({
      limit: 1000,
      offset: 0,
    }));
    expect(mockGetAnnouncementExplicitMembers).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: 1000,
      offset: 1000,
    }));
  });
});

describe("sendSectionAnnouncement asynchronous durable enqueue", () => {
  const requestId = "00000000-0000-4000-8000-000000000408";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(govNotifyLiveApiKey, "value").mockReturnValue("notify-key");
    vi.spyOn(unsubscribeSecret, "value").mockReturnValue("unsubscribe-secret-that-is-long-enough");
    vi.spyOn(NotifyClient.prototype, "getTemplateById").mockResolvedValue({
      data: { body: "Hello ((firstName))", subject: "Section update" },
    } as never);
  });

  it("returns after scheduling preparation, then persists and enqueues a large audience idempotently", async () => {
    const audience = Array.from({ length: 800 }, (_, index) => ({
      id: `user-${index}`,
      firstName: `First${index}`,
      lastName: `Last${index}`,
      email: `user-${index}@example.com`,
      serviceNumber: `S${index}`,
      membershipStatus: "REGULAR",
    }));
    mockGetAnnouncementAudienceSection.mockResolvedValue({
      data: { section: { id: sectionAId, name: "Signals" } },
    } as never);
    mockGetAnnouncementAudiencePurposeLinks.mockResolvedValue({
      data: { sectionUserGroupPurposeLinks: [{
        purposes: ["ACCESS"],
        userGroup: { id: "direct-members", membershipStatuses: [] },
      }] },
    } as never);
    mockGetAnnouncementExplicitMembers.mockImplementation(async ({ limit, offset }) => ({
      data: {
        userUserGroups: audience.slice(offset, offset + limit).map((user) => ({
          userGroupId: "direct-members",
          user,
        })),
      },
    }) as never);
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
        requestedDeliveryMode: variables.requestedDeliveryMode,
        siteDeliveryMode: variables.siteDeliveryMode,
        effectiveDeliveryMode: variables.effectiveDeliveryMode,
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
        deliveryMode: "LIVE",
      },
    } as never);

    await expect(call()).resolves.toMatchObject({
      sendId: requestId,
      recipientCount: 800,
      preparationQueued: true,
      resumed: false,
    });
    expect(rows).toHaveLength(0);
    expect(taskQueueMocks.enqueue).toHaveBeenCalledWith(
      { sendId: requestId },
      expect.objectContaining({ dispatchDeadlineSeconds: 300, id: expect.any(String) }),
    );

    await expect(prepareAnnouncementSendTask({ sendId: requestId })).rejects.toThrow(
      "left 1 recipient task(s) unqueued",
    );
    expect(rows).toHaveLength(800);
    const recipientTaskCalls = taskQueueMocks.enqueue.mock.calls.filter(
      (call) => typeof (call[0] as { recipientId?: string }).recipientId === "string",
    );
    expect(new Set(recipientTaskCalls.map((call) => (call[1] as { id: string }).id)).size)
      .toBe(800);

    await expect(prepareAnnouncementSendTask({ sendId: requestId })).resolves.toEqual({
      queuedCount: 800,
      failedToEnqueueCount: 0,
    });
    expect(mockGetAnnouncementAudienceSection).toHaveBeenCalledOnce();
    expect(mockCreateAnnouncementSend).toHaveBeenCalledOnce();
    expect(mockGetAnnouncementRecipientsForResume).toHaveBeenCalledTimes(2);
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

describe("announcement preparation recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as never);
  });

  it("deduplicates a repeated recovery attempt while allowing a new generation", async () => {
    const attemptA = "00000000-0000-4000-8000-0000000000a1";
    const attemptB = "00000000-0000-4000-8000-0000000000a2";
    const seenTaskIds = new Set<string>();
    taskQueueMocks.enqueue.mockImplementation(async (_data, options) => {
      const id = (options as { id: string }).id;
      if (seenTaskIds.has(id)) {
        throw Object.assign(new Error("Task already exists"), {
          code: "functions/task-already-exists",
        });
      }
      seenTaskIds.add(id);
    });
    const call = (attemptId: string) => retryAnnouncementPreparation.run({
      auth: { uid: "admin-1", token: { admin: true, enabled: true } },
      data: { sectionId: sectionBId, sendId: sendIdForSectionB, attemptId },
    } as never);

    await expect(call(attemptA)).resolves.toEqual({ preparationQueued: true });
    await expect(call(attemptA)).resolves.toEqual({ preparationQueued: true });
    await expect(call(attemptB)).resolves.toEqual({ preparationQueued: true });

    const ids = taskQueueMocks.enqueue.mock.calls.map((entry) => (entry[1] as { id: string }).id);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });
});

describe("getAnnouncementSendHistory progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnnouncementHistory.mockResolvedValue({
      data: {
        announcementSends: [{
          id: sendIdForSectionB,
          templateUuid: "template-1",
          templateName: "BULK: Update",
          sentBy: "admin-1",
          sentAt: "2026-08-16T12:00:00.000Z",
          recipientCount: 8,
          skippedCount: 2,
          requestedDeliveryMode: "LIVE",
          siteDeliveryMode: "LIVE",
          effectiveDeliveryMode: "LIVE",
        }],
      },
    } as never);
  });

  it("uses grouped counts and identifies an incomplete preparation", async () => {
    mockGetAnnouncementProgressSummary.mockResolvedValue({
      data: {
        announcementRecipients: [
          { status: "delivered", _count: 4 },
          { status: "queued", _count: 3 },
          { status: "enqueue_failed", _count: 1 },
          { status: "skipped", _count: 1 },
        ],
      },
    } as never);

    const result = await getAnnouncementSendHistory.run({
      auth: { uid: "admin-1", token: { admin: true, enabled: true } },
      data: { sectionId: sectionBId },
    } as never);

    expect(result.sends[0]).toMatchObject({
      processedCount: 4,
      failureCount: 1,
      enqueueFailureCount: 1,
      recordedRecipientCount: 9,
      progressAvailable: true,
      preparationIncomplete: true,
    });
    expect(mockGetAnnouncementProgressSummary).toHaveBeenCalledOnce();
  });

  it("reports unavailable progress instead of a false zero when the summary fails", async () => {
    mockGetAnnouncementProgressSummary.mockRejectedValue(new Error("second page unavailable"));

    const result = await getAnnouncementSendHistory.run({
      auth: { uid: "admin-1", token: { admin: true, enabled: true } },
      data: { sectionId: sectionBId },
    } as never);

    expect(result.sends[0]).toMatchObject({
      processedCount: null,
      failureCount: null,
      progressAvailable: false,
      preparationIncomplete: false,
    });
  });
});

describe("getAnnouncementSendRecipients", () => {
  beforeEach(() => {
    mockGetAnnouncementSendById.mockReset();
    mockGetAnnouncementSendRecipientPage.mockReset();
  });

  function mockRecipientQuery(rows: Array<Record<string, unknown>>) {
    mockGetAnnouncementSendRecipientPage.mockImplementation(async (variables) => {
      const search = new RegExp(variables.searchPattern, "i");
      const filtered = rows.filter((row) =>
        variables.statuses.includes(String(row.status)) &&
        variables.failureCategories.includes(String(row.failureCategory ?? "none")) &&
        [row.firstName, row.lastName, row.email].some((value) => search.test(String(value)))
      );
      const initialCounts = new Map<string, number>();
      filtered.forEach((row) => {
        const initial = String(row.surnameInitial ?? "OTHER");
        initialCounts.set(initial, (initialCounts.get(initial) ?? 0) + 1);
      });
      const selected = filtered.filter((row) =>
        variables.initials.includes(String(row.surnameInitial ?? "OTHER"))
      );
      return {
        data: {
          total: [{ _count: rows.length }],
          filtered: [...initialCounts].map(([surnameInitial, _count]) => ({ surnameInitial, _count })),
          recipients: selected.slice(variables.offset, variables.offset + variables.limit),
        },
      } as never;
    });
  }

  it("rejects a sendId that belongs to a different section than the one the caller was authorized for", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);

    await expect(
      callAsAdmin({ sectionId: sectionAId, sendId: sendIdForSectionB })
    ).rejects.toMatchObject({ code: "not-found" });

    expect(mockGetAnnouncementSendRecipientPage).not.toHaveBeenCalled();
  });

  it("returns recipients when the sendId belongs to the authorized section", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);
    mockRecipientQuery([{
      id: "recipient-1",
      userId: "user-1",
      email: "user1@example.com",
      firstName: "First",
      lastName: "Last",
      surnameInitial: "L",
      status: "sent",
      skippedReason: null,
      sentAt: "2026-01-01T00:00:00Z",
      failureReason: null,
      failureCategory: "none",
      effectiveDeliveryMode: "LIVE",
    }]);

    const result = await callAsAdmin({ sectionId: sectionBId, sendId: sendIdForSectionB });

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].email).toBe("user1@example.com");
    expect(result).toMatchObject({ totalCount: 1, filteredCount: 1, page: 1, pageCount: 1 });
  });

  it("filters, classifies, groups, and pages recipient history server-side", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);
    const passed = Array.from({ length: 55 }, (_, index) => ({
      id: `passed-${String(index).padStart(2, "0")}`,
      userId: `passed-user-${index}`,
      email: `passed-${index}@example.com`,
      firstName: `Person ${index}`,
      lastName: `Adams ${index}`,
      surnameInitial: "A",
      status: "delivered",
      skippedReason: null,
      sentAt: "2026-01-01T00:00:00Z",
      failureReason: null,
      failureCategory: "none",
      effectiveDeliveryMode: "TEAM_TEST",
    }));
    const notOnTeam = Array.from({ length: 3 }, (_, index) => ({
      id: `team-${index}`,
      userId: `team-user-${index}`,
      email: `team-${index}@example.com`,
      firstName: `Team ${index}`,
      lastName: `Brown ${index}`,
      surnameInitial: "B",
      status: "failed",
      skippedReason: null,
      sentAt: null,
      failureReason: "Can’t send to this recipient using a team-only API key",
      failureCategory: "notify_team_only",
      effectiveDeliveryMode: "TEAM_TEST",
    }));
    mockRecipientQuery([...passed, ...notOnTeam]);

    const secondPage = await callAsAdmin({
      sectionId: sectionBId,
      sendId: sendIdForSectionB,
      statusFilter: "PASSED",
      initial: "ALL",
      page: 2,
    });
    expect(secondPage).toMatchObject({
      totalCount: 58,
      filteredCount: 55,
      page: 2,
      pageSize: 50,
      pageCount: 2,
    });
    expect(secondPage.recipients).toHaveLength(5);
    expect(secondPage.initialCounts.A).toBe(55);

    const completeInitial = await callAsAdmin({
      sectionId: sectionBId,
      sendId: sendIdForSectionB,
      statusFilter: "PASSED",
      initial: "A",
      page: 2,
    });
    expect(completeInitial.recipients).toHaveLength(55);
    expect(completeInitial).toMatchObject({ page: 1, pageCount: 1 });

    const teamOnly = await callAsAdmin({
      sectionId: sectionBId,
      sendId: sendIdForSectionB,
      statusFilter: "NOT_ON_TEAM",
    });
    expect(teamOnly.filteredCount).toBe(3);
    expect(teamOnly.initialCounts.B).toBe(3);
    expect(teamOnly.recipients.every((recipient) =>
      recipient.failureCategory === "notify_team_only"
    )).toBe(true);
  });

  it("asks Data Connect only for the requested numeric page", async () => {
    mockGetAnnouncementSendById.mockResolvedValue({
      data: { announcementSend: { id: sendIdForSectionB, sectionId: sectionBId } },
    } as Awaited<ReturnType<typeof admin.getAnnouncementSendById>>);
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `recipient-${String(index).padStart(4, "0")}`,
      userId: `user-${index}`,
      email: `user-${index}@example.com`,
      firstName: `First ${index}`,
      lastName: `Smith ${index}`,
      surnameInitial: "S",
      status: "delivered",
      skippedReason: null,
      sentAt: "2026-01-01T00:00:00Z",
      failureReason: null,
      failureCategory: "none",
      effectiveDeliveryMode: "LIVE",
    }));
    mockRecipientQuery(rows);

    const result = await callAsAdmin({
      sectionId: sectionBId,
      sendId: sendIdForSectionB,
      statusFilter: "PASSED",
    });

    expect(result).toMatchObject({ totalCount: 1001, filteredCount: 1001, pageCount: 21 });
    expect(result.recipients).toHaveLength(50);
    expect(mockGetAnnouncementSendRecipientPage).toHaveBeenCalledTimes(1);
    expect(mockGetAnnouncementSendRecipientPage).toHaveBeenCalledWith(expect.objectContaining({
      sendId: sendIdForSectionB,
      statuses: ["sent", "delivered"],
      limit: 50,
      offset: 0,
    }));
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
