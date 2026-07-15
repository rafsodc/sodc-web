import { Alert, Snackbar } from "@mui/material";
import type { SnackbarState } from "../hooks/useSnackbar";

interface SnackbarAlertProps {
  snackbar: SnackbarState;
  onClose: () => void;
}

export default function SnackbarAlert({ snackbar, onClose }: SnackbarAlertProps) {
  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      sx={{ mt: 10 }}
    >
      <Alert onClose={onClose} severity={snackbar.severity} sx={{ width: "100%" }}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}
