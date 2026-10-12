import SeatingPreferencePicker from "../sections/components/SeatingPreferencePicker";
import { useSectionMemberSeatingSearch } from "../sections/hooks/useSectionMemberSeatingOptions";
import { auth } from "../../config/firebase";
import { Checkbox, FormControlLabel, TextField } from "@mui/material";

export type TicketPreferencesForm = {
  accommodationRequested: boolean;
  accommodationNote: string;
  sitNextToUserIds: string[];
};

export default function TicketPreferencesFields({ sectionId, value, onChange, disabled = false, bookerId, canRequestAccommodation = true, accommodationNoteMaxLength = 2000 }: {
  sectionId: string;
  value: TicketPreferencesForm;
  onChange: (value: TicketPreferencesForm) => void;
  disabled?: boolean;
  bookerId?: string;
  canRequestAccommodation?: boolean;
  accommodationNoteMaxLength?: number;
}) {
  const search = useSectionMemberSeatingSearch(sectionId, bookerId ?? auth.currentUser?.uid, value.sitNextToUserIds);
  return <>
    <FormControlLabel label="Request accommodation" control={<Checkbox checked={value.accommodationRequested}
      disabled={disabled || !canRequestAccommodation} onChange={(event) => onChange({ ...value, accommodationRequested: event.target.checked })} />} />
    <TextField label="Accommodation notes" value={value.accommodationNote} multiline disabled={disabled || !canRequestAccommodation}
      inputProps={{ maxLength: accommodationNoteMaxLength }} onChange={(event) => onChange({ ...value, accommodationNote: event.target.value })} />
    <SeatingPreferencePicker seatingOptions={search.options} seatingSearchInputValue={search.inputValue}
      onSeatingSearchInputValueChange={search.setInputValue} seatingOptionsLoading={search.loading}
      sitNextToUserIds={value.sitNextToUserIds} onSitNextToUserIdsChange={(ids) => onChange({ ...value, sitNextToUserIds: ids })}
      disabled={disabled} />
  </>;
}
