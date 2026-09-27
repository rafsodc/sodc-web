import { createHash } from "node:crypto";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  listPotentialLostProfiles, getPotentialLostProfile, confirmPotentialLost,
  type GetPotentialLostProfileData,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireAdmin, requireString, handleFunctionError, listAllAuthUsers } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { isOlderThanYears } from "./memberReviewRules";
import { canUserChangeStatus } from "./validation";
import { persistMembershipStatusWithEnabledClaim, sendMembershipStatusEmailIfChanged } from "./membershipStatus";
import { reconcileEnabledClaim } from "./enabledClaimReconciliation";
import { invalidateDcProfileCache } from "./users";
import { govNotifySecrets } from "./mailer";

type Profile = NonNullable<GetPotentialLostProfileData["user"]>;

export function potentialLostCandidate(profile: Profile, auth: admin.auth.UserRecord, now = new Date()) {
  if (profile.membershipStatus === "LOST") return null;
  const lastSignInTime = auth.metadata.lastSignInTime || null;
  const inactivitySince = lastSignInTime || auth.metadata.creationTime || null;
  const reasons: string[] = [];
  if (isOlderThanYears(inactivitySince, 3, now)) reasons.push("INACTIVE");
  if (profile.emailBounceCount >= 3) reasons.push("BOUNCES");
  if (!reasons.length) return null;
  const validation = canUserChangeStatus(profile.membershipStatus, "LOST", true, auth.customClaims?.admin === true, true);
  return {
    id: profile.id, firstName: profile.firstName, lastName: profile.lastName,
    email: profile.email, membershipStatus: profile.membershipStatus,
    lastSignInTime, inactivitySince, emailBounceCount: profile.emailBounceCount,
    emailLastBounceAt: profile.emailLastBounceAt ?? null, reasons,
    canConfirm: validation.allowed, blockedReason: validation.allowed ? null : validation.error ?? "This status cannot be changed to Lost",
    reviewToken: createHash("sha256").update(JSON.stringify({ profile, lastSignInTime, inactivitySince, reasons, admin: auth.customClaims?.admin === true })).digest("hex"),
  };
}

export const listPotentialLostMembers = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  requireAdmin(request);
  await enforceRateLimit("listPotentialLostMembers", request.auth!.uid);
  try {
    const authUsers = new Map((await listAllAuthUsers()).map((user) => [user.uid, user]));
    const members = [];
    const now = new Date();
    for (let offset = 0; ; offset += 500) {
      const { data } = await listPotentialLostProfiles({ limit: 500, offset });
      for (const profile of data.users) {
        const auth = authUsers.get(profile.id);
        if (!auth) continue;
        const candidate = potentialLostCandidate(profile, auth, now);
        if (candidate) members.push(candidate);
      }
      if (data.users.length < 500) break;
    }
    members.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
    return { members };
  } catch (error) { handleFunctionError(error, "listing potential lost members"); }
});

export const confirmPotentialLostMember = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] }, async (request) => {
    requireAdmin(request);
    await enforceRateLimit("confirmPotentialLostMember", request.auth!.uid);
    const userId = requireString(request.data?.userId, "userId");
    const reviewToken = requireString(request.data?.reviewToken, "reviewToken");
    try {
      const [profileResult, auth] = await Promise.all([getPotentialLostProfile({ id: userId }), admin.auth().getUser(userId)]);
      const profile = profileResult.data.user;
      if (!profile) throw new HttpsError("not-found", "Member not found");
      if (profile.membershipStatus === "LOST") {
        // Retrying a completed confirmation repairs a partial claim failure without another audit entry.
        await reconcileEnabledClaim(userId, "LOST");
        return { success: true };
      }
      const candidate = potentialLostCandidate(profile, auth);
      if (!candidate || candidate.reviewToken !== reviewToken) throw new HttpsError("failed-precondition", "The member's details have changed. Refresh the list and review them again.");
      if (!candidate.canConfirm) throw new HttpsError("permission-denied", candidate.blockedReason!);
      try {
        await persistMembershipStatusWithEnabledClaim(userId, "LOST", {
          updateMembershipStatus: async () => {
            await confirmPotentialLost({
              userId, expectedStatus: profile.membershipStatus, expectedUpdatedAt: profile.updatedAt,
              expectedEmailDeliveryVersion: profile.emailDeliveryVersion, reviewedBy: request.auth!.uid,
              reasons: candidate.reasons, lastSignInTime: candidate.lastSignInTime, emailBounceCount: candidate.emailBounceCount,
            });
            invalidateDcProfileCache();
          },
        });
      } catch (error) {
        // The existing fail-closed helper revokes access first. On a failed CAS/write,
        // reconcile to the actual stored status so stale reviews do not leave access revoked.
        const latest = await getPotentialLostProfile({ id: userId });
        if (latest.data.user) await reconcileEnabledClaim(userId, latest.data.user.membershipStatus);
        if (String(error).includes("POTENTIAL_LOST_CONFLICT")) throw new HttpsError("failed-precondition", "The member's details have changed. Refresh the list and review them again.");
        throw error;
      }
      await sendMembershipStatusEmailIfChanged({ userId, previousStatus: profile.membershipStatus, newStatus: "LOST", appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173" });
      return { success: true };
    } catch (error) { handleFunctionError(error, "confirming lost membership"); }
  },
);
