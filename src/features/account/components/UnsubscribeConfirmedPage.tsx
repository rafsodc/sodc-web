import { Box, Button, Typography } from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants";

export default function UnsubscribeConfirmedPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const section = params.get("section") ?? "this section";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        px: 3,
        gap: 2,
      }}
    >
      <CheckCircleOutline sx={{ fontSize: 56, color: "success.main" }} />
      <Typography variant="h5" component="h1">
        Unsubscribed from {section}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
        You will no longer receive announcement emails for this section. You can
        re-subscribe at any time from your account settings.
      </Typography>
      <Button variant="outlined" onClick={() => navigate(ROUTES.ACCOUNT_SETTINGS)}>
        Account settings
      </Button>
    </Box>
  );
}
