import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import type { SectionMemberSeatingOption } from "../hooks/useSectionMemberSeatingOptions";

export default function SeatingPreferencePicker({
  seatingOptions, seatingSearchInputValue, onSeatingSearchInputValueChange,
  seatingOptionsLoading, sitNextToUserIds, onSitNextToUserIdsChange, disabled = false,
}: {
  seatingOptions: SectionMemberSeatingOption[];
  seatingSearchInputValue: string;
  onSeatingSearchInputValueChange: (value: string) => void;
  seatingOptionsLoading: boolean;
  sitNextToUserIds: string[];
  onSitNextToUserIdsChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  return <Autocomplete
        multiple
        disabled={disabled}
        getOptionDisabled={(option) => sitNextToUserIds.length >= 10 && !sitNextToUserIds.includes(option.id)}
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
      />;

}
