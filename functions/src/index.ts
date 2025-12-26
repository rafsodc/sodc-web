import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

setGlobalOptions({ maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

export const grantAdmin = onRequest(async (req, res) => {
  const secret = req.query.secret;
  const uid = req.query.uid;

  const EXPECTED_SECRET = "sdfsdfgregergerger";

  if (secret !== EXPECTED_SECRET) {
    logger.error("Invalid secret");
    res.status(403).send("Forbidden");
    return;
  }

  if (!uid || typeof uid !== "string") {
    res.status(400).send("Missing uid");
    return;
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    logger.info(`Admin claim set for uid=${uid}`);
    res.status(200).send(`Admin claim set for uid=${uid}`);
  } catch (e: any) {
    logger.error(e);
    res.status(500).send(e?.message ?? "Error setting custom claim");
  }
});