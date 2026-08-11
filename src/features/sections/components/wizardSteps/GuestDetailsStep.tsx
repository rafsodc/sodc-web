import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";
import type { GuestDetailRow } from "../../hooks/bookingWizardModel";
import { formatEventGuestPolicy } from "../../utils/eventGuestPolicy";

interface GuestTicketType {
  id: string;
  title: string;
  price: number;
}

interface GuestDetailsStepProps {
  guests: GuestDetailRow[];
  guestCountInput: string;
  guestTicketTypes: GuestTicketType[];
  maxGuestsWithoutModeratorApproval?: number | null;
  onGuestCountInputChange: (raw: string) => void;
  onGuestCountChange: (count: number) => void;
  onGuestChange: (index: number, changes: Partial<GuestDetailRow>) => void;
  onRemoveGuest: (index: number) => void;
}

export default function GuestDetailsStep({
  guests,
  guestCountInput,
  guestTicketTypes,
  maxGuestsWithoutModeratorApproval,
  onGuestCountInputChange,
  onGuestCountChange,
  onGuestChange,
  onRemoveGuest,
}: GuestDetailsStepProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {formatEventGuestPolicy(maxGuestsWithoutModeratorApproval)}
      </Typography>

      {!guestTicketTypes.length ? (
        <Alert severity="info">No guest tickets are available. Continue with your member ticket only.</Alert>
      ) : (
        <TextField
          label="Number of guests"
          type="number"
          size="small"
          inputProps={{ min: 0, step: 1 }}
          value={guestCountInput}
          onChange={(event) => {
            const raw = event.target.value;
            if (!/^\d*$/.test(raw)) return;
            onGuestCountInputChange(raw);
            if (raw !== "") onGuestCountChange(Number.parseInt(raw, 10));
          }}
          onBlur={() => {
            if (guestCountInput === "") {
              onGuestCountInputChange(String(guests.length));
            }
          }}
          helperText="Include every guest in this booking."
          sx={{ minWidth: 240, mb: 3 }}
        />
      )}

      {guests.map((guest, index) => (
        <Box
          key={guest.bookingPlaceId ?? guest.bookingLineId ?? `guest-${index}`}
          component="fieldset"
          sx={{
            m: 0,
            mb: 2,
            p: 2,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography component="legend" variant="subtitle2">Guest {index + 1}</Typography>
            {guest.paid ? <Chip label="Paid ticket" color="success" size="small" /> : null}
          </Box>
          <FormControl fullWidth sx={{ mb: 1.5 }}>
            <RadioGroup
              aria-label={`Ticket type for guest ${index + 1}`}
              value={guest.ticketTypeId ?? ""}
              onChange={(_, value) => onGuestChange(index, { ticketTypeId: value || null })}
            >
              {guestTicketTypes.map((ticketType) => (
                <FormControlLabel
                  key={ticketType.id}
                  value={ticketType.id}
                  disabled={guest.paid && ticketType.id !== guest.ticketTypeId}
                  control={<Radio size="small" />}
                  label={`${ticketType.title} (${formatGbpMajorAmount(ticketType.price)})`}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <TextField
            label="Guest name"
            fullWidth
            size="small"
            value={guest.guestDisplayName}
            disabled={guest.paid}
            onChange={(event) => onGuestChange(index, { guestDisplayName: event.target.value })}
            helperText={guest.paid ? "A paid ticket cannot be transferred to another guest." : "Shown on the guest ticket"}
          />
          <TextField
            label="Dietary requirements (optional)"
            fullWidth
            size="small"
            value={guest.dietaryNote}
            onChange={(event) => onGuestChange(index, { dietaryNote: event.target.value })}
            sx={{ mt: 1.5 }}
          />
          <Button
            size="small"
            color="error"
            disabled={guest.paid}
            onClick={() => onRemoveGuest(index)}
            sx={{ mt: 1 }}
          >
            Remove guest
          </Button>
          {guest.paid ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              This guest cannot be removed because their ticket has been paid for. Refund requests will be added later.
            </Typography>
          ) : null}
        </Box>
      ))}

      {guestTicketTypes.length > 0 ? (
        <Button variant="outlined" onClick={() => onGuestCountChange(guests.length + 1)}>
          Add guest
        </Button>
      ) : null}
    </Box>
  );
}
