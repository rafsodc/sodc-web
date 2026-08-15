import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import SafeMarkdown from "../../../../shared/components/SafeMarkdown";
import type { EventRow } from "../sectionEventsManagerTypes";

interface EventDialogSurfaceProps {
  open: boolean;
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
  open,
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
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editingEvent ? "Edit event" : "Add event"}</DialogTitle>
      <DialogContent>
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
          {details.trim() ? (
            <SafeMarkdown>{details}</SafeMarkdown>
          ) : (
            <Typography variant="body2" color="text.secondary">Nothing to preview.</Typography>
          )}
        </Box>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting || !title.trim()}>
          {submitting ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
