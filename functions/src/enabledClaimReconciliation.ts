import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

interface AuthClaimsUser {
  customClaims?: Record<string, unknown>;
}

export interface EnabledClaimAuthClient {
  getUser(userId: string): Promise<AuthClaimsUser>;
  setCustomUserClaims(userId: string, claims: Record<string, unknown>): Promise<void>;
}

export interface EnabledClaimReconciliationResult {
  enabled: boolean;
  updated: boolean;
}

/**
 * Membership status is the source of truth for enabled access. Admin status is
 * deliberately irrelevant: requireAdmin also requires enabled=true, so an
 * admin claim must never bypass a restricted membership status.
 */
export function enabledClaimForMembershipStatus(
  membershipStatus: MembershipStatus
): boolean {
  return isNonRestrictedStatus(membershipStatus);
}

/**
 * Reconciles the Firebase Auth enabled claim with the stored membership status.
 * Existing custom claims are preserved and write failures are surfaced to the
 * caller so the originating operation can be retried or repaired.
 */
export async function reconcileEnabledClaim(
  userId: string,
  membershipStatus: MembershipStatus,
  authClient: EnabledClaimAuthClient = admin.auth()
): Promise<EnabledClaimReconciliationResult> {
  const enabled = enabledClaimForMembershipStatus(membershipStatus);

  try {
    const userRecord = await authClient.getUser(userId);
    const currentClaims = userRecord.customClaims ?? {};
    if (currentClaims.enabled === enabled) {
      logger.info("Enabled claim already matches membership status", {
        userId,
        membershipStatus,
        enabled,
      });
      return { enabled, updated: false };
    }

    await authClient.setCustomUserClaims(userId, {
      ...currentClaims,
      enabled,
    });
    logger.info("Reconciled enabled claim with membership status", {
      userId,
      membershipStatus,
      enabled,
      admin: currentClaims.admin === true,
    });
    return { enabled, updated: true };
  } catch (error: unknown) {
    logger.error("Could not reconcile enabled claim with membership status", {
      userId,
      membershipStatus,
      enabled,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}
