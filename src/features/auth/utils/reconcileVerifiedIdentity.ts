import { reload, type User } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { assertSessionCurrent, runSessionOperation, SessionChangedError, type SessionToken } from "../../../shared/appShell/sessionLifecycle";
import { reconcileMyEmail } from "../../../shared/utils/firebaseFunctions";
import { withTimeout } from "../../../shared/utils/withTimeout";

export const VERIFIED_IDENTITY_TIMEOUT_MS = 15_000;
export function assertVerifiedIdentityOwner(user: User, session: SessionToken, current = () => true) {
  assertSessionCurrent(session);
  if (!current() || session.uid !== user.uid || auth.currentUser?.uid !== user.uid) throw new SessionChangedError();
}
export async function reloadOwnIdentity(user: User, session: SessionToken, current = () => true) {
  assertVerifiedIdentityOwner(user, session, current);
  await withTimeout(runSessionOperation(() => reload(user), session), VERIFIED_IDENTITY_TIMEOUT_MS, "Checking email verification timed out");
  assertVerifiedIdentityOwner(user, session, current);
}
/** Release only the backend-verified exact email hold, then fetch its new claims.
 * A successful no-profile/no-authority response supports onboarding; this client
 * never initializes authority or grants membership. No mutation is auto-retried.
 */
export async function reconcileVerifiedIdentity(user: User, session: SessionToken, current = () => true) {
  assertVerifiedIdentityOwner(user, session, current);
  if (!user.emailVerified || !auth.currentUser?.emailVerified) throw new Error("The signed-in email is not verified");
  // reload() refreshes identity metadata without forcing the JWT. Obtain the
  // hold's current actor version before asking its service-only release path.
  await withTimeout(runSessionOperation(() => user.getIdToken(true), session), VERIFIED_IDENTITY_TIMEOUT_MS, "Refreshing email verification timed out");
  assertVerifiedIdentityOwner(user, session, current);
  await withTimeout(runSessionOperation(() => reconcileMyEmail(), session), VERIFIED_IDENTITY_TIMEOUT_MS, "Updating verified account access timed out");
  assertVerifiedIdentityOwner(user, session, current);
  await withTimeout(runSessionOperation(() => user.getIdToken(true), session), VERIFIED_IDENTITY_TIMEOUT_MS, "Refreshing verified account access timed out");
  assertVerifiedIdentityOwner(user, session, current);
}
