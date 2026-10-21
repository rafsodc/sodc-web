import * as admin from "firebase-admin";
import { getUserMembershipStatus } from "@dataconnect/admin-generated";
import { getUserSecurityState, type GetUserSecurityStateData } from "./securityRepository";
import { resolveSectionAccess } from "./sectionAccess";
import { isNonRestrictedStatus, type MembershipStatus } from "./validation";

export type PrivilegedNotificationScope = { kind: "ADMIN" } | { kind: "BOOKING"; sectionId: string };
export type RecipientIneligibleReason =
  | "RECIPIENT_NOT_FOUND" | "RECIPIENT_DISABLED" | "RECIPIENT_UNVERIFIED"
  | "RECIPIENT_NOT_ENABLED" | "RECIPIENT_PROFILE_MISSING" | "RECIPIENT_RESTRICTED"
  | "RECIPIENT_AUTHORITY_REVOKED";
export type PrivilegedRecipientEligibility =
  | { eligible: true; recipientUserId: string; email: string }
  | { eligible: false; reason: RecipientIneligibleReason };

export interface CurrentRecipientState {
  security: GetUserSecurityStateData["userSecurityState"] | null;
  auth: {
    uid: string;
    disabled: boolean;
    emailVerified: boolean;
    email?: string;
    customClaims?: Record<string, unknown>;
  } | null;
  profile: { email?: string | null; membershipStatus: string } | null;
}

export class PrivilegedRecipientLookupError extends Error {
  readonly code: string;
  constructor(code = "RECIPIENT_AUTHORIZATION_LOOKUP_FAILED") {
    super(code);
    this.name = "PrivilegedRecipientLookupError";
    this.code = code;
  }
}

/** Fresh server-owned authority is required independently of the Auth claim mirror. */
export async function readCurrentRecipientState(recipientUserId: string): Promise<CurrentRecipientState> {
  const [authResult, securityResult, profileResult] = await Promise.all([
    admin.auth().getUser(recipientUserId).catch((error: unknown) => {
      if ((error as { code?: string })?.code === "auth/user-not-found") return null;
      throw new PrivilegedRecipientLookupError();
    }),
    getUserSecurityState({userId: recipientUserId}).catch(() => {throw new PrivilegedRecipientLookupError();}),
    getUserMembershipStatus({ id: recipientUserId }).catch(() => {
      throw new PrivilegedRecipientLookupError();
    }),
  ]);
  return { auth: authResult, profile: profileResult.data.user ?? null, security: securityResult.data.userSecurityState ?? null };
}

export interface PrivilegedRecipientDependencies {
  readCurrentState?: typeof readCurrentRecipientState;
  canModerate?: (sectionId: string, recipientUserId: string) => Promise<boolean>;
}

/** No recipient state is cached: selection and claimed sends must both call this. */
export async function authorizePrivilegedNotificationRecipient(
  recipientUserId: string,
  scope: PrivilegedNotificationScope,
  dependencies: PrivilegedRecipientDependencies = {},
): Promise<PrivilegedRecipientEligibility> {
  let state: CurrentRecipientState;
  try {
    state = await (dependencies.readCurrentState ?? readCurrentRecipientState)(recipientUserId);
  } catch (error) {
    if (error instanceof PrivilegedRecipientLookupError) throw error;
    throw new PrivilegedRecipientLookupError();
  }
  const { auth, profile, security } = state;
  if (!auth || auth.uid !== recipientUserId) return { eligible: false, reason: "RECIPIENT_NOT_FOUND" };
  if (auth.disabled) return { eligible: false, reason: "RECIPIENT_DISABLED" };
  if (!auth.emailVerified || !auth.email?.trim()) return { eligible: false, reason: "RECIPIENT_UNVERIFIED" };
  if (auth.customClaims?.enabled !== true) return { eligible: false, reason: "RECIPIENT_NOT_ENABLED" };
  if (!profile) return { eligible: false, reason: "RECIPIENT_PROFILE_MISSING" };
  if (!isNonRestrictedStatus(profile.membershipStatus as MembershipStatus)) {
    return { eligible: false, reason: "RECIPIENT_RESTRICTED" };
  }
  if (!security || security.syncStatus !== "READY" || !security.accessReady ||
      security.verificationEmail || security.membershipStatus !== profile.membershipStatus ||
      security.user.membershipStatus !== profile.membershipStatus ||
      auth.customClaims?.securityVersion !== security.securityVersion) {
    return {eligible: false, reason: "RECIPIENT_AUTHORITY_REVOKED"};
  }
  if (profile.email?.trim().toLowerCase() !== auth.email.trim().toLowerCase()) {
    throw new PrivilegedRecipientLookupError("RECIPIENT_EMAIL_OUT_OF_SYNC");
  }
  let authorized = security.adminReady && auth.customClaims?.admin === true;
  if (!authorized && scope.kind === "BOOKING") {
    try {
      authorized = await (dependencies.canModerate ?? (async (sectionId, uid) =>
        (await resolveSectionAccess(sectionId, uid)).canModerate))(scope.sectionId, recipientUserId);
    } catch (error) {
      if ((error as { code?: string })?.code === "not-found") authorized = false;
      else throw new PrivilegedRecipientLookupError();
    }
  }
  return authorized
    ? { eligible: true, recipientUserId, email: auth.email.trim().toLowerCase() }
    : { eligible: false, reason: "RECIPIENT_AUTHORITY_REVOKED" };
}

/** Definitive denials are removed from discovery; outages retain a UID for a retryable ledger attempt. */
export async function selectPrivilegedNotificationRecipientIds(
  candidates: Iterable<string>,
  scope: PrivilegedNotificationScope,
  authorize: typeof authorizePrivilegedNotificationRecipient = authorizePrivilegedNotificationRecipient,
): Promise<string[]> {
  const recipients: string[] = [];
  for (const uid of new Set(candidates)) {
    try {
      if ((await authorize(uid, scope)).eligible) recipients.push(uid);
    } catch (error) {
      if (!(error instanceof PrivilegedRecipientLookupError)) throw error;
      recipients.push(uid);
    }
  }
  return recipients;
}
