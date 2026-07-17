import { onRequest, type Request } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { FUNCTIONS_REGION } from "./constants.js";
import {
  isNotifyDeliveryStatus,
  NotifyReceiptConflictError,
  processNotifyReceipt,
  recipientHashForEmail,
  type NotifyReceipt,
  type NotifyReceiptProcessorDependencies,
} from "./notifyReceiptProcessor.js";

export const notifyCallbackSecret = defineSecret("NOTIFY_CALLBACK_BEARER_TOKEN");

export { BOUNCE_THRESHOLD } from "./notifyReceiptProcessor.js";
export type { NotifyReceipt } from "./notifyReceiptProcessor.js";

function isValidBearerToken(token: string, expected: string): boolean {
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  return tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf);
}

export async function handleNotifyDelivery(
  req: Request,
  res: Response,
  bearerToken: string,
  processorDependencies: NotifyReceiptProcessorDependencies = {}
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

  const receipt = req.body as Partial<NotifyReceipt>;
  if (
    typeof receipt?.id !== "string" ||
    !receipt.id.trim() ||
    typeof receipt.to !== "string" ||
    !receipt.to.trim() ||
    !isNotifyDeliveryStatus(receipt.status)
  ) {
    res.status(400).send("Bad Request");
    return;
  }

  logger.info("GOV Notify delivery receipt", {
    receiptId: receipt.id,
    recipientHash: recipientHashForEmail(receipt.to),
    status: receipt.status,
    referenceHash:
      typeof receipt.reference === "string"
        ? createHash("sha256").update(receipt.reference).digest("hex")
        : undefined,
  });

  try {
    const result = await processNotifyReceipt(receipt as NotifyReceipt, processorDependencies);
    if (result.outcome === "in_progress") {
      res.status(503).send("Retry Later");
      return;
    }
  } catch (error) {
    if (error instanceof NotifyReceiptConflictError) {
      logger.warn("Rejected conflicting GOV Notify receipt replay", { receiptId: receipt.id });
      res.status(409).send("Conflicting receipt");
      return;
    }
    logger.error("Failed to process GOV Notify delivery receipt", {
      receiptId: receipt.id,
      status: receipt.status,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }

  res.status(200).send("OK");
}

export const notifyDeliveryCallback = onRequest(
  { region: FUNCTIONS_REGION, secrets: [notifyCallbackSecret], invoker: "public" },
  (req, res) => handleNotifyDelivery(req, res, notifyCallbackSecret.value())
);
