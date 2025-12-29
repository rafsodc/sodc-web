import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

setGlobalOptions({ maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

// CORS helper function
function setCorsHeaders(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export const grantAdmin = onRequest(async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.status(204).send("");
    return;
  }

  setCorsHeaders(res);

  const uid = req.query.uid as string | undefined;
  const authHeader = req.headers.authorization;

  // Get target UID from query or body
  const targetUid = uid || (req.body?.uid as string | undefined);

  if (!targetUid || typeof targetUid !== "string") {
    res.status(400).json({ error: "Missing uid parameter" });
    return;
  }

  // Verify Authorization header with Firebase token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.error("Missing or invalid Authorization header");
    res.status(401).json({ error: "Authorization header required" });
    return;
  }

  let callerUid: string | null = null;

  try {
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    callerUid = decodedToken.uid;

    // Check if caller has admin claim
    if (decodedToken.admin !== true) {
      logger.warn(`Caller uid=${callerUid} attempted to grant admin but does not have admin claim`);
      res.status(403).json({ error: "Forbidden: Admin claim required" });
      return;
    }

    logger.info(`Admin claim verified for caller uid=${callerUid}`);
  } catch (error: any) {
    logger.error("Error verifying token:", error);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    await admin.auth().setCustomUserClaims(targetUid, { admin: true });
    logger.info(`Admin claim set for uid=${targetUid} by caller=${callerUid}`);
    res.status(200).json({ 
      success: true,
      message: `Admin claim set for uid=${targetUid}`,
      grantedBy: callerUid
    });
  } catch (e: any) {
    logger.error("Error setting custom claim:", e);
    res.status(500).json({ error: e?.message ?? "Error setting custom claim" });
  }
});