import { useCallback, useState } from "react";

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: "success" | "error";
}

export interface UseSnackbarResult {
  snackbar: SnackbarState;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  close: () => void;
}

const initialState: SnackbarState = { open: false, message: "", severity: "success" };

/** Shared success/error snackbar state, extracted from the pattern SectionDetail.tsx and
 * ManageUsers.tsx already used independently. See #320. */
export function useSnackbar(): UseSnackbarResult {
  const [snackbar, setSnackbar] = useState<SnackbarState>(initialState);

  const showSuccess = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: "success" });
  }, []);

  const showError = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: "error" });
  }, []);

  const close = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return { snackbar, showSuccess, showError, close };
}
