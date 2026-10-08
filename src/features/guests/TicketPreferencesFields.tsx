import { Checkbox, FormControlLabel, TextField } from "@mui/material";

export type TicketPreferencesForm = {
  accommodationRequested: boolean;
  accommodationNote: string;
  seatingPreferences: string;
};

export default function TicketPreferencesFields({ value, onChange, disabled = false }: {
  value: TicketPreferencesForm;
  onChange: (value: TicketPreferencesForm) => void;
  disabled?: boolean;
}) {
  return <>
    <FormControlLabel label="Request accommodation" control={<Checkbox checked={value.accommodationRequested}
      disabled={disabled} onChange={(event) => onChange({ ...value, accommodationRequested: event.target.checked })} />} />
    <TextField label="Accommodation notes" value={value.accommodationNote} multiline disabled={disabled}
      inputProps={{ maxLength: 2000 }} onChange={(event) => onChange({ ...value, accommodationNote: event.target.value })} />
    <TextField label="Seating preferences" value={value.seatingPreferences} multiline minRows={2} disabled={disabled}
      helperText="Names of people to sit with, one per line (up to 20). Applies to this ticket only."
      onChange={(event) => onChange({ ...value, seatingPreferences: event.target.value })} />
  </>;
}
