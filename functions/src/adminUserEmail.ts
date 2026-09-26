import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FUNCTIONS_REGION } from "./constants";
import { requireAdmin, requireString, validateEmail } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { withUserEmailLease } from "./userEmailSync";
import { requestEmailVerificationForUser, type AuthEmailTemplates } from "./authEmailActions";
import { createConfiguredGovNotifyMailer, govNotifySecrets } from "./mailer";

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
}

export const updateUserEmail = onCall(
  { region: FUNCTIONS_REGION, timeoutSeconds: 60, secrets: [...govNotifySecrets] },
  async (request) => {
    requireAdmin(request);
    const actorUid = request.auth!.uid;
    const userId = requireString(request.data?.userId, "userId");
    const email = validateEmail(requireString(request.data?.email, "email"));
    const expectedEmail = validateEmail(requireString(request.data?.expectedEmail, "expectedEmail"));
    await enforceRateLimit("updateUserEmail", actorUid);
    logger.info("admin user-email update started", { actorUid, userId, outcome: "started" });

    try {
      return await withUserEmailLease(userId, async (writeEmail) => {
        let user = await admin.auth().getUser(userId);
        const currentEmail = user.email?.trim().toLowerCase();
        // A stale form must not overwrite another administrator's change. The
        // desired value is accepted for idempotent recovery after a partial save.
        if (currentEmail !== expectedEmail && currentEmail !== email) {
          throw new HttpsError("failed-precondition", "The sign-in email has changed. Reopen the user and try again.", {
            code: "EMAIL_CHANGE_CONFLICT",
          });
        }
        const changed = currentEmail !== email;
        try {
          if (changed) {
            user = await admin.auth().updateUser(userId, { email, emailVerified: false });
          }
          // Repeat revocation on an unverified retry, including recovery after a
          // successful Auth write whose response was lost. Never change claims.
          if (changed || !user.emailVerified) {
            await admin.auth().revokeRefreshTokens(userId);
          }
          const fresh = await admin.auth().getUser(userId);
          const authoritativeEmail = validateEmail(fresh.email || "");
          await writeEmail(authoritativeEmail, actorUid);
          if (authoritativeEmail !== email) {
            throw new HttpsError("failed-precondition", "The sign-in email changed during this update. Reopen the user and try again.", {
              code: "EMAIL_CHANGE_CONFLICT",
            });
          }
          user = fresh;
        } catch (error) {
          // There is no cross-service transaction. Auth is authoritative: never
          // roll it back and risk overwriting a newer verified change. Repair the
          // profile from a fresh Auth read, and make any incomplete save explicit.
          let repaired = false;
          try {
            const fresh = await admin.auth().getUser(userId);
            await writeEmail(validateEmail(fresh.email || ""), actorUid);
            repaired = true;
          } catch { /* Report below; retrying the same address resumes safely. */ }
          logger.error("admin user-email update incomplete", {
            actorUid, userId, outcome: repaired ? "profile-reconciled" : "recovery-required", errorCode: errorCode(error),
          });
          if (["auth/email-already-exists", "auth/invalid-email", "auth/user-not-found"].includes(errorCode(error))) throw error;
          if (error instanceof HttpsError && error.details) throw error;
          throw new HttpsError("unavailable", "The email update could not be completed. Retry with the same address to finish synchronising the account.", {
            code: "EMAIL_CHANGE_INCOMPLETE",
          });
        }

        let verificationEmailSent = false;
        if (!user.emailVerified) {
          try {
            await requestEmailVerificationForUser(email, {
              generateEmailVerificationLink: (address, settings) => admin.auth().generateEmailVerificationLink(address, settings),
              mailer: createConfiguredGovNotifyMailer<AuthEmailTemplates>(["emailVerification"]),
            });
            verificationEmailSent = true;
          } catch (error) {
            logger.warn("admin user-email verification delivery failed", { actorUid, userId, errorCode: errorCode(error) });
          }
        }
        logger.info("admin user-email update completed", {
          actorUid, userId, outcome: changed ? "changed" : "reconciled", verificationEmailSent,
        });
        return { success: true as const, email, verificationRequired: !user.emailVerified, verificationEmailSent };
      });
    } catch (error) {
      logger.warn("admin user-email update failed", { actorUid, userId, outcome: "failed", errorCode: errorCode(error) });
      if (error instanceof HttpsError) throw error;
      switch (errorCode(error)) {
        case "auth/email-already-exists":
          throw new HttpsError("already-exists", "This email address is already linked to another account.", { code: "EMAIL_ALREADY_IN_USE" });
        case "auth/invalid-email":
          throw new HttpsError("invalid-argument", "Enter a valid email address.");
        case "auth/user-not-found":
          throw new HttpsError("not-found", "The sign-in account could not be found.");
        default:
          throw new HttpsError("unavailable", "The email update could not be completed. Retry with the same address.", { code: "EMAIL_CHANGE_INCOMPLETE" });
      }
    }
  },
);
