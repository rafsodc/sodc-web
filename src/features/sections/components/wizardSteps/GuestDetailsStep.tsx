import { Alert, Box, Chip, FormControl, FormControlLabel, Radio, RadioGroup, TextField, Typography } from "@mui/material";
import { GuestTicketRequestStatus } from "@dataconnect/generated";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";
import { formatEventGuestPolicy } from "../../utils/eventGuestPolicy";
import type { ExtraGuestDetailRow, WizardMode } from "../../hooks/useBookingWizardState";
import { EMPTY_GUEST_DETAIL } from "../../hooks/useBookingWizardState";

interface GuestTicketType {
  id: string;
  title: string;
  price: number;
}

interface GuestDetailsStepProps {
  wizardMode: WizardMode;
  editingExistingBooking: boolean;
  includeGuest: boolean;
  extraGuestRequestCount: number;
  guestTicketTypes: GuestTicketType[];
  guestTicketTypeId: string | null;
  onGuestTicketTypeChange: (id: string | null) => void;
  guestDisplayName: string;
  onGuestDisplayNameChange: (value: string) => void;
  guestDietaryNote: string;
  onGuestDietaryNoteChange: (value: string) => void;
  extraGuestTicketTypeId: string | null;
  onExtraGuestTicketTypeChange: (id: string | null) => void;
  extraGuestDetails: ExtraGuestDetailRow[];
  onExtraGuestDetailsChange: (updater: (prev: ExtraGuestDetailRow[]) => ExtraGuestDetailRow[]) => void;
  maxGuestsWithoutModeratorApproval?: number | null;
  totalGuestCountInput: string;
  onTotalGuestCountInputChange: (raw: string) => void;
  onTotalGuestCountChange: (n: number) => void;
}

export default function GuestDetailsStep({
  wizardMode,
  editingExistingBooking,
  includeGuest,
  extraGuestRequestCount,
  guestTicketTypes,
  guestTicketTypeId,
  onGuestTicketTypeChange,
  guestDisplayName,
  onGuestDisplayNameChange,
  guestDietaryNote,
  onGuestDietaryNoteChange,
  extraGuestTicketTypeId,
  onExtraGuestTicketTypeChange,
  extraGuestDetails,
  onExtraGuestDetailsChange,
  maxGuestsWithoutModeratorApproval,
  totalGuestCountInput,
  onTotalGuestCountInputChange,
  onTotalGuestCountChange,
}: GuestDetailsStepProps) {
  return (
    <Box>
      {wizardMode === "full" && !editingExistingBooking ? (
        <Box sx={{ mb: 2 }}>
          {!guestTicketTypes.length ? (
            <Typography variant="body2" color="text.secondary">
              No guest ticket types are available. Continue with just your ticket.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {formatEventGuestPolicy(maxGuestsWithoutModeratorApproval)}
              </Typography>
              <TextField
                label="How many guest tickets in total?"
                type="number"
                size="small"
                inputProps={{ min: 0, step: 1 }}
                value={totalGuestCountInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!/^\d*$/.test(raw)) return;
                  onTotalGuestCountInputChange(raw);
                  if (raw === "" || /^\d+$/.test(raw)) {
                    const n = raw === "" ? 0 : Number.parseInt(raw, 10);
                    if (n >= 0) onTotalGuestCountChange(n);
                  }
                }}
                onBlur={() => {
                  if (totalGuestCountInput === "") {
                    onTotalGuestCountInputChange("0");
                    onTotalGuestCountChange(0);
                  }
                }}
                helperText="One guest can be included in your booking. Additional guests are submitted for organiser review."
                sx={{ minWidth: 280 }}
              />
            </>
          )}
        </Box>
      ) : null}

      {editingExistingBooking ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your guest ticket count cannot be changed here. After saving, use{" "}
          <strong>Request additional guests</strong> on your booking summary to add more.
        </Alert>
      ) : null}

      {wizardMode === "full" && includeGuest ? (
        <Box sx={{ mb: 2, pl: 1, borderLeft: 2, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Guest on your booking
          </Typography>
          <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
            <RadioGroup
              value={guestTicketTypeId ?? ""}
              onChange={(_, v) => onGuestTicketTypeChange(v || null)}
            >
              {guestTicketTypes.map((tt) => (
                <FormControlLabel
                  key={tt.id}
                  value={tt.id}
                  control={<Radio size="small" />}
                  label={`${tt.title} (${formatGbpMajorAmount(tt.price)})`}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <TextField
            label="Guest name"
            fullWidth
            size="small"
            value={guestDisplayName}
            onChange={(e) => onGuestDisplayNameChange(e.target.value)}
            helperText="Shown on the guest ticket"
          />
          <TextField
            label="Dietary requirements (optional)"
            fullWidth
            size="small"
            value={guestDietaryNote}
            onChange={(e) => onGuestDietaryNoteChange(e.target.value)}
            sx={{ mt: 1.5 }}
          />
        </Box>
      ) : null}

      {wizardMode === "additionalGuests" || extraGuestRequestCount > 0 ? (
        <Box sx={{ pl: 1, borderLeft: 2, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {wizardMode === "additionalGuests" ? "Guest request details" : "Additional guests (organiser review)"}
          </Typography>
          <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
            <RadioGroup
              value={extraGuestTicketTypeId ?? ""}
              onChange={(_, v) => onExtraGuestTicketTypeChange(v || null)}
            >
              {guestTicketTypes.map((tt) => (
                <FormControlLabel
                  key={tt.id}
                  value={tt.id}
                  control={<Radio size="small" />}
                  label={`${tt.title} (${formatGbpMajorAmount(tt.price)})`}
                />
              ))}
            </RadioGroup>
          </FormControl>
          {Array.from({ length: extraGuestRequestCount }, (_, index) => {
            const guest = extraGuestDetails[index] ?? EMPTY_GUEST_DETAIL;
            return (
              <Box key={index} sx={{ mb: index < extraGuestRequestCount - 1 ? 2 : 0 }}>
                {extraGuestRequestCount > 1 ? (
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                    Guest {index + 1}
                  </Typography>
                ) : null}
                {guest.guestRequestStatus === GuestTicketRequestStatus.PENDING ? (
                  <Chip label="Pending confirmation" color="warning" size="small" sx={{ mb: 1 }} />
                ) : null}
                <TextField
                  label="Guest name"
                  fullWidth
                  size="small"
                  value={guest.guestDisplayName}
                  onChange={(e) => {
                    const value = e.target.value;
                    onExtraGuestDetailsChange((prev) => {
                      const next = [...prev];
                      next[index] = { ...(next[index] ?? EMPTY_GUEST_DETAIL), guestDisplayName: value };
                      return next;
                    });
                  }}
                />
                <TextField
                  label="Dietary requirements (optional)"
                  fullWidth
                  size="small"
                  value={guest.dietaryNote}
                  onChange={(e) => {
                    const value = e.target.value;
                    onExtraGuestDetailsChange((prev) => {
                      const next = [...prev];
                      next[index] = { ...(next[index] ?? EMPTY_GUEST_DETAIL), dietaryNote: value };
                      return next;
                    });
                  }}
                  sx={{ mt: 1.5 }}
                />
              </Box>
            );
          })}
        </Box>
      ) : null}

      {wizardMode === "full" && !includeGuest && extraGuestRequestCount === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No guest tickets selected. Continue to review your booking.
        </Typography>
      ) : null}
    </Box>
  );
}
