import { useState } from "react";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import type { SearchUser } from "../../../types";
import { functions } from "../../../config/firebase";
import { httpsCallable } from "../../../shared/utils/sessionCallable";

interface Preview { eligible: boolean; blockers: string[]; needsOperator: boolean; communicationRecords?: number; sharedAnnouncements?: number }
export default function DeleteAccountDialog({user, onClose, onDeleted}: {user: SearchUser; onClose: () => void; onDeleted: () => void}) {
  const [operationId] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [email, setEmail] = useState("");
  const [noRetention, setNoRetention] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [deletionStarted, setDeletionStarted] = useState(false);
  async function submit(apply: boolean) {
    setBusy(true); setError("");
    if (apply) {setAttempted(true); setDeletionStarted(true); }
    try {
      const call = httpsCallable<{uid: string; email: string; operationId: string; apply: boolean; noRetention: boolean}, Preview & {deleted?: boolean}>(functions, "deleteAccount", {timeout: 540000});
      const result = (await call({uid: user.uid, email: user.email ?? "", operationId, apply, noRetention})).data;
      if (apply && result.deleted) onDeleted();
      else setPreview(result);
    } catch {
      if (apply) setAttempted(false);
      setError(apply
        ? "Deletion could not be confirmed. The account may remain disabled. Retry to finish, or ask an operator for help."
        : "Account checks could not be completed. Please try again or ask an operator for help.");
    } finally { setBusy(false); }
  }
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>Delete account</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{pt: 1}}>
      <Typography>Delete the account for <strong>{user.email}</strong>. This permanently removes sign-in access, saved messages and delivery history for this member. Other recipients’ entries are preserved.</Typography>
      <Alert severity="warning">This action cannot be undone. External records and backups require the separate erasure process. A minimal deletion record is retained to prevent delayed messages restoring personal data.</Alert>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      {preview && !preview.eligible && <Alert severity="warning">This account has linked records or security information that needs review. Use the operator erasure workflow.</Alert>}
      {busy && attempted && <Alert severity="info">Deletion can take several minutes while pending deliveries are stopped.</Alert>}
      {preview?.eligible && <>
        {(preview.communicationRecords ?? 0) > 0 && <Typography>Saved communication records will be removed, including this member’s entries in {preview.sharedAnnouncements ?? 0} shared announcements.</Typography>}
        <TextField label="Type the account email to confirm" value={email} onChange={event => setEmail(event.target.value)} disabled={busy || attempted} autoComplete="off" />
        <FormControlLabel control={<Checkbox checked={noRetention} onChange={event => setNoRetention(event.target.checked)} disabled={busy || attempted} />} label="I have verified the deletion request and confirmed that no records need retaining." />
      </>}
    </Stack></DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>{deletionStarted ? "Close" : "Cancel"}</Button>
      {!preview ? <Button onClick={() => void submit(false)} disabled={busy}>{busy ? "Checking…" : "Check account"}</Button>
        : preview.eligible && <Button color="error" variant="contained" onClick={() => void submit(true)} disabled={busy || attempted || !noRetention || email !== user.email}>{busy ? "Deleting…" : "Permanently delete account"}</Button>}
    </DialogActions>
  </Dialog>;
}
