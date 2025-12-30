import { setGlobalOptions } from "firebase-functions";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";


setGlobalOptions({ region: "europe-west2", maxInstances: 10 });

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

export const listAdminUsers = onCall(
  { region: "europe-west2" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Admins only");
    }

    try {
      // List all users from Firebase Auth
      const listUsersResult = await admin.auth().listUsers();
      
      // Filter users that have admin claim
      const adminUsers = listUsersResult.users
        .map((userRecord) => {
          const customClaims = userRecord.customClaims || {};
          if (customClaims.admin === true) {
            return {
              uid: userRecord.uid,
              email: userRecord.email || "",
              displayName: userRecord.displayName || "",
              emailVerified: userRecord.emailVerified,
              disabled: userRecord.disabled,
              metadata: {
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
              },
            };
          }
          return null;
        })
        .filter((user) => user !== null);

      logger.info(`Found ${adminUsers.length} admin users for caller ${request.auth.uid}`);
      return { users: adminUsers };
    } catch (e: any) {
      logger.error("Error listing admin users:", e);
      throw new HttpsError("internal", e?.message ?? "Error listing admin users");
    }
  }
);