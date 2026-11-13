import { Alert, Box, Button, CircularProgress, Paper, Step, StepLabel, Stepper, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { GetEventByIdData, GetSectionByIdData } from "@dataconnect/generated";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import FailureState from "../../../shared/components/FailureState";
import { useBookingWizardState } from "../hooks/useBookingWizardState";
import { getBookingWindowState } from "../utils/bookingEligibility";
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
  const theme = useTheme();
  const compactLayout = useMediaQuery(theme.breakpoints.down("sm"));

  if (wizard.loadingProfile || wizard.loadingBookings) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={28} /></Box>;
  }
  if (wizard.bookingsError) {
    return (
      <FailureState
        title="Booking unavailable"
        message="We could not load your booking. Please try again."
        onRetry={() => void wizard.refetchMyBookings()}
      />
    );
  }
  if (!wizard.membershipStatus) {
    return <Alert severity="warning" sx={{ mt: 2 }}>Complete your membership profile before booking events.</Alert>;
  }
  // Closing bookings stops creation and edits, but existing bookings can still be paid.
  const showClosedBooking = wizard.gate.ok !== true &&
    "code" in wizard.gate && wizard.gate.code === "OUTSIDE_BOOKING_WINDOW" &&
    getBookingWindowState(event.bookingStartDateTime, event.bookingEndDateTime) === "AFTER" &&
    Boolean(wizard.existingTerminalBooking);
  if (wizard.gate.ok !== true && !showClosedBooking) {
    return <Alert severity="info" sx={{ mt: 2 }}>{wizard.gate.message}</Alert>;
  }
  if (!wizard.memberTicketTypes.length && !showClosedBooking) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        There are no member ticket types you are eligible for. If you believe this is wrong, contact an organiser.
      </Alert>
    );
  }
  if (!showClosedBooking && !wizard.showWizard && !wizard.showBookingSummary && !wizard.lastSubmission) return null;

  return (
    <Box sx={{ mt: 1, minWidth: 0, overflowWrap: "anywhere" }}>
      {showClosedBooking ? (
        <Alert severity="info" sx={{ mb: 2 }}>Bookings for this event are closed.</Alert>
      ) : null}
      {wizard.gate.ok === true && wizard.gate.moderatorWindowOverride ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {wizard.gate.moderatorWindowOverride === "BEFORE"
            ? "Bookings are not yet open to members."
            : "Bookings are closed to members."}{" "}
          {wizard.isAdmin
            ? "As an administrator, you can create or amend your own booking."
            : "As a moderator for this section, you can create or amend your own booking."}
        </Alert>
      ) : null}
      {(showClosedBooking || wizard.showBookingSummary) && wizard.existingTerminalBooking ? (
        <>
          <EventBookingStatusSummary
            booking={wizard.existingTerminalBooking}
            paymentBooking={wizard.paymentEligibleBooking}
            eventId={event.id}
            eventTitle={event.title}
            ticketOrders={wizard.ticketOrdersData?.user?.ticketOrders ?? []}
            paymentAdjustments={wizard.bookingPaymentAdjustments}
            onEditBooking={showClosedBooking ? undefined : wizard.beginEditingBooking}
            onPayNow={() => void wizard.handlePayAllTickets()}
            payingTicketTypeId={wizard.payingAllTickets ? wizard.paymentSummaryForBooking?.unpaidTicketTypeId : null}
          />
          {wizard.submitError ? (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => wizard.setSubmitError(null)}>
              {wizard.submitError}
            </Alert>
          ) : null}
        </>
      ) : null}

      {wizard.lastSubmission && !wizard.existingTerminalBooking ? (
        <Alert
          severity={wizard.lastSubmission.paymentReady ? "success" : "warning"}
          sx={{
            mt: 2,
            flexWrap: "wrap",
            "& .MuiAlert-message": { minWidth: 0, flex: "1 1 180px" },
            "& .MuiAlert-action": { ml: { xs: 0, sm: 2 }, mt: { xs: 1, sm: 0 }, width: { xs: "100%", sm: "auto" }, p: 0 },
          }}
          action={wizard.lastSubmission.paymentReady ? (
            <Button
              color="inherit"
              disabled={wizard.payingAllTickets}
              onClick={() => void wizard.handlePayAllTickets()}
              sx={{ width: { xs: "100%", sm: "auto" }, minHeight: { xs: 44, sm: 36 } }}
            >
              {wizard.payingAllTickets ? "Starting checkout…" : "Continue to payment"}
            </Button>
          ) : undefined}
        >
          {wizard.lastSubmission.paymentReady
            ? "Your booking has been submitted and is ready for payment."
            : "Your booking has been submitted and is awaiting organiser approval. Payment will become available after approval."}
        </Alert>
      ) : null}

      {wizard.showWizard && !showClosedBooking ? (
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

          {compactLayout ? (
            <Box role="status" aria-label="Booking progress" aria-live="polite" sx={{ mb: 2 }}>
              <Typography variant="caption" component="p" color="text.secondary">
                Step {wizard.activeStep + 1} of {wizard.steps.length}
              </Typography>
              <Typography variant="subtitle2" component="p" aria-current="step">{wizard.steps[wizard.activeStep]}</Typography>
            </Box>
          ) : (
            <Stepper activeStep={wizard.activeStep} alternativeLabel sx={{ mb: 3, pb: 1 }}>
              {wizard.steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>
          )}

          {wizard.submitError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => wizard.setSubmitError(null)}>
              {wizard.submitError}
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, minWidth: 0 }}>
            {wizard.activeStep === 0 ? (
              <TicketSelectionStep
                memberTicketTypes={wizard.memberTicketTypes}
                memberTicketTypeId={wizard.memberTicketTypeId}
                onMemberTicketTypeChange={wizard.setMemberTicketTypeId}
                memberDietaryNote={wizard.memberDietaryNote}
                onMemberDietaryNoteChange={wizard.setMemberDietaryNote}
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
                memberDietaryNote={wizard.memberDietaryNote}
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

          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: { xs: 1, sm: 2 }, "& .MuiButton-root": { minHeight: { xs: 44, sm: 36 } } }}>
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
            <Button size="small" onClick={wizard.cancelEditing} disabled={wizard.submitting} sx={{ mt: 1, width: { xs: "100%", sm: "auto" }, minHeight: { xs: 44, sm: 30 } }}>
              Cancel editing
            </Button>
          ) : (
            <Button size="small" onClick={wizard.closeWizard} disabled={wizard.submitting} sx={{ mt: 1, width: { xs: "100%", sm: "auto" }, minHeight: { xs: 44, sm: 30 } }}>
              Cancel
            </Button>
          )}
        </>
      ) : null}
    </Box>
  );
}
