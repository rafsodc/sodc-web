import { auth } from "../../config/firebase";
import { beginAuthorizationUpdate, privateReadsBlocked } from "../auth/authorizationUpdate";
import { getMyAuthorizationStatus } from "../auth/authorizationStatus";
import { reportAuthorizationDenial } from "../auth/authorizationRecoveryEvents";
import { assertSessionCurrent, cancelPrivateReads, captureSession, isSessionCurrent, refreshPrivateReadViews, SessionChangedError } from "../appShell/sessionLifecycle";
import { withTimeout } from "./withTimeout";

export class OwnStatusRefreshError extends Error {
  readonly details = { code: "MEMBERSHIP_STATUS_SAVED_REFRESH_FAILED" };
  constructor() { super("Your membership status was saved, but your session could not be refreshed. Some other changes may still need saving. Retry to finish, or reload this page."); }
}

/** Finish a committed own-status change before callers perform another protected
 * operation. The write is invoked once; neither refresh nor recovery replays it. */
export async function withOwnMembershipStatusUpdate<T>(userId: string, write: () => Promise<T>, succeeded: (result: T) => boolean): Promise<T> {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) return write();
  const session = captureSession(user.uid);
  const current = () => {
    assertSessionCurrent(session);
    if (auth.currentUser?.uid !== user.uid) throw new SessionChangedError();
  };
  current();
  const resumingPartialChange = privateReadsBlocked(session);
  let initialClaims;
  try { initialClaims = await withTimeout(user.getIdTokenResult(), 30_000, "Checking the current account timed out"); }
  catch (error) { current(); if (resumingPartialChange) throw new OwnStatusRefreshError(); throw error; }
  current();
  const wasAdmin = initialClaims.claims.admin === true;
  const update = beginAuthorizationUpdate(session);
  let committed = resumingPartialChange;
  let verified = false;
  const refreshAuthority = async () => {
    await withTimeout(user.getIdToken(true), 30_000, "Refreshing the updated account timed out");
    current();
    const status = await withTimeout(getMyAuthorizationStatus(), 30_000, "Checking the updated account timed out");
    current();
    if (status.status !== "enabled" || status.verificationRequired || !status.tokenVersionCurrent || status.isAdmin !== wasAdmin) {
      const error = new Error(status.status === "enabled" && status.isAdmin === wasAdmin ? "SESSION_VERSION_STALE" : "ACCESS_REVOKED");
      reportAuthorizationDenial(error, session);
      throw error;
    }
  };
  try {
    await cancelPrivateReads(session);
    current();
    // A previous status write may already have advanced authority. The user's
    // explicit retry must refresh BEFORE submitting any new protected request.
    // Do not cache/reuse a receipt that could hide a later administrator change.
    if (resumingPartialChange) await refreshAuthority();
    current();
    committed = false;
    const result = await withTimeout(write(), 30_000, "Updating membership status timed out");
    current();
    if (!succeeded(result)) return result;
    committed = true;
    await refreshAuthority();
    await cancelPrivateReads(session);
    current();
    verified = true;
    return result;
  } catch (error) {
    current();
    if (committed) throw new OwnStatusRefreshError();
    throw error;
  } finally {
    // A failed refresh leaves reads fenced until explicit retry or recovery.
    // Any actual denial observed during the window is delivered, never dropped.
    update.finish(verified, committed && !verified);
    if (verified && isSessionCurrent(session) && auth.currentUser?.uid === user.uid) {
      // Resume cancelled active observers only after the fresh token is accepted.
      // TanStack mutations are deliberately untouched.
      void refreshPrivateReadViews(session).catch(() => undefined);
    }
  }
}
