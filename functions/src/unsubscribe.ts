import { onRequest, type Request } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
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

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requestString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function confirmationPage(token: string, sectionName: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirm unsubscribe</title>
</head>
<body>
  <main>
    <h1>Unsubscribe from ${htmlEscape(sectionName)}?</h1>
    <p>You will stop receiving announcement emails for this section.</p>
    <form method="post" action="/unsubscribe">
      <input type="hidden" name="token" value="${htmlEscape(token)}">
      <input type="hidden" name="browserConfirmation" value="1">
      <button type="submit">Confirm unsubscribe</button>
    </form>
  </main>
</body>
</html>`;
}

export interface UnsubscribeHandlerDependencies {
  optOut?: typeof adminOptOutSectionAnnouncement;
}

export async function handleUnsubscribeRequest(
  req: Request,
  res: Response,
  secret: string,
  dependencies: UnsubscribeHandlerDependencies = {}
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).send("Method Not Allowed");
    return;
  }

  // Token-bearing responses must not be cached or exposed as referrers. A
  // successful browser POST redirects to a token-free confirmation URL.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  const token = requestString(req.query.token) ?? requestString(req.body?.token);
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }

  let payload: UnsubscribePayload;
  try {
    payload = verifyUnsubscribeToken(token, secret);
  } catch {
    res.status(400).send("Invalid or expired unsubscribe link");
    return;
  }

  if (req.method === "GET") {
    res.status(200).type("html").send(confirmationPage(token, payload.sectionName));
    return;
  }

  try {
    await (dependencies.optOut ?? adminOptOutSectionAnnouncement)({
      userId: payload.userId,
      sectionId: payload.sectionId,
    });
  } catch (err) {
    logger.error("Failed to record announcement opt-out", {
      err,
      userId: payload.userId,
      sectionId: payload.sectionId,
    });
    res.status(500).send("Unsubscribe failed — please try again later");
    return;
  }

  if (req.body?.browserConfirmation === "1") {
    const params = new URLSearchParams({ section: payload.sectionName });
    res.redirect(303, `${APP_BASE_URL}/unsubscribe/confirmed?${params.toString()}`);
    return;
  }

  // RFC 8058 one-click unsubscribe — email clients POST to the signed URL.
  res.status(200).send("OK");
}

// ── Cloud Function ────────────────────────────────────────────────────────────

export const unsubscribeAnnouncement = onRequest(
  { region: FUNCTIONS_REGION, secrets: [unsubscribeSecret], invoker: "public" },
  (req, res) => handleUnsubscribeRequest(req, res, unsubscribeSecret.value())
);
