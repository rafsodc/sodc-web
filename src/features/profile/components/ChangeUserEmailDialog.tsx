import { useState } from "react";
import { Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { signOut } from "firebase/auth";
import { auth } from "../../../config/firebase";
import { MAX_EMAIL_LENGTH } from "../../../constants";
import { updateUserEmail, userEmailChangeError, type UpdateUserEmailResult } from "../../../shared/utils/firebaseFunctions";
import { reportError } from "../../../shared/errors";

interface Props {
  userId: string;
  currentEmail: string;
  onClose: () => void;
  onChanged: (email: string) => Promise<void>;
}

export default function ChangeUserEmailDialog({ userId, currentEmail, onClose, onChanged }: Props) {
  const [email, setEmail] = useState(currentEmail);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpdateUserEmailResult | null>(null);
  const changingOwnEmail = auth.currentUser?.uid === userId;

  async function handleChange() {
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await updateUserEmail(userId, email.trim().toLowerCase(), currentEmail);
      setResult(response);
      try {
        await onChanged(response.email);
      } catch (refreshError) {
        reportError("profile.admin-email.refresh", refreshError);
        setError("The email was updated, but the user list could not refresh. Reload the page to see the change.");
      }
    } catch (caught) {
      reportError("profile.admin-email.change", caught);
      setError(userEmailChangeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (busy) return;
    if (result && changingOwnEmail && result.verificationRequired) {
      setBusy(true);
      try {
        await signOut(auth);
      } catch (caught) {
        reportError("profile.admin-email.sign-out", caught);
        setError("Your email has changed. Please sign out and sign in with the new address.");
        setBusy(false);
        return;
      }
    }
    onClose();
  }

  return (
    <Dialog open onClose={() => void handleClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Change user email</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {result ? (
            <>
              <Alert severity="success">The profile and sign-in email are now {result.email}.</Alert>
              {result.verificationRequired && (
                <Alert severity={result.verificationEmailSent ? "info" : "warning"}>
                  {result.verificationEmailSent
                    ? "A verification email has been sent to the new address. The user should follow that link and sign in with the new address and their existing password."
                    : "The verification email could not be sent. The user should sign in with the new address and their existing password, then request a verification email from the verification screen."}
                </Alert>
              )}
              {changingOwnEmail && result.verificationRequired && <Typography>You will be signed out when you select Done.</Typography>}
            </>
          ) : (
            <>
              <Typography>Current sign-in email: {currentEmail}</Typography>
              <TextField
                autoFocus label="New email address" type="email" value={email} required fullWidth disabled={busy}
                inputProps={{ maxLength: MAX_EMAIL_LENGTH }}
                onChange={(event) => { setEmail(event.target.value); setConfirmed(false); }}
              />
              <Alert severity="warning">
                This updates both the profile and sign-in email. A different address must be verified, and existing sign-in sessions will need to sign in again. The user's password, membership and bookings are kept.
              </Alert>
              <FormControlLabel
                control={<Checkbox checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />}
                label="I confirm this is the correct email address for this user."
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => void handleClose()}>{result ? "Done" : "Cancel"}</Button>
        {!result && <Button variant="contained" disabled={busy || !confirmed || !email.trim()} onClick={() => void handleChange()}>
          {busy ? <CircularProgress size={20} /> : "Change email"}
        </Button>}
      </DialogActions>
    </Dialog>
  );
}
