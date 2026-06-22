import { Box, TextField, Typography } from "@mui/material";
import { formatEventGuestPolicy } from "../../utils/eventGuestPolicy";

interface AdditionalGuestCountStepProps {
  requestedExtraGuestCountInput: string;
  onInputChange: (raw: string) => void;
  onCountChange: (n: number) => void;
  maxGuestsWithoutModeratorApproval?: number | null;
}

function parseOptionalPositiveInt(raw: string): number | null {
  if (raw === "") return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : null;
}

export default function AdditionalGuestCountStep({
  requestedExtraGuestCountInput,
  onInputChange,
  onCountChange,
  maxGuestsWithoutModeratorApproval,
}: AdditionalGuestCountStepProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {formatEventGuestPolicy(maxGuestsWithoutModeratorApproval)}
      </Typography>
      <TextField
        label="How many extra guest tickets?"
        type="number"
        size="small"
        inputProps={{ min: 1, step: 1 }}
        value={requestedExtraGuestCountInput}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^\d*$/.test(raw)) return;
          onInputChange(raw);
          const parsed = parseOptionalPositiveInt(raw);
          if (parsed !== null) onCountChange(parsed);
        }}
        onBlur={() => {
          const parsed = parseOptionalPositiveInt(requestedExtraGuestCountInput);
          if (parsed === null) {
            onInputChange("1");
            onCountChange(1);
          }
        }}
        helperText="Moderator review may be required depending on event policy."
        sx={{ minWidth: 260 }}
      />
    </Box>
  );
}
