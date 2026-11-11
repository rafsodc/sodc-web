import { useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { EmailAuthProvider, reauthenticateWithCredential, type User } from "firebase/auth";
import { functions } from "../../../config/firebase";
import { httpsCallable } from "../../../shared/utils/sessionCallable";
import { beginAuthorizationUpdate } from "../../../shared/auth/authorizationUpdate";
import { cancelPrivateReads, captureSession, isSessionCurrent, runSessionOperation, signOutPrivateSession } from "../../../shared/appShell/sessionLifecycle";

interface DeletionResult { eligible?: boolean; deleted?: boolean }
interface DeletionRequest { email: string; operationId: string; apply: boolean; confirmMembershipEnd: boolean }

function deletionErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("details" in error)) return undefined;
  const details = error.details;
  return details && typeof details === "object" && "code" in details && typeof details.code === "string" ? details.code : undefined;
}

function DeleteMyAccountDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [session] = useState(() => captureSession(user.uid));
  const mounted = useRef(false);
  const pending = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const ownsView = () => mounted.current && isSessionCurrent(session);
  const [operationId] = useState(() => crypto.randomUUID());
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mustSignOut, setMustSignOut] = useState(false);
  const [error, setError] = useState("");
  const usesPassword = user.providerData.some(provider => provider.providerId === "password");

  async function submit(apply: boolean) {
    if (pending.current) return;
    if (!ownsView()) { setError("Your account session has changed. Sign in again to continue."); return; }
    if (apply && (eligible !== true || !confirmed || email.trim().toLowerCase() !== user.email?.toLowerCase() || (usesPassword && !password))) return;
    pending.current = true;
    setBusy(true); setError("");
    let update: ReturnType<typeof beginAuthorizationUpdate> | undefined;
    let deletionSubmitted = false;
    let deletionConfirmed = false;
    try {
      if (apply) {
        if (usesPassword) {
          const credential = EmailAuthProvider.credential(user.email!, password);
          await runSessionOperation(() => reauthenticateWithCredential(user, credential), session);
        }
        await runSessionOperation(() => user.getIdToken(true), session);
        if (!ownsView()) return;
        setPassword("");
        update = beginAuthorizationUpdate(session);
        await cancelPrivateReads(session);
        if (!ownsView()) { update.finish(true); return; }
        setApplying(true);
      }
      const call = httpsCallable<DeletionRequest, DeletionResult>(functions, "deleteMyAccount", { timeout: 540000 });
      deletionSubmitted = apply;
      const result = (await runSessionOperation(() => call({ email: user.email ?? "", operationId, apply, confirmMembershipEnd: apply && confirmed }), session)).data;
      if (!isSessionCurrent(session)) { update?.finish(true, apply); return; }
      if (apply) {
        if (!result.deleted) throw new Error("Deletion was not confirmed");
        deletionConfirmed = true;
        update?.finish(true, true);
        if (mounted.current) setMustSignOut(true);
        await signOutPrivateSession();
      } else if (mounted.current) {
        setEligible(result.eligible === true);
      }
    } catch (caught) {
      const recentLoginRequired = deletionErrorCode(caught) === "RECENT_LOGIN_REQUIRED";
      update?.finish(true, deletionSubmitted && !recentLoginRequired);
      if (!isSessionCurrent(session)) return;
      if (!mounted.current) {
        if (deletionSubmitted && !recentLoginRequired) {
          try { await signOutPrivateSession(); }
          catch { /* The session boundary owns sign-out recovery after navigation. */ }
        }
        return;
      }
      if (recentLoginRequired) {
        setError("Please sign out and sign in again, then return here to confirm account deletion.");
      } else if (deletionConfirmed) {
        setMustSignOut(true);
        setError("Your account was deleted, but we couldn’t sign you out. Please try signing out again.");
      } else if (deletionSubmitted) {
        setMustSignOut(true);
        setError("Deletion could not be confirmed. Your account may be disabled. Sign out and contact an administrator to check and finish deletion.");
      } else {
        setError(apply ? "We couldn’t verify your sign-in. Check your password or sign in again before continuing." : "We couldn’t check your account. Please try again or contact an administrator.");
      }
    } finally {
      pending.current = false;
      if (ownsView()) { setBusy(false); setApplying(false); }
    }
  }

  async function signOut() {
    if (!ownsView() || pending.current) return;
    pending.current = true; setBusy(true);
    try { await signOutPrivateSession(); }
    catch { if (ownsView()) setError("We couldn’t sign you out. Please try signing out again."); }
    finally { pending.current = false; if (ownsView()) setBusy(false); }
  }

  return <Dialog open onClose={busy || mustSignOut ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="delete-my-account-title">
    <DialogTitle id="delete-my-account-title">Delete your account?</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Alert severity="warning">Deleting your account will end your SODC membership and permanently remove your sign-in access. This action cannot be undone.</Alert>
      <Typography>Your profile and eligible personal records will be removed. Some records, including backups and records we must retain, may be kept for the required period. We keep a minimal deletion record temporarily to prevent delayed messages restoring your data.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {eligible === false && <Alert severity="info">Your account needs administrator review before it can be deleted. Please contact an administrator to request deletion. Your membership has not been changed.</Alert>}
      {applying && <Typography role="status">Deleting your account can take several minutes while pending messages are stopped. Keep this page open. You will be signed out when it finishes.</Typography>}
      {eligible && !mustSignOut && <>
        <TextField label="Type your account email to confirm" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} autoComplete="off" fullWidth />
        {usesPassword ? <TextField label="Current password for account deletion" type="password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} autoComplete="current-password" fullWidth />
          : <Typography>For your security, you must have signed in within the last five minutes. If asked, sign out and sign in again before returning here.</Typography>}
        <FormControlLabel control={<Checkbox checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />} label="I understand that deleting my account will end my membership and cannot be undone." />
      </>}
    </Stack></DialogContent>
    <DialogActions>
      {mustSignOut ? <Button onClick={() => void signOut()} disabled={busy}>Sign out</Button> : <>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {eligible === null ? <Button onClick={() => void submit(false)} disabled={busy}>{busy ? "Checking…" : "Check account"}</Button>
          : eligible && <Button color="error" variant="contained" onClick={() => void submit(true)} disabled={busy || !confirmed || email.trim().toLowerCase() !== user.email?.toLowerCase() || (usesPassword && !password)}>{busy ? "Deleting…" : "Permanently delete my account"}</Button>}
      </>}
    </DialogActions>
  </Dialog>;
}

export default function DeleteMyAccountSection({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return <Box component="section" aria-labelledby="delete-account-heading">
    <Typography id="delete-account-heading" variant="h6" component="h2" sx={{ mb: 1 }}>Delete account</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Deleting your account ends your SODC membership and permanently removes your sign-in access.</Typography>
    {isAdmin ? <Alert severity="info">Administrator accounts need a separate review. Contact another administrator before requesting account deletion.</Alert>
      : !user.email ? <Alert severity="info">Contact an administrator to request deletion of this account.</Alert>
      : <Button variant="outlined" color="error" onClick={() => setOpen(true)}>Delete my account</Button>}
    {open && !isAdmin && <DeleteMyAccountDialog key={user.uid} user={user} onClose={() => setOpen(false)} />}
  </Box>;
}
