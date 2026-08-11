import { Alert, Box, Button, CircularProgress, Paper, Step, StepLabel, Stepper, Typography } from "@mui/material";
import type { GetEventByIdData, GetSectionByIdData } from "@dataconnect/generated";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import { useBookingWizardState } from "../hooks/useBookingWizardState";
import EventBookingStatusSummary from "./EventBookingStatusSummary";
import TicketSelectionStep from "./wizardSteps/TicketSelectionStep";
import GuestDetailsStep from "./wizardSteps/GuestDetailsStep";
import ReviewStep from "./wizardSteps/ReviewStep";

type EventDetail = NonNullable<GetEventByIdData["event"]>;
type SectionDetail = NonNullable<GetSectionByIdData["section"]>;

export interface EventBookingWizardProps {
  section: SectionDetail;
  event: EventDetail;
  wizardOpen?: boolean;
  onWizardOpenChange?: (open: boolean) => void;
  onBookingComplete?: () => void;
  onHasExistingBookingChange?: (hasBooking: boolean) => void;
}

export default function EventBookingWizard({
  section,
  event,
  wizardOpen = false,
  onWizardOpenChange,
  onBookingComplete,
  onHasExistingBookingChange,
}: EventBookingWizardProps) {
  const wizard = useBookingWizardState({
    section,
    event,
    wizardOpen,
    onWizardOpenChange,
    onBookingComplete,
    onHasExistingBookingChange,
  });

  if (wizard.loadingProfile || wizard.loadingBookings) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={28} /></Box>;
  }
  if (!wizard.membershipStatus) {
    return <Alert severity="warning" sx={{ mt: 2 }}>Complete your membership profile before booking events.</Alert>;
  }
  if (wizard.gate.ok !== true) {
    return <Alert severity="info" sx={{ mt: 2 }}>{wizard.gate.message}</Alert>;
  }
  if (!wizard.memberTicketTypes.length) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        There are no member ticket types you are eligible for. If you believe this is wrong, contact an organiser.
      </Alert>
    );
  }
  if (!wizard.showWizard && !wizard.showBookingSummary && !wizard.lastSubmission) return null;

  return (
    <Box sx={{ mt: 1 }}>
      {wizard.showBookingSummary && wizard.existingTerminalBooking ? (
        <>
          <EventBookingStatusSummary
            booking={wizard.existingTerminalBooking}
            paymentBooking={wizard.paymentEligibleBooking}
            eventId={event.id}
            eventTitle={event.title}
            ticketOrders={wizard.ticketOrdersData?.user?.ticketOrders ?? []}
            paymentAdjustments={wizard.bookingPaymentAdjustments}
            onEditBooking={wizard.beginEditingBooking}
            onPayNow={() => void wizard.handlePayAllTickets()}
            payingTicketTypeId={wizard.payingAllTickets ? "all" : null}
          />
          {wizard.submitError ? (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => wizard.setSubmitError(null)}>
              {wizard.submitError}
            </Alert>
          ) : null}
        </>
      ) : null}

      {wizard.lastSubmission && !wizard.existingTerminalBooking ? (
        <Alert severity={wizard.lastSubmission.paymentReady ? "success" : "warning"} sx={{ mt: 2 }}>
          {wizard.lastSubmission.paymentReady
            ? "Your booking has been submitted. Payment is available next."
            : "Your booking has been submitted and is awaiting organiser approval. Payment will become available after approval."}
        </Alert>
      ) : null}

      {wizard.showWizard ? (
        <>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            {wizard.editingExistingBooking ? "Edit your booking" : "Book this event"}
          </Typography>

          {wizard.editingExistingBooking && wizard.existingTerminalBooking ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Editing your {getBookingStatusLabel(wizard.existingTerminalBooking.status).toLowerCase()} booking.
              If the revised guest count is over the event limit, the whole booking will return to awaiting approval.
            </Alert>
          ) : null}

          {wizard.showExpiredDraftHoldNotice && !wizard.editingExistingBooking ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Your previous booking hold expired. Review the details below and submit a new booking.
            </Alert>
          ) : null}

          <Stepper
            activeStep={wizard.activeStep}
            alternativeLabel
            sx={{ mb: 3, overflowX: "auto", pb: 1 }}
          >
            {wizard.steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {wizard.submitError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => wizard.setSubmitError(null)}>
              {wizard.submitError}
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
            {wizard.activeStep === 0 ? (
              <TicketSelectionStep
                memberTicketTypes={wizard.memberTicketTypes}
                memberTicketTypeId={wizard.memberTicketTypeId}
                onMemberTicketTypeChange={wizard.setMemberTicketTypeId}
                bookerDietaryNote={wizard.bookerDietaryNote}
                onBookerDietaryNoteChange={wizard.setBookerDietaryNote}
                seatingOptions={wizard.seatingOptions}
                seatingSearchInputValue={wizard.seatingSearchInputValue}
                onSeatingSearchInputValueChange={wizard.setSeatingSearchInputValue}
                seatingOptionsLoading={wizard.seatingOptionsLoading}
                sitNextToUserIds={wizard.sitNextToUserIds}
                onSitNextToUserIdsChange={wizard.setSitNextToUserIds}
                accommodationRequested={wizard.accommodationRequested}
                onAccommodationRequestedChange={wizard.setAccommodationRequested}
                canRequestAccommodation={wizard.canRequestAccommodation}
              />
            ) : null}

            {wizard.activeStep === 1 ? (
              <GuestDetailsStep
                guests={wizard.guests}
                guestCountInput={wizard.guestCountInput}
                guestTicketTypes={wizard.guestTicketTypes}
                maxGuestsWithoutModeratorApproval={event.maxGuestsWithoutModeratorApproval}
                onGuestCountInputChange={wizard.setGuestCountInput}
                onGuestCountChange={wizard.setGuestCount}
                onGuestChange={wizard.updateGuest}
                onRemoveGuest={wizard.removeGuest}
              />
            ) : null}

            {wizard.activeStep === 2 ? (
              <ReviewStep
                selectedMember={wizard.selectedMember}
                memberDietaryNote={wizard.bookerDietaryNote}
                guests={wizard.guests}
                guestTicketTypes={wizard.guestTicketTypes}
                sitNextToLabels={wizard.seatingOptions
                  .filter((option) => wizard.sitNextToUserIds.includes(option.id))
                  .map((option) => option.label)}
                accommodationRequested={wizard.accommodationRequested}
                maxGuestsWithoutModeratorApproval={event.maxGuestsWithoutModeratorApproval}
                editingExistingBooking={wizard.editingExistingBooking}
              />
            ) : null}
          </Paper>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Button onClick={wizard.handleBack} disabled={wizard.activeStep === 0 || wizard.submitting}>Back</Button>
            {wizard.activeStep < wizard.steps.length - 1 ? (
              <Button variant="contained" onClick={wizard.handleNext} disabled={wizard.submitting}>Next</Button>
            ) : (
              <Button variant="contained" onClick={() => void wizard.handleConfirm()} disabled={wizard.submitting}>
                {wizard.submitting
                  ? "Submitting…"
                  : wizard.editingExistingBooking
                    ? "Save booking changes"
                    : "Submit booking"}
              </Button>
            )}
          </Box>

          {wizard.editingExistingBooking ? (
            <Button size="small" onClick={wizard.cancelEditing} disabled={wizard.submitting} sx={{ mt: 1 }}>
              Cancel editing
            </Button>
          ) : (
            <Button size="small" onClick={wizard.closeWizard} disabled={wizard.submitting} sx={{ mt: 1 }}>
              Cancel
            </Button>
          )}
        </>
      ) : null}
    </Box>
  );
}
