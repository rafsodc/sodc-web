import { Alert, Box, Typography } from "@mui/material";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";
import { guestCountNeedsModerationNotice } from "../../utils/eventGuestPolicy";
import type { ExtraGuestDetailRow, WizardMode } from "../../hooks/useBookingWizardState";

interface ReviewStepProps {
  wizardMode: WizardMode;
  totalGuestCount: number;
  extraGuestRequestCount: number;
  includeGuest: boolean;
  selectedMember?: { title: string; price: number } | null;
  selectedGuest?: { title: string } | null;
  guestDisplayName: string;
  guestDietaryNote: string;
  extraGuestDetails: ExtraGuestDetailRow[];
  maxGuestsWithoutModeratorApproval?: number | null;
}

export default function ReviewStep({
  wizardMode,
  totalGuestCount,
  extraGuestRequestCount,
  includeGuest,
  selectedMember,
  selectedGuest,
  guestDisplayName,
  guestDietaryNote,
  extraGuestDetails,
  maxGuestsWithoutModeratorApproval,
}: ReviewStepProps) {
  const guestCountForNotice = wizardMode === "additionalGuests" ? extraGuestRequestCount : totalGuestCount;

  return (
    <Box>
      {guestCountNeedsModerationNotice(guestCountForNotice, maxGuestsWithoutModeratorApproval) ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your guest count may require organiser review before all guest tickets are confirmed.
        </Alert>
      ) : null}

      {wizardMode === "full" ? (
        <Box component="dl" sx={{ m: 0, "& dt": { fontWeight: 600, mt: 1.5 }, "& dd": { m: 0 } }}>
          <Typography component="dt" variant="body2">Your ticket</Typography>
          <Typography component="dd" variant="body2" color="text.secondary">
            {selectedMember?.title ?? "—"}
            {selectedMember?.price != null ? ` · ${formatGbpMajorAmount(selectedMember.price)}` : ""}
          </Typography>

          <Typography component="dt" variant="body2">Guest tickets</Typography>
          <Typography component="dd" variant="body2" color="text.secondary">
            {totalGuestCount === 0
              ? "None"
              : `${totalGuestCount} total${extraGuestRequestCount > 0 ? ` (${extraGuestRequestCount} via organiser review)` : ""}`}
          </Typography>

          {includeGuest ? (
            <>
              <Typography component="dt" variant="body2">Guest on booking</Typography>
              <Typography component="dd" variant="body2" color="text.secondary">
                {selectedGuest?.title ?? "—"} — {guestDisplayName.trim()}
                {guestDietaryNote.trim() ? ` · Dietary: ${guestDietaryNote.trim()}` : ""}
              </Typography>
            </>
          ) : null}

          {extraGuestRequestCount > 0
            ? extraGuestDetails.slice(0, extraGuestRequestCount).map((guest, index) => (
                <Box key={index}>
                  <Typography component="dt" variant="body2">
                    {extraGuestRequestCount === 1 ? "Additional guest" : `Additional guest ${index + 1}`}
                  </Typography>
                  <Typography component="dd" variant="body2" color="text.secondary">
                    {guest.guestDisplayName.trim() || "—"}
                    {guest.dietaryNote.trim() ? ` · Dietary: ${guest.dietaryNote.trim()}` : ""}
                  </Typography>
                </Box>
              ))
            : null}
        </Box>
      ) : (
        <Box component="dl" sx={{ m: 0, "& dt": { fontWeight: 600, mt: 1.5 }, "& dd": { m: 0 } }}>
          <Typography component="dt" variant="body2">Guest tickets requested</Typography>
          <Typography component="dd" variant="body2" color="text.secondary">
            {extraGuestRequestCount}
          </Typography>
          {extraGuestDetails.slice(0, extraGuestRequestCount).map((guest, index) => (
            <Box key={index}>
              <Typography component="dt" variant="body2">
                {extraGuestRequestCount === 1 ? "Guest" : `Guest ${index + 1}`}
              </Typography>
              <Typography component="dd" variant="body2" color="text.secondary">
                {guest.guestDisplayName.trim() || "—"}
                {guest.dietaryNote.trim() ? ` · Dietary: ${guest.dietaryNote.trim()}` : ""}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
