import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {
  getUserByEmail,
  updateEmailBounceStats,
  updateUserMembershipStatus,
  MembershipStatus,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";

export const notifyCallbackSecret = defineSecret("NOTIFY_CALLBACK_BEARER_TOKEN");

const BOUNCE_THRESHOLD = 3;

// GOV Notify delivery receipt payload (subset of fields we use)
interface NotifyReceipt {
  id: string;
  reference?: string;
  to: string;
  status: "delivered" | "permanent-failure" | "temporary-failure" | "technical-failure";
  notification_type?: string;
  created_at?: string;
  completed_at?: string;
  sent_at?: string;
}

export const notifyDeliveryCallback = onRequest(
  { region: FUNCTIONS_REGION, secrets: [notifyCallbackSecret], invoker: "public" },
  async (req, res) => {
    // Verify bearer token
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const expected = notifyCallbackSecret.value();
    if (!token || token !== expected) {
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

    // Only permanent-failure affects the bounce count
    if (receipt.status !== "delivered" && receipt.status !== "permanent-failure") {
      res.status(200).send("OK");
      return;
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
        logger.info("Set membership status to LOST due to repeated email bounces", {
          userId: user.id,
          bounceCount: newCount,
        });
      }
    }

    res.status(200).send("OK");
  }
);
