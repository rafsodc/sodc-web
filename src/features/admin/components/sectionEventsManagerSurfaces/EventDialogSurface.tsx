import { useId, type ReactNode } from "react";
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
  const previewDetails = details.trim();
  const informationFields = (
    <>
      <TextField label="Title" fullWidth value={title} onChange={(event) => onTitleChange(event.target.value)} margin="dense" required />
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
        onChange={(event) => onStartDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="End date/time"
        type="datetime-local"
        fullWidth
        value={endDateTime}
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
        onChange={(event) => onBookingStartDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="Booking window end"
        type="datetime-local"
        fullWidth
        value={bookingEndDateTime}
        onChange={(event) => onBookingEndDateTimeChange(event.target.value)}
        margin="dense"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="Max guests without moderator approval"
        type="number"
        fullWidth
        value={maxGuestsStr}
        onChange={(event) => onMaxGuestsChange(event.target.value)}
        margin="dense"
        required
        inputProps={{ min: 0 }}
        helperText="Guest places only (not the member). Use 0 when every guest booking needs approval."
      />
    </>
  );
  const saveIsDisabled = submitting || saveDisabled || !title.trim();

  if (embedded) {
    if (!open) return null;
    return (
      <Box
        component="form"
        aria-labelledby={headingId}
        onSubmit={(submit) => {
          submit.preventDefault();
          if (!saveIsDisabled) onSubmit();
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Typography id={headingId} component="h2" variant="h5">Event details</Typography>
          <Box role="status" aria-live="polite">
            <Chip size="small" label={dirty ? "Unsaved changes" : "Saved"} color={dirty ? "warning" : "default"} variant="outlined" />
          </Box>
        </Stack>
        {notice}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
            <Button aria-label="Save" type="submit" variant="contained" disabled={saveIsDisabled}>
              {submitting ? <CircularProgress size={20} /> : "Save changes"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editingEvent ? "Edit event" : "Add event"}</DialogTitle>
      <DialogContent>
        {notice}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {informationFields}
        {scheduleFields}
        {bookingFields}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button aria-label="Save" variant="contained" onClick={onSubmit} disabled={saveIsDisabled}>
          {submitting ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
