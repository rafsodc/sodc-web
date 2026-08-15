import { Paper, Typography } from "@mui/material";
import SafeMarkdown from "../../../shared/components/SafeMarkdown";

export interface EventDetailsContentProps {
  details?: string | null;
}

export default function EventDetailsContent({ details }: EventDetailsContentProps) {
  const content = details?.trim();
  if (!content) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        Event details
      </Typography>
      <SafeMarkdown>{content}</SafeMarkdown>
    </Paper>
  );
}
