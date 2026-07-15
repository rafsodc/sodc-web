import { onRequest, type Request } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import {
  getUserByEmail,
  updateEmailBounceStats,
  updateUserMembershipStatus,
  MembershipStatus,
  getAnnouncementRecipientBySendAndUser,
  updateAnnouncementRecipientDeliveryStatus,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants.js";
import { invalidateDcProfileCache } from "./users.js";
import { parseAnnouncementReference } from "./announcementReference.js";

export const notifyCallbackSecret = defineSecret("NOTIFY_CALLBACK_BEARER_TOKEN");

export const BOUNCE_THRESHOLD = 3;

export interface NotifyReceipt {
  id: string;
  reference?: string;
  to: string;
  status: "delivered" | "permanent-failure" | "temporary-failure" | "technical-failure";
  notification_type?: string;
  created_at?: string;
  completed_at?: string;
  sent_at?: string;
}

function isValidBearerToken(token: string, expected: string): boolean {
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  return tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf);
}

/**
 * Updates the specific AnnouncementRecipient row a delivery/bounce receipt is about (see #334).
 * Independent of the emailBounceCount/membershipStatus updates below, which are keyed by the
 * recipient's email address rather than a specific announcement send.
 */
async function applyAnnouncementDeliveryStatus(
  sendId: string,
  recipientId: string,
  status: "delivered" | "permanent-failure"
): Promise<void> {
  const result = await getAnnouncementRecipientBySendAndUser({ announcementSendId: sendId, userId: recipientId });
  const recipient = result.data?.announcementRecipients?.[0];
  if (!recipient) {
    logger.warn("No AnnouncementRecipient found for delivery receipt", { sendId, recipientId });
    return;
  }

  const newStatus = status === "delivered" ? "delivered" : "bounced";
  await updateAnnouncementRecipientDeliveryStatus({
    id: recipient.id,
    status: newStatus,
    failureReason: newStatus === "bounced" ? "GOV Notify reported permanent-failure" : null,
  });
  logger.info("Updated announcement recipient delivery status", { sendId, recipientId, status: newStatus });
}

export async function handleNotifyDelivery(
  req: Request,
  res: Response,
  bearerToken: string
): Promise<void> {
  // Verify bearer token (constant-time compare — this is a shared secret, not just a lookup key)
  const authHeader = (req.headers["authorization"] as string | undefined) ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !isValidBearerToken(token, bearerToken)) {
    res.status(403).send("Forbidden");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const receipt = req.body as NotifyReceipt;
  if (!receipt?.to || !receipt?.status) {
    res.status(400).send("Bad Request");
    return;
  }

  logger.info("GOV Notify delivery receipt", {
    id: receipt.id,
    to: receipt.to,
    status: receipt.status,
    reference: receipt.reference,
  });

  // Only permanent-failure and delivered affect the bounce count
  if (receipt.status !== "delivered" && receipt.status !== "permanent-failure") {
    res.status(200).send("OK");
    return;
  }

  const parsedReference = parseAnnouncementReference(receipt.reference);
  if (parsedReference) {
    await applyAnnouncementDeliveryStatus(parsedReference.sendId, parsedReference.recipientId, receipt.status);
  }

  // Look up user by email address
  const userResult = await getUserByEmail({ email: receipt.to });
  const user = userResult.data?.users?.[0];
  if (!user) {
    logger.warn("No user found for delivery receipt email", { to: receipt.to });
    res.status(200).send("OK");
    return;
  }

  if (receipt.status === "delivered") {
    if (user.emailBounceCount > 0) {
      await updateEmailBounceStats({
        userId: user.id,
        emailBounceCount: 0,
        emailLastBounceAt: null,
      });
      logger.info("Reset email bounce count", { userId: user.id });
    }
  } else {
    const newCount = user.emailBounceCount + 1;
    await updateEmailBounceStats({
      userId: user.id,
      emailBounceCount: newCount,
      emailLastBounceAt: new Date().toISOString(),
    });
    logger.info("Incremented email bounce count", { userId: user.id, newCount });

    if (newCount >= BOUNCE_THRESHOLD && user.membershipStatus !== MembershipStatus.LOST) {
      await updateUserMembershipStatus({ userId: user.id, membershipStatus: MembershipStatus.LOST });
      invalidateDcProfileCache();
      logger.info("Set membership status to LOST due to repeated email bounces", {
        userId: user.id,
        bounceCount: newCount,
      });
    }
  }

  res.status(200).send("OK");
}

export const notifyDeliveryCallback = onRequest(
  { region: FUNCTIONS_REGION, secrets: [notifyCallbackSecret], invoker: "public" },
  (req, res) => handleNotifyDelivery(req, res, notifyCallbackSecret.value())
);
