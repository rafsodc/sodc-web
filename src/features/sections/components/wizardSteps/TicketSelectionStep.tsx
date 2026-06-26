import {
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";
import { getMembershipStatusLabel } from "../../../../shared/utils/membershipStatusLabels";

interface TicketType {
  id: string;
  title: string;
  price: number;
}

interface SeatingOption {
  id: string;
  label: string;
}

interface TicketSelectionStepProps {
  memberTicketTypes: TicketType[];
  memberTicketTypeId: string | null;
  onMemberTicketTypeChange: (id: string | null) => void;
  bookerDietaryNote: string;
  onBookerDietaryNoteChange: (value: string) => void;
  seatingOptions: SeatingOption[];
  sitNextToUserIds: string[];
  onSitNextToUserIdsChange: (ids: string[]) => void;
  accommodationRequested: boolean;
  onAccommodationRequestedChange: (value: boolean) => void;
  canRequestAccommodation: boolean;
}

export default function TicketSelectionStep({
  memberTicketTypes,
  memberTicketTypeId,
  onMemberTicketTypeChange,
  bookerDietaryNote,
  onBookerDietaryNoteChange,
  seatingOptions,
  sitNextToUserIds,
  onSitNextToUserIdsChange,
  accommodationRequested,
  onAccommodationRequestedChange,
  canRequestAccommodation,
}: TicketSelectionStepProps) {
  return (
    <FormControl component="fieldset" fullWidth>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Select your member ticket category.
      </Typography>
      <RadioGroup
        value={memberTicketTypeId ?? ""}
        onChange={(_, v) => onMemberTicketTypeChange(v || null)}
      >
        {memberTicketTypes.map((tt) => (
          <FormControlLabel
            key={tt.id}
            value={tt.id}
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body2" component="span">
                  {tt.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {formatGbpMajorAmount(tt.price)}
                </Typography>
              </Box>
            }
          />
        ))}
      </RadioGroup>
      <TextField
        label="Dietary requirements (you)"
        fullWidth
        size="small"
        value={bookerDietaryNote}
        onChange={(e) => onBookerDietaryNoteChange(e.target.value)}
        sx={{ mt: 2 }}
      />
      <Autocomplete
        multiple
        options={seatingOptions}
        value={seatingOptions.filter((o) => sitNextToUserIds.includes(o.id))}
        onChange={(_, next) => onSitNextToUserIdsChange(next.map((n) => n.id))}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Sit next to (optional)"
            helperText="Choose members you would like to sit near."
            size="small"
            sx={{ mt: 2 }}
          />
        )}
      />
      <FormControlLabel
        sx={{ mt: 1 }}
        control={
          <Checkbox
            checked={accommodationRequested}
            onChange={(_, checked) => onAccommodationRequestedChange(checked)}
          />
        }
        label="Request accommodation (booker only)"
        disabled={!canRequestAccommodation}
      />
      {!canRequestAccommodation ? (
        <Typography variant="caption" color="text.secondary">
          Accommodation requests are only available for{" "}
          {getMembershipStatusLabel("REGULAR")} or {getMembershipStatusLabel("RESERVE")} members.
        </Typography>
      ) : null}
    </FormControl>
  );
}
