import { Suspense, type ReactNode } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { ErrorBoundary } from "./ErrorBoundary";

/** Keep loading and module failures local to a panel, preserving its siblings. */
export default function DeferredPanel({ children, loadingLabel, errorTitle, resetKey, onBack }: {
  children: ReactNode;
  loadingLabel: string;
  errorTitle: string;
  resetKey: string;
  onBack?: () => void;
}) {
  return (
    <ErrorBoundary key={resetKey} title={errorTitle} resetKey={resetKey} onBack={onBack}>
      <Suspense fallback={
        <Box role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 3 }}>
          <CircularProgress size={24} aria-label={loadingLabel} />
          <Typography>{loadingLabel}…</Typography>
        </Box>
      }>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
