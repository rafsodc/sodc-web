import { useEffect, useRef } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export interface FailureStateProps {
  title?: string;
  message?: string;
  variant?: "inline" | "page";
  onRetry?: () => void;
  onReload?: () => void;
  onBack?: () => void;
  onHome?: () => void;
}

const DEFAULT_TITLE = "Something went wrong";
const DEFAULT_MESSAGE =
  "We couldn’t display this page. Try again, or use one of the navigation options below.";

/** Safe, reusable presentation for unexpected or retryable failures. */
export default function FailureState({
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  variant = "inline",
  onRetry,
  onReload,
  onBack,
  onHome,
}: FailureStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const content = (
    <Stack spacing={2} alignItems="flex-start">
      <Box>
        <Typography
          ref={headingRef}
          component={variant === "page" ? "h1" : "h2"}
          variant="h5"
          gutterBottom
          tabIndex={-1}
        >
          {title}
        </Typography>
        <Typography variant="body1">{message}</Typography>
      </Box>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {onRetry ? (
          <Button variant="contained" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {onReload ? (
          <Button variant="outlined" onClick={onReload}>
            Reload page
          </Button>
        ) : null}
        {onBack ? (
          <Button variant="text" onClick={onBack}>
            Back
          </Button>
        ) : null}
        {onHome ? (
          <Button variant="text" onClick={onHome}>
            Home
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );

  if (variant === "page") {
    return (
      <Box
        component="main"
        aria-live="assertive"
        sx={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          px: 2,
          py: 6,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 640 }}>{content}</Box>
      </Box>
    );
  }

  return (
    <Alert severity="error" role="alert" sx={{ width: "100%", alignItems: "flex-start" }}>
      {content}
    </Alert>
  );
}
