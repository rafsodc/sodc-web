import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MembershipStatus,
  NotifyDeliveryReceiptOutcome,
  NotifyDeliveryReceiptProcessingStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import * as logger from "firebase-functions/logger";
import {
  handleNotifyDelivery,
  notifyCallbackSecret,
  notifyDeliveryCallback,
  BOUNCE_THRESHOLD,
} from "../notifyCallback.js";
import {
  DEFAULT_NOTIFY_RECEIPT_LEASE_MS,
  recipientHashForEmail,
  type NotifyReceipt,
  type NotifyReceiptProcessorDependencies,
  type NotifyReceiptRepository,
} from "../notifyReceiptProcessor.js";

const BEARER = "test-bearer-token";
const NOW = "2026-07-17T12:30:00.000Z";

type TestReceipt = {
  id: string;
  notifyStatus: string;
  reference: string | null;
  recipientHash: string;
  userId: string | null;
  eventAt: string;
  eventOrderingKey: string;
  affectsBounceState: boolean;
  processingStatus: NotifyDeliveryReceiptProcessingStatus;
  outcome: NotifyDeliveryReceiptOutcome | null;
  attemptCount: number;
  lastAttemptedAt: string;
  processedAt: string | null;
  lastErrorMessage: string | null;
};

type TestUser = {
  id: string;
  email: string;
  membershipStatus: MembershipStatus;
  emailBounceCount: number;
  emailLastBounceAt: string | null;
  emailDeliveryVersion: number;
  emailDeliveryStatus: string | null;
  emailDeliveryStatusUpdatedAt: string | null;
  emailDeliveryReceiptId: string | null;
};

type TestAnnouncementRecipient = {
  id: UUIDString;
  sendId: string;
  userId: string;
  status: string;
  failureReason: string | null;
  deliveryVersion: number;
  deliveryStatusUpdatedAt: string | null;
  deliveryReceiptId: string | null;
};

class InMemoryNotifyReceiptRepository implements NotifyReceiptRepository {
  readonly receipts = new Map<string, TestReceipt>();
  readonly users = new Map<string, TestUser>();
  readonly announcements = new Map<string, TestAnnouncementRecipient>();
  userStateApplyCount = 0;
  announcementStateApplyCount = 0;

  addUser(overrides: Partial<TestUser> = {}): TestUser {
    const user: TestUser = {
      id: "user-abc",
      email: "alice@example.com",
      membershipStatus: MembershipStatus.REGULAR,
      emailBounceCount: 0,
      emailLastBounceAt: null,
      emailDeliveryVersion: 0,
      emailDeliveryStatus: null,
      emailDeliveryStatusUpdatedAt: null,
      emailDeliveryReceiptId: null,
      ...overrides,
    };
    this.users.set(user.id, user);
    return user;
  }

  addAnnouncement(sendId: string, userId: string): TestAnnouncementRecipient {
    const recipient: TestAnnouncementRecipient = {
      id: "33333333-3333-4333-8333-333333333333" as UUIDString,
      sendId,
      userId,
      status: "sent",
      failureReason: null,
      deliveryVersion: 0,
      deliveryStatusUpdatedAt: null,
      deliveryReceiptId: null,
    };
    this.announcements.set(`${sendId}:${userId}`, recipient);
    return recipient;
  }

  async getReceipt(id: string) {
    return this.receipts.get(id) ?? null;
  }

  async createReceipt(args: Parameters<NotifyReceiptRepository["createReceipt"]>[0]) {
    if (this.receipts.has(args.id)) throw new Error("duplicate key value violates unique constraint");
    const receipt: TestReceipt = {
      ...args,
      processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
      outcome: null,
      attemptCount: 1,
      processedAt: null,
      lastErrorMessage: null,
    };
    this.receipts.set(receipt.id, receipt);
    return receipt;
  }

  async tryClaimReceipt(args: Parameters<NotifyReceiptRepository["tryClaimReceipt"]>[0]) {
    const receipt = this.receipts.get(args.id);
    if (
      !receipt ||
      receipt.processingStatus !== args.expectedProcessingStatus ||
      receipt.attemptCount !== args.expectedAttemptCount
    ) {
      return false;
    }
    receipt.processingStatus = NotifyDeliveryReceiptProcessingStatus.PENDING;
    receipt.attemptCount = args.attemptCount;
    receipt.lastAttemptedAt = args.lastAttemptedAt;
    receipt.lastErrorMessage = null;
    return true;
  }

  async markReceiptProcessed(args: Parameters<NotifyReceiptRepository["markReceiptProcessed"]>[0]) {
    const receipt = this.receipts.get(args.id);
    if (
      !receipt ||
      receipt.processingStatus !== NotifyDeliveryReceiptProcessingStatus.PENDING ||
      receipt.attemptCount !== args.attemptCount
    ) {
      return false;
    }
    receipt.processingStatus = NotifyDeliveryReceiptProcessingStatus.PROCESSED;
    receipt.outcome = args.outcome;
    receipt.processedAt = args.processedAt;
    return true;
  }

  async markReceiptFailed(args: Parameters<NotifyReceiptRepository["markReceiptFailed"]>[0]) {
    const receipt = this.receipts.get(args.id);
    if (
      !receipt ||
      receipt.processingStatus !== NotifyDeliveryReceiptProcessingStatus.PENDING ||
      receipt.attemptCount !== args.attemptCount
    ) {
      return false;
    }
    receipt.processingStatus = NotifyDeliveryReceiptProcessingStatus.FAILED;
    receipt.lastErrorMessage = args.lastErrorMessage;
    return true;
  }

  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async getUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async getRecentStateReceiptsForUser(userId: string) {
    return [...this.receipts.values()]
      .filter((receipt) => receipt.userId === userId && receipt.affectsBounceState)
      .sort((a, b) => b.eventOrderingKey.localeCompare(a.eventOrderingKey))
      .slice(0, BOUNCE_THRESHOLD)
      .map(({ id, notifyStatus, eventAt, eventOrderingKey }) => ({
        id,
        notifyStatus,
        eventAt,
        eventOrderingKey,
      }));
  }

  async tryApplyUserState(args: Parameters<NotifyReceiptRepository["tryApplyUserState"]>[0]) {
    const user = this.users.get(args.userId);
    if (!user || user.emailDeliveryVersion !== args.expectedEmailDeliveryVersion) return false;
    user.emailDeliveryVersion = args.emailDeliveryVersion;
    user.emailBounceCount = args.emailBounceCount;
    user.emailLastBounceAt = args.emailLastBounceAt;
    user.emailDeliveryStatus = args.emailDeliveryStatus;
    user.emailDeliveryStatusUpdatedAt = args.emailDeliveryStatusUpdatedAt;
    user.emailDeliveryReceiptId = args.emailDeliveryReceiptId;
    if (args.markLost) user.membershipStatus = MembershipStatus.LOST;
    this.userStateApplyCount += 1;
    return true;
  }

  async findAnnouncementRecipient(sendId: string, userId: string) {
    return this.announcements.get(`${sendId}:${userId}`) ?? null;
  }

  async getLatestStateReceiptForReference(reference: string) {
    const receipt = [...this.receipts.values()]
      .filter((candidate) => candidate.reference === reference && candidate.affectsBounceState)
      .sort((a, b) => b.eventOrderingKey.localeCompare(a.eventOrderingKey))[0];
    return receipt
      ? {
          id: receipt.id,
          notifyStatus: receipt.notifyStatus,
          eventAt: receipt.eventAt,
          eventOrderingKey: receipt.eventOrderingKey,
        }
      : null;
  }

  async tryApplyAnnouncementState(args: Parameters<NotifyReceiptRepository["tryApplyAnnouncementState"]>[0]) {
    const recipient = [...this.announcements.values()].find((candidate) => candidate.id === args.id);
    if (!recipient || recipient.deliveryVersion !== args.expectedDeliveryVersion) return false;
    recipient.deliveryVersion = args.deliveryVersion;
    recipient.status = args.status;
    recipient.failureReason = args.failureReason;
    recipient.deliveryStatusUpdatedAt = args.deliveryStatusUpdatedAt;
    recipient.deliveryReceiptId = args.deliveryReceiptId;
    this.announcementStateApplyCount += 1;
    return true;
  }
}

function makeReq(overrides: Partial<{ method: string; headers: Record<string, string>; body: unknown }> = {}): Request {
  return {
    method: "POST",
    headers: { authorization: `Bearer ${BEARER}` },
    body: {
      id: "notify-id-1",
      to: "alice@example.com",
      status: "delivered",
      completed_at: "2026-07-17T12:00:00.000Z",
    },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  const res = { status: vi.fn(), send: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

function dependencies(
  repository: NotifyReceiptRepository,
  onMembershipLost: NonNullable<NotifyReceiptProcessorDependencies["onMembershipLost"]> = vi.fn()
): NotifyReceiptProcessorDependencies {
  return {
    repository,
    now: () => NOW,
    leaseMs: DEFAULT_NOTIFY_RECEIPT_LEASE_MS,
    onMembershipLost,
  };
}

function receipt(overrides: Partial<NotifyReceipt> = {}): NotifyReceipt {
  return {
    id: "notify-id-1",
    to: "alice@example.com",
    status: "delivered",
    completed_at: "2026-07-17T12:00:00.000Z",
    ...overrides,
  };
}

async function sendReceipt(
  repository: NotifyReceiptRepository,
  body: NotifyReceipt,
  onMembershipLost: NonNullable<NotifyReceiptProcessorDependencies["onMembershipLost"]> = vi.fn()
): Promise<Response> {
  const res = makeRes();
  await handleNotifyDelivery(makeReq({ body }), res, BEARER, dependencies(repository, onMembershipLost));
  return res;
}

describe("handleNotifyDelivery", () => {
  let repository: InMemoryNotifyReceiptRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new InMemoryNotifyReceiptRepository();
  });

  it("rejects requests with a wrong bearer token", async () => {
    const res = makeRes();
    await handleNotifyDelivery(
      makeReq({ headers: { authorization: "Bearer wrong-token" } }),
      res,
      BEARER,
      dependencies(repository)
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects requests with no authorization header", async () => {
    const res = makeRes();
    await handleNotifyDelivery(makeReq({ headers: {} }), res, BEARER, dependencies(repository));
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("wires the deployed HTTP function through the configured secret", async () => {
    vi.spyOn(notifyCallbackSecret, "value").mockReturnValue(BEARER);
    const res = makeRes();
    await notifyDeliveryCallback(makeReq({ headers: { authorization: "Bearer wrong-token" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects a same-length wrong bearer token", async () => {
    const wrongSameLength = BEARER.slice(0, -1) + (BEARER.at(-1) === "x" ? "y" : "x");
    const res = makeRes();
    await handleNotifyDelivery(
      makeReq({ headers: { authorization: `Bearer ${wrongSameLength}` } }),
      res,
      BEARER,
      dependencies(repository)
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects non-POST and malformed requests", async () => {
    const getResponse = makeRes();
    await handleNotifyDelivery(makeReq({ method: "GET" }), getResponse, BEARER, dependencies(repository));
    expect(getResponse.status).toHaveBeenCalledWith(405);

    for (const body of [
      { to: "alice@example.com", status: "delivered" },
      { id: "x", status: "delivered" },
      { id: "x", to: "alice@example.com", status: "unknown" },
    ]) {
      const response = makeRes();
      await handleNotifyDelivery(makeReq({ body }), response, BEARER, dependencies(repository));
      expect(response.status).toHaveBeenCalledWith(400);
    }
  });

  it("persists and ignores temporary and technical failures", async () => {
    for (const status of ["temporary-failure", "technical-failure"] as const) {
      const id = `notify-${status}`;
      const res = await sendReceipt(repository, receipt({ id, status }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(repository.receipts.get(id)?.outcome).toBe(NotifyDeliveryReceiptOutcome.IGNORED_STATUS);
    }
    expect(repository.userStateApplyCount).toBe(0);
  });

  it("returns a retryable response while the same receipt has a fresh processing lease", async () => {
    const pending = receipt({ id: "fresh-pending", status: "temporary-failure" });
    repository.receipts.set(pending.id, {
      id: pending.id,
      notifyStatus: pending.status,
      reference: null,
      recipientHash: recipientHashForEmail(pending.to),
      userId: null,
      eventAt: pending.completed_at!,
      eventOrderingKey: `${pending.completed_at}:${pending.id}`,
      affectsBounceState: false,
      processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
      outcome: null,
      attemptCount: 1,
      lastAttemptedAt: NOW,
      processedAt: null,
      lastErrorMessage: null,
    });

    const res = await sendReceipt(repository, pending);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("Retry Later");
  });

  it("rejects a replay that reuses a receipt ID with conflicting metadata", async () => {
    repository.addUser();
    await sendReceipt(repository, receipt({ id: "conflicting-id", status: "permanent-failure" }));

    const res = await sendReceipt(repository, receipt({ id: "conflicting-id", status: "delivered" }));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith("Conflicting receipt");
  });

  it("logs only the error type when processing fails", async () => {
    const errorLog = vi.spyOn(logger, "error");
    repository.getReceipt = vi.fn().mockRejectedValue(new Error("database failure for alice@example.com"));
    const res = makeRes();

    await expect(
      handleNotifyDelivery(
        makeReq({ body: receipt({ id: "processing-error", status: "temporary-failure" }) }),
        res,
        BEARER,
        dependencies(repository)
      )
    ).rejects.toThrow("database failure");

    const serializedLogs = JSON.stringify(errorLog.mock.calls);
    expect(serializedLogs).toContain("Error");
    expect(serializedLogs).not.toContain("alice@example.com");
  });

  it("logs receipt correlation data without the recipient email address", async () => {
    const info = vi.spyOn(logger, "info");
    repository.addUser();
    await sendReceipt(
      repository,
      receipt({ id: "pii-safe-log", reference: "guest-request-mod:request-1:alice@example.com" })
    );

    const serializedLogs = JSON.stringify(info.mock.calls);
    expect(serializedLogs).toContain("pii-safe-log");
    expect(serializedLogs).toContain("recipientHash");
    expect(serializedLogs).toContain("referenceHash");
    expect(serializedLogs).not.toContain("alice@example.com");
  });

  it("applies a duplicate permanent-failure receipt only once", async () => {
    const user = repository.addUser();
    const failure = receipt({ id: "failure-1", status: "permanent-failure" });

    await sendReceipt(repository, failure);
    await sendReceipt(repository, failure);

    expect(user.emailBounceCount).toBe(1);
    expect(user.emailDeliveryVersion).toBe(1);
    expect(repository.userStateApplyCount).toBe(1);
    expect(repository.receipts).toHaveLength(1);
  });

  it("applies a duplicate delivered receipt only once", async () => {
    const user = repository.addUser({ emailBounceCount: 2 });
    const delivered = receipt({ id: "delivered-1" });

    await sendReceipt(repository, delivered);
    await sendReceipt(repository, delivered);

    expect(user.emailBounceCount).toBe(0);
    expect(user.emailDeliveryVersion).toBe(1);
    expect(repository.userStateApplyCount).toBe(1);
  });

  it("does not let an older delivered receipt reset a newer failure", async () => {
    const user = repository.addUser();
    await sendReceipt(
      repository,
      receipt({ id: "new-failure", status: "permanent-failure", completed_at: "2026-07-17T12:00:00.000Z" })
    );
    await sendReceipt(
      repository,
      receipt({ id: "old-delivery", status: "delivered", completed_at: "2026-07-17T11:00:00.000Z" })
    );

    expect(user.emailBounceCount).toBe(1);
    expect(user.emailDeliveryStatus).toBe("permanent-failure");
    expect(user.emailDeliveryReceiptId).toBe("new-failure");
  });

  it("recomputes consecutive failures correctly when they arrive out of order", async () => {
    const user = repository.addUser();
    await sendReceipt(
      repository,
      receipt({ id: "newer-failure", status: "permanent-failure", completed_at: "2026-07-17T12:00:00.000Z" })
    );
    await sendReceipt(
      repository,
      receipt({ id: "older-failure", status: "permanent-failure", completed_at: "2026-07-17T11:00:00.000Z" })
    );

    expect(user.emailBounceCount).toBe(2);
    expect(user.emailDeliveryReceiptId).toBe("newer-failure");
  });

  it("handles concurrent delivery of the same receipt without duplicate effects", async () => {
    const user = repository.addUser();
    const failure = receipt({ id: "concurrent-same", status: "permanent-failure" });
    const responses = await Promise.all([
      sendReceipt(repository, failure),
      sendReceipt(repository, failure),
      sendReceipt(repository, failure),
    ]);

    expect(user.emailBounceCount).toBe(1);
    expect(repository.userStateApplyCount).toBe(1);
    expect(repository.receipts).toHaveLength(1);
    expect(responses.map((response) => (response.status as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(200);
  });

  it("serializes concurrent distinct failures with compare-and-swap updates", async () => {
    const user = repository.addUser();
    const onMembershipLost = vi.fn();
    await Promise.all([
      sendReceipt(repository, receipt({ id: "failure-1", status: "permanent-failure", completed_at: "2026-07-17T10:00:00Z" }), onMembershipLost),
      sendReceipt(repository, receipt({ id: "failure-2", status: "permanent-failure", completed_at: "2026-07-17T11:00:00Z" }), onMembershipLost),
      sendReceipt(repository, receipt({ id: "failure-3", status: "permanent-failure", completed_at: "2026-07-17T12:00:00Z" }), onMembershipLost),
    ]);

    expect(user.emailBounceCount).toBe(BOUNCE_THRESHOLD);
    expect(user.membershipStatus).toBe(MembershipStatus.LOST);
    expect(onMembershipLost).toHaveBeenCalledTimes(1);
  });

  it("reclaims a stale PENDING receipt without replaying an already-applied effect", async () => {
    const user = repository.addUser({
      emailBounceCount: 1,
      emailLastBounceAt: "2026-07-17T12:00:00.000Z",
      emailDeliveryVersion: 1,
      emailDeliveryStatus: "permanent-failure",
      emailDeliveryStatusUpdatedAt: "2026-07-17T12:00:00.000Z",
      emailDeliveryReceiptId: "stale-receipt",
    });
    const stale = receipt({ id: "stale-receipt", status: "permanent-failure" });
    const recipientHash = recipientHashForEmail(stale.to);
    repository.receipts.set(stale.id, {
      id: stale.id,
      notifyStatus: stale.status,
      reference: null,
      recipientHash,
      userId: user.id,
      eventAt: stale.completed_at!,
      eventOrderingKey: `${stale.completed_at}:${stale.id}`,
      affectsBounceState: true,
      processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
      outcome: null,
      attemptCount: 1,
      lastAttemptedAt: "2026-07-17T12:00:00.000Z",
      processedAt: null,
      lastErrorMessage: null,
    });

    await sendReceipt(repository, stale);

    expect(user.emailBounceCount).toBe(1);
    expect(repository.userStateApplyCount).toBe(0);
    expect(repository.receipts.get(stale.id)?.attemptCount).toBe(2);
    expect(repository.receipts.get(stale.id)?.processingStatus).toBe(
      NotifyDeliveryReceiptProcessingStatus.PROCESSED
    );
  });

  it(`marks the user LOST exactly when the ${BOUNCE_THRESHOLD} failure threshold is reached`, async () => {
    const user = repository.addUser();
    const onMembershipLost = vi.fn();
    for (let index = 1; index <= BOUNCE_THRESHOLD; index += 1) {
      await sendReceipt(
        repository,
        receipt({
          id: `threshold-${index}`,
          status: "permanent-failure",
          completed_at: `2026-07-17T1${index}:00:00.000Z`,
        }),
        onMembershipLost
      );
    }

    expect(user.emailBounceCount).toBe(BOUNCE_THRESHOLD);
    expect(user.membershipStatus).toBe(MembershipStatus.LOST);
    expect(onMembershipLost).toHaveBeenCalledTimes(1);
  });

  it("keeps announcement delivery state ordered independently of callback arrival", async () => {
    const sendId = "11111111-1111-4111-8111-111111111111";
    const recipientId = "22222222-2222-4222-8222-222222222222";
    const reference = `announcement:${sendId}:${recipientId}`;
    repository.addUser({ id: recipientId });
    const announcement = repository.addAnnouncement(sendId, recipientId);

    await sendReceipt(
      repository,
      receipt({
        id: "announcement-failure",
        status: "permanent-failure",
        reference,
        completed_at: "2026-07-17T12:00:00.000Z",
      })
    );
    await sendReceipt(
      repository,
      receipt({
        id: "announcement-old-delivery",
        status: "delivered",
        reference,
        completed_at: "2026-07-17T11:00:00.000Z",
      })
    );

    expect(announcement.status).toBe("bounced");
    expect(announcement.failureReason).toBe("GOV Notify reported permanent-failure");
    expect(announcement.deliveryReceiptId).toBe("announcement-failure");
    expect(repository.announcementStateApplyCount).toBe(1);
  });

  it("returns 200 and records the receipt when no user or announcement recipient exists", async () => {
    const res = await sendReceipt(repository, receipt({ id: "unknown-recipient" }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(repository.receipts.get("unknown-recipient")?.outcome).toBe(
      NotifyDeliveryReceiptOutcome.IGNORED_NO_USER
    );
  });
});
