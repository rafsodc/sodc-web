import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { listUsers as dcListUsers, type MembershipStatus } from "@dataconnect/admin-generated";
import { requireAuth, requireAdmin, requireString, validateStringLength, MAX_NAME_LENGTH, mapUserRecord, handleFunctionError, listAllAuthUsers } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { FUNCTIONS_REGION } from "./constants";
import { isUserAwaitingProfile, isUserPendingApproval } from "./pendingUserApproval";

const DC_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let dcProfileCache: { map: Map<string, MembershipStatus>; expiresAt: number } | null = null;

/**
 * Drops the cached membershipStatus map so the next searchUsers call re-fetches from Data
 * Connect. Call this after any write that changes User.membershipStatus (see #321) — otherwise
 * searchUsers can keep serving a stale status for up to DC_PROFILE_CACHE_TTL_MS regardless of
 * which admin screen or code path made the change.
 */
export function invalidateDcProfileCache(): void { dcProfileCache = null; }

async function getDcProfileMap(): Promise<Map<string, MembershipStatus>> {
  const now = Date.now();
  if (dcProfileCache && dcProfileCache.expiresAt > now) {
    return dcProfileCache.map;
  }
  const result = await dcListUsers();
  const map = new Map(
    (result.data?.users ?? []).map((u) => [u.id, u.membershipStatus])
  );
  dcProfileCache = { map, expiresAt: now + DC_PROFILE_CACHE_TTL_MS };
  return map;
}

/**
 * Updates the display name of the authenticated user
 */
export const updateDisplayName = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAuth(request);
  await enforceRateLimit("updateDisplayName", request.auth!.uid, { limit: 5, windowMs: 60 * 60 * 1000 });
  const displayName = validateStringLength(
    requireString(request.data.displayName, "displayName"),
    "Display name",
    MAX_NAME_LENGTH * 2 // Display name can be "FirstName LastName"
  );

  try {
    await admin.auth().updateUser(request.auth!.uid, { displayName });
    logger.info(`Display name updated for uid=${request.auth!.uid}`);
    return { success: true };
  } catch (e: any) {
    handleFunctionError(e, "updating display name");
  }
  }
);

/**
 * Updates the display name of any user (admin only)
 */
export const updateUserDisplayName = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAdmin(request);
  const userId = requireString(request.data.userId, "userId");
  const displayName = validateStringLength(
    requireString(request.data.displayName, "displayName"),
    "Display name",
    MAX_NAME_LENGTH * 2 // Display name can be "FirstName LastName"
  );

  try {
    await admin.auth().updateUser(userId, { displayName });
    logger.info(`Display name updated for uid=${userId} by admin ${request.auth!.uid}`);
    return { success: true };
  } catch (e: any) {
    handleFunctionError(e, "updating user display name");
  }
  }
);

/**
 * Searches for users by email or display name with pagination (admin only)
 */
export const searchUsers = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
  requireAdmin(request);
  await enforceRateLimit("searchUsers", request.auth!.uid, { limit: 60, windowMs: 5 * 60 * 1000 });
  const searchTerm = requireString(request.data.searchTerm, "searchTerm");
  const page = request.data.page || 1;
  const pageSize = request.data.pageSize || 25;

  try {
    const searchLower = searchTerm.toLowerCase();
    const [allUsers, dcProfileById] = await Promise.all([
      listAllAuthUsers(),
      getDcProfileMap(),
    ]);

    const matchingUsers = allUsers
      .map((userRecord) => {
        const email = (userRecord.email || "").toLowerCase();
        const displayName = (userRecord.displayName || "").toLowerCase();

        if (email.includes(searchLower) || displayName.includes(searchLower)) {
          return {
            ...mapUserRecord(userRecord),
            membershipStatus: dcProfileById.get(userRecord.uid) ?? null,
          };
        }
        return null;
      })
      .filter((user) => user !== null);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = matchingUsers.slice(startIndex, endIndex);
    const totalPages = Math.ceil(matchingUsers.length / pageSize);

    logger.info(`Found ${matchingUsers.length} users matching "${searchTerm}" for caller ${request.auth!.uid}`);
    return {
      users: paginatedUsers,
      total: matchingUsers.length,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages,
    };
  } catch (e: any) {
    handleFunctionError(e, "searching users");
  }
  }
);

function formatClaimValue(value: unknown): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "(unset)";
}

/**
 * Auth users who are not enabled (claim) and have no Data Connect profile yet.
 */
export const listUsersWithoutDataConnectProfile = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    requireAdmin(request);

    try {
      const [dcResult, authResult] = await Promise.all([
        dcListUsers(),
        listAllAuthUsers(),
      ]);

      const dcById = new Map(
        (dcResult.data?.users ?? []).map((user) => [user.id, user])
      );

      const users = authResult
        .map((authUser) => {
          const hasDataConnectProfile = dcById.has(authUser.uid);
          const authEnabled = authUser.customClaims?.enabled === true;
          if (
            !isUserAwaitingProfile({
              authEnabled,
              hasDataConnectProfile,
            })
          ) {
            return null;
          }

          return {
            id: authUser.uid,
            email: authUser.email ?? "",
            displayName: authUser.displayName ?? "",
            emailVerified: authUser.emailVerified,
            authDisabled: authUser.disabled,
            claimEnabled: formatClaimValue(authUser.customClaims?.enabled),
            claimAdmin: formatClaimValue(authUser.customClaims?.admin),
            createdAt: authUser.metadata.creationTime,
            lastSignInTime: authUser.metadata.lastSignInTime ?? null,
          };
        })
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .sort((a, b) => a.email.localeCompare(b.email));

      logger.info(
        `listUsersWithoutDataConnectProfile: ${users.length} user(s) for caller ${request.auth!.uid}`
      );
      return { users };
    } catch (e: unknown) {
      handleFunctionError(e, "listing users without Data Connect profile");
    }
  }
);

/**
 * Lists users with verified email and membershipStatus PENDING (awaiting admin approval).
 */
export const listUsersPendingApproval = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    requireAdmin(request);

    try {
      const [dcResult, authResult] = await Promise.all([
        dcListUsers(),
        listAllAuthUsers(),
      ]);

      const dcById = new Map(
        (dcResult.data?.users ?? []).map((user) => [user.id, user])
      );

      const users = authResult
        .map((authUser) => {
          const profile = dcById.get(authUser.uid);
          if (!profile) {
            return null;
          }

          const authEnabled = authUser.customClaims?.enabled === true;
          if (
            !isUserPendingApproval({
              emailVerified: authUser.emailVerified,
              authEnabled,
              membershipStatus: profile.membershipStatus,
            })
          ) {
            return null;
          }

          return {
            id: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            serviceNumber: profile.serviceNumber,
            membershipStatus: profile.membershipStatus,
            requestedMembershipStatus: profile.requestedMembershipStatus ?? null,
            isRegular: profile.isRegular ?? null,
            isReserve: profile.isReserve ?? null,
            isCivilServant: profile.isCivilServant ?? null,
            isIndustry: profile.isIndustry ?? null,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          };
        })
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      logger.info(
        `listUsersPendingApproval: ${users.length} user(s) for caller ${request.auth!.uid}`
      );
      return { users };
    } catch (e: unknown) {
      handleFunctionError(e, "listing users pending approval");
    }
  }
);

/**
 * Sets enabled: false for new members (callable any time after sign-in).
 * Invoked at registration and again after profile submit so the claim is never left unset.
 */
export const syncPendingUserClaims = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    requireAuth(request);

    try {
      const uid = request.auth!.uid;
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};

      if (currentClaims.admin === true) {
        return { success: true };
      }

      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        enabled: false,
      });
      logger.info(`syncPendingUserClaims: enabled=false for uid=${uid}`);
      return { success: true };
    } catch (e: unknown) {
      handleFunctionError(e, "syncing pending user claims");
    }
  }
);

