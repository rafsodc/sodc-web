import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admin from "@dataconnect/admin-generated";
import {
  MembershipStatus,
  NotifyDeliveryReceiptOutcome,
  NotifyDeliveryReceiptProcessingStatus,
} from "@dataconnect/admin-generated";
import type { UUIDString } from "@dataconnect/admin-generated";
import { dataConnectNotifyReceiptRepository } from "../notifyReceiptProcessor.js";

const RECEIPT_ID = "notify-receipt-1";
const EVENT_AT = "2026-07-17T12:00:00.000Z";
const ORDERING_KEY = `${EVENT_AT}:${RECEIPT_ID}`;

describe("Data Connect Notify receipt repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps receipt ledger reads, creation, claims, and finalization", async () => {
    const getReceipt = vi.spyOn(admin, "getNotifyDeliveryReceipt");
    const createReceipt = vi.spyOn(admin, "createNotifyDeliveryReceipt");
    const claimReceipt = vi.spyOn(admin, "claimNotifyDeliveryReceipt");
    const markProcessed = vi.spyOn(admin, "markNotifyDeliveryReceiptProcessed");
    const markFailed = vi.spyOn(admin, "markNotifyDeliveryReceiptFailed");

    getReceipt
      .mockResolvedValueOnce({ data: { notifyDeliveryReceipt: undefined } } as never)
      .mockResolvedValueOnce({
        data: {
          notifyDeliveryReceipt: {
            id: RECEIPT_ID,
            notifyStatus: "delivered",
            reference: null,
            recipientHash: "recipient-hash",
            userId: "user-1",
            eventAt: EVENT_AT,
            eventOrderingKey: ORDERING_KEY,
            affectsBounceState: true,
            processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
            outcome: null,
            attemptCount: 1,
            lastAttemptedAt: EVENT_AT,
            processedAt: null,
          },
        },
      } as never);
    createReceipt.mockResolvedValue({ data: { notifyDeliveryReceipt_insert: { id: RECEIPT_ID } } } as never);
    claimReceipt.mockResolvedValue({ data: { notifyDeliveryReceipt_updateMany: 1 } } as never);
    markProcessed.mockResolvedValue({ data: { notifyDeliveryReceipt_updateMany: 1 } } as never);
    markFailed.mockResolvedValue({ data: { notifyDeliveryReceipt_updateMany: 0 } } as never);

    await expect(dataConnectNotifyReceiptRepository.getReceipt(RECEIPT_ID)).resolves.toBeNull();
    await expect(dataConnectNotifyReceiptRepository.getReceipt(RECEIPT_ID)).resolves.toMatchObject({
      id: RECEIPT_ID,
      processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
      attemptCount: 1,
    });
    await expect(
      dataConnectNotifyReceiptRepository.createReceipt({
        id: RECEIPT_ID,
        notifyStatus: "delivered",
        reference: null,
        recipientHash: "recipient-hash",
        userId: "user-1",
        eventAt: EVENT_AT,
        eventOrderingKey: ORDERING_KEY,
        affectsBounceState: true,
        lastAttemptedAt: EVENT_AT,
      })
    ).resolves.toMatchObject({
      id: RECEIPT_ID,
      processingStatus: NotifyDeliveryReceiptProcessingStatus.PENDING,
      attemptCount: 1,
    });
    await expect(
      dataConnectNotifyReceiptRepository.tryClaimReceipt({
        id: RECEIPT_ID,
        expectedProcessingStatus: NotifyDeliveryReceiptProcessingStatus.FAILED,
        expectedAttemptCount: 1,
        attemptCount: 2,
        lastAttemptedAt: EVENT_AT,
      })
    ).resolves.toBe(true);
    await expect(
      dataConnectNotifyReceiptRepository.markReceiptProcessed({
        id: RECEIPT_ID,
        attemptCount: 2,
        outcome: NotifyDeliveryReceiptOutcome.APPLIED,
        processedAt: EVENT_AT,
      })
    ).resolves.toBe(true);
    await expect(
      dataConnectNotifyReceiptRepository.markReceiptFailed({
        id: RECEIPT_ID,
        attemptCount: 2,
        lastErrorMessage: "failure",
      })
    ).resolves.toBe(false);
  });

  it("maps user reads, ordered receipt history, and both user CAS mutations", async () => {
    const getByEmail = vi.spyOn(admin, "getUserByEmail");
    const getById = vi.spyOn(admin, "getNotifyCallbackUserById");
    const getRecent = vi.spyOn(admin, "getRecentNotifyDeliveryReceiptsForUser");
    const applyState = vi.spyOn(admin, "tryApplyNotifyDeliveryUserState");
    const applyStateAndLost = vi.spyOn(admin, "tryApplyNotifyDeliveryUserStateAndMarkLost");
    const user = {
      id: "user-1",
      membershipStatus: MembershipStatus.REGULAR,
      emailBounceCount: 1,
      emailLastBounceAt: EVENT_AT,
      emailDeliveryVersion: 2,
      emailDeliveryStatus: "permanent-failure",
      emailDeliveryStatusUpdatedAt: EVENT_AT,
      emailDeliveryReceiptId: RECEIPT_ID,
    };

    getByEmail
      .mockResolvedValueOnce({ data: { users: [] } } as never)
      .mockResolvedValueOnce({ data: { users: [user] } } as never);
    getById
      .mockResolvedValueOnce({ data: { user: undefined } } as never)
      .mockResolvedValueOnce({ data: { user } } as never);
    getRecent.mockResolvedValue({
      data: {
        notifyDeliveryReceipts: [
          { id: RECEIPT_ID, notifyStatus: "permanent-failure", eventAt: EVENT_AT, eventOrderingKey: ORDERING_KEY },
        ],
      },
    } as never);
    applyState.mockResolvedValue({ data: { user_updateMany: 1 } } as never);
    applyStateAndLost.mockResolvedValue({ data: { user_updateMany: 0 } } as never);

    await expect(dataConnectNotifyReceiptRepository.findUserByEmail("alice@example.com")).resolves.toBeNull();
    await expect(dataConnectNotifyReceiptRepository.findUserByEmail("alice@example.com")).resolves.toMatchObject(user);
    await expect(dataConnectNotifyReceiptRepository.getUserById("user-1")).resolves.toBeNull();
    await expect(dataConnectNotifyReceiptRepository.getUserById("user-1")).resolves.toMatchObject(user);
    await expect(dataConnectNotifyReceiptRepository.getRecentStateReceiptsForUser("user-1")).resolves.toEqual([
      { id: RECEIPT_ID, notifyStatus: "permanent-failure", eventAt: EVENT_AT, eventOrderingKey: ORDERING_KEY },
    ]);

    const state = {
      userId: "user-1",
      expectedEmailDeliveryVersion: 2,
      emailDeliveryVersion: 3,
      emailBounceCount: 2,
      emailLastBounceAt: EVENT_AT,
      emailDeliveryStatus: "permanent-failure",
      emailDeliveryStatusUpdatedAt: EVENT_AT,
      emailDeliveryReceiptId: RECEIPT_ID,
    };
    await expect(dataConnectNotifyReceiptRepository.tryApplyUserState({ ...state, markLost: false })).resolves.toBe(true);
    await expect(dataConnectNotifyReceiptRepository.tryApplyUserState({ ...state, markLost: true })).resolves.toBe(false);
    expect(applyState).toHaveBeenCalledWith(state);
    expect(applyStateAndLost).toHaveBeenCalledWith(state);
  });

  it("maps announcement recipient reads, latest receipts, and versioned updates", async () => {
    const getRecipient = vi.spyOn(admin, "getAnnouncementRecipientBySendAndUser");
    const getLatest = vi.spyOn(admin, "getLatestNotifyDeliveryReceiptForReference");
    const updateRecipient = vi.spyOn(admin, "tryUpdateAnnouncementRecipientDeliveryStatus");
    const recipientId = "33333333-3333-4333-8333-333333333333" as UUIDString;

    getRecipient
      .mockResolvedValueOnce({ data: { announcementRecipients: [] } } as never)
      .mockResolvedValueOnce({
        data: {
          announcementRecipients: [
            {
              id: recipientId,
              status: "sent",
              failureReason: null,
              deliveryVersion: 0,
              deliveryStatusUpdatedAt: null,
              deliveryReceiptId: null,
            },
          ],
        },
      } as never);
    getLatest
      .mockResolvedValueOnce({ data: { notifyDeliveryReceipts: [] } } as never)
      .mockResolvedValueOnce({
        data: {
          notifyDeliveryReceipts: [
            { id: RECEIPT_ID, notifyStatus: "delivered", eventAt: EVENT_AT, eventOrderingKey: ORDERING_KEY },
          ],
        },
      } as never);
    updateRecipient.mockResolvedValue({ data: { announcementRecipient_updateMany: 1 } } as never);

    await expect(dataConnectNotifyReceiptRepository.findAnnouncementRecipient("send-1", "user-1")).resolves.toBeNull();
    await expect(
      dataConnectNotifyReceiptRepository.findAnnouncementRecipient("send-1", "user-1")
    ).resolves.toMatchObject({ id: recipientId, deliveryVersion: 0 });
    await expect(
      dataConnectNotifyReceiptRepository.getLatestStateReceiptForReference("announcement:send-1:user-1")
    ).resolves.toBeNull();
    await expect(
      dataConnectNotifyReceiptRepository.getLatestStateReceiptForReference("announcement:send-1:user-1")
    ).resolves.toMatchObject({ id: RECEIPT_ID, notifyStatus: "delivered" });
    await expect(
      dataConnectNotifyReceiptRepository.tryApplyAnnouncementState({
        id: recipientId,
        expectedDeliveryVersion: 0,
        deliveryVersion: 1,
        status: "delivered",
        failureReason: null,
        deliveryStatusUpdatedAt: EVENT_AT,
        deliveryReceiptId: RECEIPT_ID,
      })
    ).resolves.toBe(true);
  });
});
