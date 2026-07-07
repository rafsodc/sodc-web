import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminOptOutSectionAnnouncement } from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";

export const unsubscribeSecret = defineSecret("UNSUBSCRIBE_SECRET");

const APP_BASE_URL = (() => {
  const url = process.env.APP_BASE_URL || "http://localhost:5173";
  try { new URL(url); } catch { throw new Error(`APP_BASE_URL is not a valid URL: "${url}"`); }
  return url.replace(/\/$/, "");
})();

// ── Token helpers ─────────────────────────────────────────────────────────────

interface UnsubscribePayload {
  userId: string;
  sectionId: string;
  sectionName: string;
  exp: number;
}

export function signUnsubscribeToken(payload: UnsubscribePayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyUnsubscribeToken(token: string, secret: string): UnsubscribePayload {
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new Error("Malformed token");
  const encoded = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(
    createHmac("sha256", secret).update(encoded).digest("base64url"),
    "base64url"
  );
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as UnsubscribePayload;
  if (Date.now() > payload.exp) throw new Error("Token expired");
  return payload;
}

// ── Cloud Function ────────────────────────────────────────────────────────────

export const unsubscribeAnnouncement = onRequest(
  { region: FUNCTIONS_REGION, secrets: [unsubscribeSecret], invoker: "public" },
  async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : undefined;

    if (!token) {
      res.status(400).send("Missing token");
      return;
    }

    const secret = unsubscribeSecret.value();
    let payload: UnsubscribePayload;
    try {
      payload = verifyUnsubscribeToken(token, secret);
    } catch {
      res.status(400).send("Invalid or expired unsubscribe link");
      return;
    }

    try {
      await adminOptOutSectionAnnouncement({
        userId: payload.userId,
        sectionId: payload.sectionId,
      });
    } catch (err) {
      logger.error("Failed to record announcement opt-out", { err, userId: payload.userId, sectionId: payload.sectionId });
      res.status(500).send("Unsubscribe failed — please try again later");
      return;
    }

    if (req.method === "POST") {
      // RFC 8058 one-click unsubscribe — email clients POST here
      res.status(200).send("OK");
      return;
    }

    // GET — redirect to confirmation page
    const params = new URLSearchParams({ section: payload.sectionName });
    res.redirect(302, `${APP_BASE_URL}/unsubscribe/confirmed?${params.toString()}`);
  }
);
