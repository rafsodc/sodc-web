import { useId, type ReactNode } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  open,
  title,
  children,
  confirmLabel = "Delete",
  pending = false,
  pendingLabel = "Deleting…",
  error,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <Dialog
      open={open}
      onClose={() => { if (!pending) onCancel(); }}
      disableEscapeKeyDown={pending}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent id={descriptionId}>
        {children}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button autoFocus color="inherit" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={pending} onClick={onConfirm}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
