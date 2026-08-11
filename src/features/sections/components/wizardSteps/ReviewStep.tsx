import { Alert, Box, Typography } from "@mui/material";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";
import type { GuestDetailRow } from "../../hooks/bookingWizardModel";
import { guestCountNeedsModerationNotice } from "../../utils/eventGuestPolicy";

interface ReviewStepProps {
  selectedMember?: { title: string; price: number } | null;
  memberDietaryNote: string;
  guests: GuestDetailRow[];
  guestTicketTypes: Array<{ id: string; title: string; price: number }>;
  sitNextToLabels: string[];
  accommodationRequested: boolean;
  maxGuestsWithoutModeratorApproval?: number | null;
  editingExistingBooking: boolean;
}

export default function ReviewStep({
  selectedMember,
  memberDietaryNote,
  guests,
  guestTicketTypes,
  sitNextToLabels,
  accommodationRequested,
  maxGuestsWithoutModeratorApproval,
  editingExistingBooking,
}: ReviewStepProps) {
  const needsApproval = guestCountNeedsModerationNotice(
    guests.length,
    maxGuestsWithoutModeratorApproval
  );

  return (
    <Box>
      <Alert severity={needsApproval ? "warning" : "info"} sx={{ mb: 2 }}>
        {needsApproval
          ? `This complete booking will be sent for organiser approval because it has ${guests.length} guest${guests.length === 1 ? "" : "s"}. Payment will become available after approval.`
          : "After you submit, you can proceed to payment for the complete booking."}
        {editingExistingBooking && needsApproval
          ? " Saving these changes will return the booking to awaiting approval."
          : ""}
      </Alert>

      <Box component="dl" sx={{ m: 0, "& dt": { fontWeight: 600, mt: 1.5 }, "& dd": { m: 0 } }}>
        <Typography component="dt" variant="body2">Your ticket</Typography>
        <Typography component="dd" variant="body2" color="text.secondary">
          {selectedMember?.title ?? "—"}
          {selectedMember?.price != null ? ` · ${formatGbpMajorAmount(selectedMember.price)}` : ""}
          {memberDietaryNote.trim() ? ` · Dietary: ${memberDietaryNote.trim()}` : ""}
        </Typography>

        <Typography component="dt" variant="body2">Seating preference</Typography>
        <Typography component="dd" variant="body2" color="text.secondary">
          {sitNextToLabels.length ? sitNextToLabels.join(", ") : "None"}
        </Typography>

        <Typography component="dt" variant="body2">Accommodation</Typography>
        <Typography component="dd" variant="body2" color="text.secondary">
          {accommodationRequested ? "Requested" : "Not requested"}
        </Typography>

        <Typography component="dt" variant="body2">Guests</Typography>
        <Typography component="dd" variant="body2" color="text.secondary">
          {guests.length === 0 ? "None" : guests.length}
        </Typography>

        {guests.map((guest, index) => {
          const ticket = guestTicketTypes.find((candidate) => candidate.id === guest.ticketTypeId);
          return (
            <Box key={guest.bookingPlaceId ?? guest.bookingLineId ?? index}>
              <Typography component="dt" variant="body2">Guest {index + 1}</Typography>
              <Typography component="dd" variant="body2" color="text.secondary">
                {guest.guestDisplayName.trim()} · {ticket?.title ?? "Guest ticket"}
                {ticket ? ` · ${formatGbpMajorAmount(ticket.price)}` : ""}
                {guest.dietaryNote.trim() ? ` · Dietary: ${guest.dietaryNote.trim()}` : ""}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
