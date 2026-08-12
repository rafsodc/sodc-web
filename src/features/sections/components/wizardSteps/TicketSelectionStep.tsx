import {
  Autocomplete,
  Box,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";

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
  memberDietaryNote: string;
  onMemberDietaryNoteChange: (value: string) => void;
  seatingOptions: SeatingOption[];
  seatingSearchInputValue: string;
  onSeatingSearchInputValueChange: (value: string) => void;
  seatingOptionsLoading: boolean;
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
  memberDietaryNote,
  onMemberDietaryNoteChange,
  seatingOptions,
  seatingSearchInputValue,
  onSeatingSearchInputValueChange,
  seatingOptionsLoading,
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
        label="Dietary requirements"
        placeholder="e.g. vegetarian, nut allergy, gluten free"
        fullWidth
        size="small"
        value={memberDietaryNote}
        onChange={(e) => onMemberDietaryNoteChange(e.target.value)}
        sx={{ mt: 2 }}
      />
      <Autocomplete
        multiple
        filterOptions={(x) => x}
        options={seatingOptions}
        value={seatingOptions.filter((o) => sitNextToUserIds.includes(o.id))}
        onChange={(_, next) => {
          onSitNextToUserIdsChange(next.map((n) => n.id));
          onSeatingSearchInputValueChange("");
        }}
        inputValue={seatingSearchInputValue}
        onInputChange={(_, next, reason) => {
          if (reason === "input") onSeatingSearchInputValueChange(next);
        }}
        loading={seatingOptionsLoading}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText={
          seatingSearchInputValue.trim() ? "No matching members" : "Type a name to search"
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Sit next to (optional)"
            helperText="We'll do our best to seat you together."
            size="small"
            sx={{ mt: 2 }}
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {seatingOptionsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
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
        label="Request accommodation"
        disabled={!canRequestAccommodation}
      />
      <Typography variant="caption" color="text.secondary">
        If you are a Serving Member, please indicate whether you would require accommodation.
        This does not guarantee accommodation, and you will be informed if accommodation is not
        available so that you can make your own arrangements.
      </Typography>
    </FormControl>
  );
}
