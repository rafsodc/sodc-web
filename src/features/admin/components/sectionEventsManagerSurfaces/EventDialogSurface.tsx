import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SafeMarkdown from "../../../../shared/components/SafeMarkdown";
import type { EventRow } from "../sectionEventsManagerTypes";
import { EVENT_DATE_TIME_FIELDS, validateEventDateTimes, type EventDateTimeField } from "../../utils/eventDatetime";

export interface EventDialogSurfaceProps {
  open: boolean;
  embedded?: boolean;
  dirty?: boolean;
  error?: string | null;
  notice?: ReactNode;
  saveDisabled?: boolean;
  editingEvent: EventRow | null;
  title: string;
  location: string;
  guestOfHonour: string;
  sponsors: string;
  details: string;
  startDateTime: string;
  endDateTime: string;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  maxGuestsStr: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onGuestOfHonourChange: (value: string) => void;
  onSponsorsChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onStartDateTimeChange: (value: string) => void;
  onEndDateTimeChange: (value: string) => void;
  onBookingStartDateTimeChange: (value: string) => void;
  onBookingEndDateTimeChange: (value: string) => void;
  onMaxGuestsChange: (value: string) => void;
}
export function EventDialogSurface({
  open, error,
  embedded = false, dirty = false,
  notice, saveDisabled,
  editingEvent,
  title,
  location,
  guestOfHonour,
  sponsors,
  details,
  startDateTime,
  endDateTime,
  bookingStartDateTime,
  bookingEndDateTime,
  maxGuestsStr,
  submitting,
  onClose,
  onSubmit,
  onTitleChange,
  onLocationChange,
  onGuestOfHonourChange,
  onSponsorsChange,
  onDetailsChange,
  onStartDateTimeChange,
  onEndDateTimeChange,
  onBookingStartDateTimeChange,
  onBookingEndDateTimeChange,
  onMaxGuestsChange,
}: EventDialogSurfaceProps) {
  const headingId = useId();
  const errorId = useId();
  const [validationAttempted, setValidationAttempted] = useState(false);
  const titleInput = useRef<HTMLInputElement | null>(null);
  const maxGuestsInput = useRef<HTMLInputElement | null>(null);
  const dateInputs = useRef<Partial<Record<EventDateTimeField, HTMLInputElement | null>>>({});
  const dateValidation = validateEventDateTimes({ startDateTime, endDateTime, bookingStartDateTime, bookingEndDateTime });
  const dateErrors = validationAttempted ? dateValidation.errors : {};
  const titleError = !title.trim() ? "Title is required." : undefined;
  const maxGuests = Number(maxGuestsStr.trim());
  const maxGuestsError = !maxGuestsStr.trim()
    ? "Max guests without moderator approval is required."
    : !Number.isInteger(maxGuests) || maxGuests < 0
      ? "Enter a whole number of guest places, 0 or more."
      : undefined;
  useEffect(() => { setValidationAttempted(false); }, [open, editingEvent?.id]);
  const saveIsDisabled = submitting || saveDisabled;
  const submit = () => {
    if (saveIsDisabled) return;
    setValidationAttempted(true);
    if (titleError) {
      titleInput.current?.focus();
      return;
    }
    if (!dateValidation.valid) {
      const firstInvalid = EVENT_DATE_TIME_FIELDS.find(field => dateValidation.errors[field]);
      if (firstInvalid) dateInputs.current[firstInvalid]?.focus();
      return;
    }
    if (maxGuestsError) {
      maxGuestsInput.current?.focus();
      return;
    }
    onSubmit();
  };
  const errorAlert = error && <Alert id={errorId} severity="error" aria-atomic="true" sx={{ mb: 2 }}>{error}</Alert>;
  const saveLabel = submitting ? "Saving event" : "Save";
  const saveContent = submitting ? <><CircularProgress size={20} aria-hidden="true" sx={{ mr: 1 }} />Saving…</> : null;
  const previewDetails = details.trim();
  const informationFields = (
    <>
      <TextField label="Title" fullWidth value={title} inputRef={titleInput}
        error={validationAttempted && !!titleError} helperText={validationAttempted && titleError}
        onChange={(event) => onTitleChange(event.target.value)} margin="dense" required />
      <TextField label="Location" fullWidth value={location} onChange={(event) => onLocationChange(event.target.value)} margin="dense" />
      <TextField
        label="Guest of honour"
        fullWidth
        value={guestOfHonour}
        onChange={(event) => onGuestOfHonourChange(event.target.value)}
        margin="dense"
      />
      <TextField
        label="Sponsors"
        fullWidth
        multiline
        minRows={2}
        value={sponsors}
        onChange={(event) => onSponsorsChange(event.target.value)}
        margin="dense"
        helperText="Enter one or more sponsor names. Line breaks are preserved."
      />
      <TextField
        label="Event details"
        fullWidth
        multiline
        minRows={6}
        value={details}
        onChange={(event) => onDetailsChange(event.target.value)}
        margin="dense"
        helperText="Supports Markdown headings, paragraphs, emphasis, lists, links, quotes, and inline code. Raw HTML is ignored."
      />
      <Typography variant="subtitle2" sx={{ mt: 2 }}>
        Event details preview
      </Typography>
      <Box sx={{ mt: 1, mb: 1, p: 2, minHeight: 64, border: 1, borderColor: "divider", borderRadius: 1 }}>
        {previewDetails ? (
          <SafeMarkdown>{previewDetails}</SafeMarkdown>
        ) : (
          <Typography variant="body2" color="text.secondary">Nothing to preview.</Typography>
        )}
      </Box>
    </>
  );
  const scheduleFields = (
    <>
      <TextField
        label="Start date/time"
        type="datetime-local"
        fullWidth
        value={startDateTime}
        required
        inputRef={(input: HTMLInputElement | null) => { dateInputs.current.startDateTime = input; }}
        error={!!dateErrors.startDateTime}
        helperText={dateErrors.startDateTime}
        onChange={(event) => onStartDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="End date/time"
        type="datetime-local"
        fullWidth
        value={endDateTime}
        required
        inputRef={(input: HTMLInputElement | null) => { dateInputs.current.endDateTime = input; }}
        error={!!dateErrors.endDateTime}
        helperText={dateErrors.endDateTime}
        onChange={(event) => onEndDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
    </>
  );
  const bookingFields = (
    <>
      <TextField
        label="Booking window start"
        type="datetime-local"
        fullWidth
        value={bookingStartDateTime}
        required
        inputRef={(input: HTMLInputElement | null) => { dateInputs.current.bookingStartDateTime = input; }}
        error={!!dateErrors.bookingStartDateTime}
        helperText={dateErrors.bookingStartDateTime}
        onChange={(event) => onBookingStartDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="Booking window end"
        type="datetime-local"
        fullWidth
        value={bookingEndDateTime}
        required
        inputRef={(input: HTMLInputElement | null) => { dateInputs.current.bookingEndDateTime = input; }}
        error={!!dateErrors.bookingEndDateTime}
        helperText={dateErrors.bookingEndDateTime}
        onChange={(event) => onBookingEndDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="Max guests without moderator approval"
        type="number"
        fullWidth
        value={maxGuestsStr}
        inputRef={maxGuestsInput}
        error={validationAttempted && !!maxGuestsError}
        onChange={(event) => onMaxGuestsChange(event.target.value)}
        margin="dense"
        required
        inputProps={{ min: 0 }}
        helperText={validationAttempted && maxGuestsError || "Guest places only (not the member). Use 0 when every guest booking needs approval."}
      />
    </>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <Box
        component="form"
        noValidate
        aria-labelledby={headingId}
        aria-describedby={error ? errorId : undefined}
        aria-busy={submitting}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Typography id={headingId} component="h2" variant="h5">Event details</Typography>
          <Box role="status" aria-live="polite">
            <Chip size="small" label={dirty ? "Unsaved changes" : "Saved"} color={dirty ? "warning" : "default"} variant="outlined" />
          </Box>
        </Stack>
        {notice}
        {errorAlert}
        <Stack gap={3}>
          <Box component="fieldset" sx={{ m: 0, p: { xs: 2, sm: 3 }, minWidth: 0, border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Typography component="legend" variant="h6" sx={{ px: 0.75 }}>Event information</Typography>
            {informationFields}
          </Box>
          <Box component="fieldset" sx={{ m: 0, p: { xs: 2, sm: 3 }, minWidth: 0, border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Typography component="legend" variant="h6" sx={{ px: 0.75 }}>Event schedule</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>{scheduleFields}</Box>
          </Box>
          <Box component="fieldset" sx={{ m: 0, p: { xs: 2, sm: 3 }, minWidth: 0, border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Typography component="legend" variant="h6" sx={{ px: 0.75 }}>Booking window</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, "& > :last-child": { gridColumn: "1 / -1" } }}>{bookingFields}</Box>
          </Box>
          <Stack direction="row" justifyContent="flex-end" gap={1} flexWrap="wrap">
            <Button type="button" onClick={onClose} disabled={submitting}>Discard changes</Button>
            <Button aria-label={saveLabel} aria-busy={submitting} type="submit" variant="contained" disabled={saveIsDisabled}>
              {saveContent ?? "Save"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby={headingId} aria-describedby={error ? errorId : undefined} maxWidth="md" fullWidth>
      <DialogTitle id={headingId}>{editingEvent ? "Edit event" : "Add event"}</DialogTitle>
      <DialogContent>
        {notice}
        {errorAlert}
        {informationFields}
        {scheduleFields}
        {bookingFields}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button aria-label={saveLabel} aria-busy={submitting} variant="contained" onClick={submit} disabled={saveIsDisabled}>
          {saveContent ?? "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
