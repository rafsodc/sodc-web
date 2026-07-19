import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import type { EventRow } from "../sectionEventsManagerTypes";

interface EventDialogSurfaceProps {
  open: boolean;
  editingEvent: EventRow | null;
  title: string;
  location: string;
  guestOfHonour: string;
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
  onStartDateTimeChange,
  onEndDateTimeChange,
  onBookingStartDateTimeChange,
  onBookingEndDateTimeChange,
  onMaxGuestsChange,
}: EventDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
          inputProps={{ min: 0 }}
          helperText="Leave blank if unset. Total guest headcount allowed before extra approval."
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
