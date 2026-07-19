import { describe, expect, it, vi } from "vitest";
import {
  processAnnouncementEmailTask,
  type AnnouncementDeliveryRepository,
  type AnnouncementEmailTask,
  type AnnouncementNotifyClient,
  type AnnouncementRecipientStatus,
} from "../announcementDelivery";

const task: AnnouncementEmailTask = {
  sendId: "00000000-0000-4000-8000-000000000001",
  recipientId: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  personalisation: { firstName: "Ada" },
  unsubscribeUrl: "https://example.test/unsubscribe?token=opaque",
  templateUuid: "template-1",
};

function harness(initialStatus: AnnouncementRecipientStatus = "queued") {
  let rejectedStatus: AnnouncementRecipientStatus | null = null;
  let row = {
    id: "00000000-0000-4000-8000-000000000002",
    status: initialStatus,
    processingVersion: 0,
    processingStartedAt: initialStatus === "queued" ? null : "2026-07-19T09:00:00.000Z",
    providerNotificationId: null as string | null,
    sentAt: null as string | null,
    failureReason: null as string | null,
  };
  const repository: AnnouncementDeliveryRepository = {
    get: vi.fn(async () => ({ ...row })),
    createLegacyTaskRow: vi.fn(async () => undefined),
    tryUpdate: vi.fn(async (args) => {
      if (args.status === rejectedStatus) {
        rejectedStatus = null;
        return false;
      }
      if (row.status !== args.expectedStatus || row.processingVersion !== args.expectedProcessingVersion) {
        return false;
      }
      row = {
        ...row,
        status: args.status,
        processingVersion: args.processingVersion,
        processingStartedAt: args.processingStartedAt,
        providerNotificationId: args.providerNotificationId,
        sentAt: args.sentAt,
        failureReason: args.failureReason,
      };
      return true;
    }),
  };
  const getNotifications = vi.fn<AnnouncementNotifyClient["getNotifications"]>(async () => ({
    data: { notifications: [] },
  }));
  const sendEmail = vi.fn<AnnouncementNotifyClient["sendEmail"]>(async () => ({
    data: { id: "notify-1" },
  }));
  const client: AnnouncementNotifyClient = { getNotifications, sendEmail };
  return {
    repository,
    client,
    getNotifications,
    sendEmail,
    row: () => row,
    rejectNextUpdateTo: (status: AnnouncementRecipientStatus) => { rejectedStatus = status; },
  };
}

describe("processAnnouncementEmailTask", () => {
  it("claims a queued recipient and records the provider acceptance", async () => {
    const test = harness();

    await processAnnouncementEmailTask(task, { retryCount: 0 }, {
      repository: test.repository,
      client: test.client,
      now: () => "2026-07-19T10:00:00.000Z",
    });

    expect(test.sendEmail).toHaveBeenCalledOnce();
    expect(test.row()).toMatchObject({
      status: "sent",
      processingVersion: 1,
      providerNotificationId: "notify-1",
      sentAt: "2026-07-19T10:00:00.000Z",
    });
  });

  it("does not resend a recipient that is already terminal", async () => {
    const test = harness("sent");

    await processAnnouncementEmailTask(task, { retryCount: 2 }, {
      repository: test.repository,
      client: test.client,
      now: () => "2026-07-19T10:00:00.000Z",
    });

    expect(test.getNotifications).not.toHaveBeenCalled();
    expect(test.sendEmail).not.toHaveBeenCalled();
    expect(test.repository.tryUpdate).not.toHaveBeenCalled();
  });

  it("does not let an overlapping attempt call Notify", async () => {
    const test = harness();
    let releaseSend!: () => void;
    test.sendEmail.mockImplementation(async () => {
      await new Promise<void>((resolve) => { releaseSend = resolve; });
      return { data: { id: "notify-1" } };
    });
    const dependencies = {
      repository: test.repository,
      client: test.client,
      now: () => "2026-07-19T10:00:00.000Z",
    };

    const first = processAnnouncementEmailTask(task, { retryCount: 0 }, dependencies);
    await vi.waitFor(() => expect(test.sendEmail).toHaveBeenCalledOnce());
    await expect(
      processAnnouncementEmailTask(task, { retryCount: 1 }, dependencies),
    ).rejects.toThrow("still being reconciled");
    releaseSend();
    await first;

    expect(test.sendEmail).toHaveBeenCalledOnce();
  });

  it("does not query Notify until the ambiguity reconciliation delay has elapsed", async () => {
    const test = harness("delivery_unknown");

    await expect(
      processAnnouncementEmailTask(task, { retryCount: 1 }, {
        repository: test.repository,
        client: test.client,
        now: () => "2026-07-19T09:00:30.000Z",
      }),
    ).rejects.toThrow("still being reconciled");

    expect(test.getNotifications).not.toHaveBeenCalled();
    expect(test.sendEmail).not.toHaveBeenCalled();
  });

  it("reclaims an abandoned processing lease within the configured retry window", async () => {
    const test = harness("sending");

    await processAnnouncementEmailTask(task, { retryCount: 3 }, {
      repository: test.repository,
      client: test.client,
      now: () => "2026-07-19T09:02:01.000Z",
    });

    expect(test.getNotifications).toHaveBeenCalledOnce();
    expect(test.sendEmail).toHaveBeenCalledOnce();
    expect(test.row()).toMatchObject({ status: "sent", processingVersion: 1 });
  });

  it("reconciles an ambiguous accepted send without sending again", async () => {
    const test = harness("delivery_unknown");
    test.getNotifications.mockResolvedValue({
      data: {
        notifications: [{
          id: "notify-existing",
          reference: "announcement:00000000-0000-4000-8000-000000000001:user-1",
        }],
      },
    });

    await processAnnouncementEmailTask(task, { retryCount: 1 }, {
      repository: test.repository,
      client: test.client,
      now: () => "2026-07-19T10:01:00.000Z",
    });

    expect(test.sendEmail).not.toHaveBeenCalled();
    expect(test.row()).toMatchObject({ status: "sent", providerNotificationId: "notify-existing" });
  });

  it("marks permanent 4xx errors failed without asking Cloud Tasks to retry", async () => {
    const test = harness();
    const error = Object.assign(new Error("Bad recipient"), { response: { status: 400 } });
    test.sendEmail.mockRejectedValue(error);

    await processAnnouncementEmailTask(task, { retryCount: 0 }, {
      repository: test.repository,
      client: test.client,
      now: () => "2026-07-19T10:00:00.000Z",
    });

    expect(test.row()).toMatchObject({ status: "failed", failureReason: "Bad recipient" });
  });

  it("marks 429 errors retryable and rethrows", async () => {
    const test = harness();
    const error = Object.assign(new Error("Rate limited"), { response: { status: 429 } });
    test.sendEmail.mockRejectedValue(error);

    await expect(
      processAnnouncementEmailTask(task, { retryCount: 0 }, {
        repository: test.repository,
        client: test.client,
        now: () => "2026-07-19T10:00:00.000Z",
      }),
    ).rejects.toBe(error);

    expect(test.row()).toMatchObject({ status: "retrying", failureReason: "Rate limited" });
  });

  it("records network and 5xx outcomes as unknown before retrying", async () => {
    const test = harness();
    const error = Object.assign(new Error("Notify unavailable"), { response: { status: 503 } });
    test.sendEmail.mockRejectedValue(error);

    await expect(
      processAnnouncementEmailTask(task, { retryCount: 0 }, {
        repository: test.repository,
        client: test.client,
        now: () => "2026-07-19T10:00:00.000Z",
      }),
    ).rejects.toBe(error);

    expect(test.row()).toMatchObject({
      status: "delivery_unknown",
      processingStartedAt: "2026-07-19T10:00:00.000Z",
    });
  });

  it("records an ambiguous outcome when provider acceptance cannot be persisted", async () => {
    const test = harness();
    test.rejectNextUpdateTo("sent");

    await expect(
      processAnnouncementEmailTask(task, { retryCount: 0 }, {
        repository: test.repository,
        client: test.client,
        now: () => "2026-07-19T10:00:00.000Z",
      }),
    ).rejects.toThrow("Unable to persist announcement provider acceptance");

    expect(test.sendEmail).toHaveBeenCalledOnce();
    expect(test.row()).toMatchObject({ status: "delivery_unknown" });
  });
});
