import { Alert, Box, Button, CircularProgress, Paper, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { GetEventByIdData, GetSectionByIdData } from "@dataconnect/generated";
import { ROUTES } from "../../../constants/routes";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import { useBookingWizardState } from "../hooks/useBookingWizardState";
import EventBookingStatusSummary from "./EventBookingStatusSummary";
import AdditionalGuestCountStep from "./wizardSteps/AdditionalGuestCountStep";
import TicketSelectionStep from "./wizardSteps/TicketSelectionStep";
import GuestDetailsStep from "./wizardSteps/GuestDetailsStep";
import ReviewStep from "./wizardSteps/ReviewStep";
import PaymentStep from "./wizardSteps/PaymentStep";

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
  const w = useBookingWizardState({
    section,
    event,
    wizardOpen,
    onWizardOpenChange,
    onBookingComplete,
    onHasExistingBookingChange,
  });

  if (w.loadingProfile || w.loadingBookings) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!w.membershipStatus) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Complete your membership profile before booking events.
      </Alert>
    );
  }

  if (w.gate.ok !== true) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        {w.gate.message}
      </Alert>
    );
  }

  if (!w.memberTicketTypes.length && w.wizardMode === "full") {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        There are no member ticket types you are eligible for. If you believe this is wrong, contact a moderator.
      </Alert>
    );
  }

  if (!w.showWizard && !w.showBookingSummary) {
    return null;
  }

  return (
    <Box sx={{ mt: 1 }}>
      {w.showBookingSummary && w.existingTerminalBooking ? (
        <>
          <EventBookingStatusSummary
            booking={w.existingTerminalBooking}
            eventId={event.id}
            eventTitle={event.title}
            ticketOrders={w.ticketOrdersData?.user?.ticketOrders ?? []}
            paymentAdjustments={w.bookingPaymentAdjustments}
            onEditBooking={w.beginEditingBooking}
            onPayNow={() => void w.handlePayAllTickets()}
            payingTicketTypeId={w.payingAllTickets ? "all" : null}
          />
          {w.submitError ? (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => w.setSubmitError(null)}>
              {w.submitError}
            </Alert>
          ) : null}
          <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="outlined"
              disabled={w.pendingAdditionalGuestRequest || !w.guestTicketTypes.length}
              onClick={() => {
                w.setWizardModeToAdditionalGuests();
                onWizardOpenChange?.(true);
              }}
            >
              Request additional guests
            </Button>
            {w.pendingAdditionalGuestRequest ? (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                You already have a pending guest request awaiting review.
              </Typography>
            ) : null}
          </Box>
        </>
      ) : null}

      {w.showWizard ? (
        <>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            {w.wizardMode === "additionalGuests"
              ? "Request additional guest tickets"
              : w.editingExistingBooking
                ? "Edit your booking"
                : w.postSubmitFlow || w.paymentResumeFlow
                  ? "Complete your booking"
                  : "Book this event"}
          </Typography>

          {w.editingExistingBooking && w.existingTerminalBooking ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Editing your {getBookingStatusLabel(w.existingTerminalBooking.status).toLowerCase()} booking. Saving
              will update your booking details.
            </Alert>
          ) : null}

          {w.showExpiredDraftHoldNotice && !w.editingExistingBooking && !w.postSubmitFlow ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Your draft booking hold has expired. You can still complete your booking, but your seat
              is no longer reserved.
            </Alert>
          ) : null}

          <Stepper activeStep={w.activeStep} sx={{ mb: 3 }}>
            {w.steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {w.submitError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => w.setSubmitError(null)}>
              {w.submitError}
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            {w.wizardMode === "additionalGuests" && w.activeStep === 0 ? (
              <AdditionalGuestCountStep
                requestedExtraGuestCountInput={w.requestedExtraGuestCountInput}
                onInputChange={w.setRequestedExtraGuestCountInput}
                onCountChange={w.setRequestedExtraGuestCount}
                maxGuestsWithoutModeratorApproval={event.maxGuestsWithoutModeratorApproval}
              />
            ) : null}

            {w.wizardMode === "full" && w.activeStep === 0 ? (
              <TicketSelectionStep
                memberTicketTypes={w.memberTicketTypes}
                memberTicketTypeId={w.memberTicketTypeId}
                onMemberTicketTypeChange={w.setMemberTicketTypeId}
                bookerDietaryNote={w.bookerDietaryNote}
                onBookerDietaryNoteChange={w.setBookerDietaryNote}
                seatingOptions={w.seatingOptions}
                sitNextToUserIds={w.sitNextToUserIds}
                onSitNextToUserIdsChange={w.setSitNextToUserIds}
                accommodationRequested={w.accommodationRequested}
                onAccommodationRequestedChange={w.setAccommodationRequested}
                canRequestAccommodation={w.canRequestAccommodation}
              />
            ) : null}

            {w.activeStep === 1 ? (
              <GuestDetailsStep
                wizardMode={w.wizardMode}
                editingExistingBooking={w.editingExistingBooking}
                includeGuest={w.includeGuest}
                extraGuestRequestCount={w.extraGuestRequestCount}
                guestTicketTypes={w.guestTicketTypes}
                guestTicketTypeId={w.guestTicketTypeId}
                onGuestTicketTypeChange={w.setGuestTicketTypeId}
                guestDisplayName={w.guestDisplayName}
                onGuestDisplayNameChange={w.setGuestDisplayName}
                guestDietaryNote={w.guestDietaryNote}
                onGuestDietaryNoteChange={w.setGuestDietaryNote}
                extraGuestTicketTypeId={w.extraGuestTicketTypeId}
                onExtraGuestTicketTypeChange={w.setExtraGuestTicketTypeId}
                extraGuestDetails={w.extraGuestDetails}
                onExtraGuestDetailsChange={w.setExtraGuestDetails}
                maxGuestsWithoutModeratorApproval={event.maxGuestsWithoutModeratorApproval}
                totalGuestCountInput={w.totalGuestCountInput}
                onTotalGuestCountInputChange={w.setTotalGuestCountInput}
                onTotalGuestCountChange={w.setTotalGuestCount}
              />
            ) : null}

            {w.activeStep === 2 ? (
              <ReviewStep
                wizardMode={w.wizardMode}
                totalGuestCount={w.totalGuestCount}
                extraGuestRequestCount={w.extraGuestRequestCount}
                includeGuest={w.includeGuest}
                selectedMember={w.selectedMember}
                selectedGuest={w.selectedGuest}
                guestDisplayName={w.guestDisplayName}
                guestDietaryNote={w.guestDietaryNote}
                extraGuestDetails={w.extraGuestDetails}
                maxGuestsWithoutModeratorApproval={event.maxGuestsWithoutModeratorApproval}
              />
            ) : null}

            {w.wizardMode === "full" && w.activeStep === 3 && w.existingTerminalBooking && w.paymentSummaryForBooking ? (
              <PaymentStep
                paymentTicketRows={w.paymentTicketRows}
                canProceedToConfirmation={w.canProceedToConfirmation}
                pendingGuestTicketsAwaitingApproval={w.pendingGuestTicketsAwaitingApproval}
                payingAllTickets={w.payingAllTickets}
                onPayAllTickets={() => void w.handlePayAllTickets()}
              />
            ) : null}

            {w.wizardMode === "full" && w.activeStep === 4 ? (
              <Alert severity="success">
                Your booking is confirmed. Guest-request updates will appear in your booking summary.
              </Alert>
            ) : null}
          </Paper>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Button onClick={w.handleBack} disabled={w.activeStep === 0 || w.submitting}>
              Back
            </Button>
            <Box sx={{ display: "flex", gap: 1 }}>
              {w.activeStep < w.steps.length - 1 &&
              !(
                w.wizardMode === "full" &&
                w.activeStep === 2 &&
                !w.postSubmitFlow &&
                !w.paymentResumeFlow
              ) &&
              !(w.wizardMode === "full" && w.activeStep === 3 && !w.canProceedToConfirmation) ? (
                <Button
                  variant="contained"
                  onClick={w.handleNext}
                  disabled={w.submitting || w.payingAllTickets}
                  sx={{ backgroundColor: "secondary.main" }}
                >
                  Next
                </Button>
              ) : null}
              {((w.wizardMode === "full" && w.activeStep === 2 && !w.paymentResumeFlow && !w.postSubmitFlow) ||
                (w.wizardMode === "additionalGuests" && w.activeStep === 2)) ? (
                <Button
                  variant="contained"
                  onClick={() => void w.handleConfirm()}
                  disabled={w.submitting}
                  sx={{ backgroundColor: "secondary.main" }}
                >
                  {w.submitting
                    ? "Submitting…"
                    : w.wizardMode === "additionalGuests"
                      ? "Submit request"
                      : w.editingExistingBooking
                        ? "Save booking changes"
                        : "Confirm booking"}
                </Button>
              ) : null}
              {w.wizardMode === "full" && w.activeStep === 4 ? (
                <Button variant="contained" onClick={w.closeWizard} sx={{ backgroundColor: "secondary.main" }}>
                  Done
                </Button>
              ) : null}
            </Box>
          </Box>

          {w.editingExistingBooking ? (
            <Button
              size="small"
              onClick={w.cancelEditing}
              disabled={w.submitting || w.payingAllTickets}
              sx={{ mt: 1, ml: 1 }}
            >
              Cancel editing
            </Button>
          ) : null}
          {w.wizardMode === "additionalGuests" ? (
            <Button size="small" onClick={w.closeWizard} disabled={w.submitting} sx={{ mt: 1, ml: 1 }}>
              Cancel
            </Button>
          ) : null}
          {w.wizardMode === "full" && w.activeStep === 4 ? (
            <Button component={RouterLink} to={ROUTES.MY_BOOKINGS} size="small" sx={{ mt: 1, ml: 1 }}>
              View in My Bookings
            </Button>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
