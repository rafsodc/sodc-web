import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  useGetCurrentUser,
  useGetMyBookingPaymentAdjustments,
  useGetMyBookingsForEvent,
  useGetMyTicketOrders,
  useGetUserAccessGroups,
} from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import { ROUTES } from "../../../constants/routes";
import type { GetEventByIdData, GetSectionByIdData, UUIDString } from "@dataconnect/generated";
import { BookingStatus, TicketAudience } from "@dataconnect/generated";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import {
  createTicketCheckoutSession,
  getSectionMembersMerged,
  submitEventBooking,
  submitGuestTicketRequest,
} from "../../../shared/utils/firebaseFunctions";
import { toCanonicalUuid } from "../../../shared/utils/uuid";
import { evaluateBookingGatePreview, userMatchesUserGroup } from "../utils/bookingEligibility";
import {
  formatEventGuestPolicy,
  guestCountNeedsModerationNotice,
} from "../utils/eventGuestPolicy";
import {
  EXPIRED_DRAFT_HOLD_MESSAGE,
  hasExpiredDraftHold,
  summarizeEventBookingPayment,
} from "../utils/eventBookingStatusSummary";
import EventBookingStatusSummary from "./EventBookingStatusSummary";

type EventDetail = NonNullable<GetEventByIdData["event"]>;
type SectionDetail = NonNullable<GetSectionByIdData["section"]>;

const FULL_STEPS = [
  "Your ticket",
  "Number of guests",
  "Guest details",
  "Review",
  "Payment",
  "Confirmation",
] as const;

const ADDITIONAL_GUEST_STEPS = ["Extra guests", "Guest details", "Review"] as const;

type WizardMode = "full" | "additionalGuests";

function extractCallableErrorCode(err: unknown): string | undefined {
  const e = err as {
    code?: string;
    message?: string;
    details?: { code?: string };
    customData?: { code?: string };
  };
  return e?.details?.code ?? e?.customData?.code;
}

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
  const [wizardMode, setWizardMode] = useState<WizardMode>("full");
  const [activeStep, setActiveStep] = useState(0);
  const [memberTicketTypeId, setMemberTicketTypeId] = useState<string | null>(null);
  const [totalGuestCount, setTotalGuestCount] = useState(0);
  const [requestedExtraGuestCount, setRequestedExtraGuestCount] = useState(1);
  const [guestTicketTypeId, setGuestTicketTypeId] = useState<string | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState("");
  const [extraGuestTicketTypeId, setExtraGuestTicketTypeId] = useState<string | null>(null);
  const [extraGuestDisplayName, setExtraGuestDisplayName] = useState("");
  const [extraGuestDietaryNote, setExtraGuestDietaryNote] = useState("");
  const [bookerDietaryNote, setBookerDietaryNote] = useState("");
  const [sitNextToUserIds, setSitNextToUserIds] = useState<string[]>([]);
  const [accommodationRequested, setAccommodationRequested] = useState(false);
  const [accommodationNote, setAccommodationNote] = useState("");
  const [seatingOptions, setSeatingOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [payingTicketTypeId, setPayingTicketTypeId] = useState<string | null>(null);
  const [postSubmitFlow, setPostSubmitFlow] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);
  const hydratedBookingIdRef = useRef<string | null>(null);

  const includeGuest = wizardMode === "additionalGuests" ? false : totalGuestCount >= 1;
  const extraGuestRequestCount =
    wizardMode === "additionalGuests" ? requestedExtraGuestCount : Math.max(0, totalGuestCount - 1);
  const steps = wizardMode === "additionalGuests" ? ADDITIONAL_GUEST_STEPS : FULL_STEPS;

  const { data: currentUserData, isLoading: loadingProfile } = useGetCurrentUser(dataConnect, {});
  const { data: accessData } = useGetUserAccessGroups(dataConnect, {});
  const {
    data: myBookingsData,
    isLoading: loadingBookings,
    refetch: refetchMyBookings,
  } = useGetMyBookingsForEvent(dataConnect, { eventId: event.id as UUIDString });

  const membershipStatus = currentUserData?.user?.membershipStatus;

  const explicitGroupIds = useMemo(() => {
    const ids = accessData?.user?.userGroups?.map((g) => g.userGroup.id) ?? [];
    return new Set(ids);
  }, [accessData]);

  const gate = useMemo(() => {
    if (!membershipStatus) {
      return { ok: false as const, message: "Your profile must include a membership status before booking." };
    }
    return evaluateBookingGatePreview({
      purposeLinks: section.purposeLinks ?? [],
      membershipStatus,
      explicitGroupIds,
      bookingStartDateTime: event.bookingStartDateTime,
      bookingEndDateTime: event.bookingEndDateTime,
    });
  }, [membershipStatus, section.purposeLinks, explicitGroupIds, event]);

  const memberTicketTypes = useMemo(() => {
    if (!membershipStatus || gate.ok !== true) return [];
    return (event.ticketTypes ?? []).filter(
      (tt) =>
        tt.audience === TicketAudience.MEMBER &&
        userMatchesUserGroup(membershipStatus, tt.userGroup, explicitGroupIds)
    );
  }, [event.ticketTypes, membershipStatus, explicitGroupIds, gate]);

  const guestTicketTypes = useMemo(() => {
    if (!membershipStatus || gate.ok !== true) return [];
    return (event.ticketTypes ?? []).filter(
      (tt) =>
        tt.audience === TicketAudience.GUEST &&
        userMatchesUserGroup(membershipStatus, tt.userGroup, explicitGroupIds)
    );
  }, [event.ticketTypes, membershipStatus, explicitGroupIds, gate]);

  const existingTerminalBooking = useMemo(() => {
    const list = myBookingsData?.user?.bookings ?? [];
    return list
      .filter((b) => b.status === BookingStatus.SUBMITTED || b.status === BookingStatus.CONFIRMED)
      .reduce<typeof list[number] | null>((latest, booking) => {
        if (!latest) return booking;
        return booking.revisionNumber > latest.revisionNumber ? booking : latest;
      }, null);
  }, [myBookingsData]);

  useEffect(() => {
    onHasExistingBookingChange?.(Boolean(existingTerminalBooking));
  }, [existingTerminalBooking, onHasExistingBookingChange]);

  const { data: ticketOrdersData } = useGetMyTicketOrders(dataConnect, {
    enabled: Boolean(existingTerminalBooking) || postSubmitFlow,
  });
  const { data: paymentAdjustmentsData } = useGetMyBookingPaymentAdjustments(dataConnect, {
    enabled: Boolean(existingTerminalBooking) || postSubmitFlow,
  });

  const bookingPaymentAdjustments = useMemo(() => {
    if (!existingTerminalBooking) return [];
    const bookingRow = paymentAdjustmentsData?.user?.bookings?.find(
      (row) => row.id === existingTerminalBooking.id
    );
    return bookingRow?.adjustments ?? [];
  }, [existingTerminalBooking, paymentAdjustmentsData]);

  const existingDraft = useMemo(() => {
    const list = myBookingsData?.user?.bookings ?? [];
    return list.find((b) => b.status === BookingStatus.DRAFT) ?? null;
  }, [myBookingsData]);

  const showExpiredDraftHoldNotice = useMemo(() => {
    return hasExpiredDraftHold(myBookingsData?.user?.bookings);
  }, [myBookingsData]);

  useEffect(() => {
    const raw = existingDraft?.clientSubmissionKey;
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return;
    }
    try {
      idempotencyKeyRef.current = toCanonicalUuid(raw.trim());
    } catch {
      // leave ref unchanged if stored value is malformed
    }
  }, [existingDraft?.id, existingDraft?.clientSubmissionKey]);

  useEffect(() => {
    const booking = existingTerminalBooking;
    if (!booking) {
      hydratedBookingIdRef.current = null;
      setIsEditingBooking(false);
      return;
    }
    if (hydratedBookingIdRef.current === booking.id) {
      return;
    }
    hydratedBookingIdRef.current = booking.id;
    setIsEditingBooking(false);
    const memberLine = (booking.lines ?? []).find((line) => line.ticketType?.audience === TicketAudience.MEMBER);
    const guestLine = (booking.lines ?? []).find((line) => line.ticketType?.audience === TicketAudience.GUEST);
    setMemberTicketTypeId(memberLine?.ticketType?.id ?? null);
    const guestLines = (booking.guestTicketRequests ?? []).reduce(
      (sum, request) => sum + request.requestedGuestCount,
      guestLine ? 1 : 0
    );
    setTotalGuestCount(guestLines);
    setGuestTicketTypeId(guestLine?.ticketType?.id ?? null);
    setGuestDisplayName(guestLine?.guestDisplayName ?? "");
    setBookerDietaryNote(booking.bookerDietaryNote ?? "");
    setSitNextToUserIds(booking.sitNextToUserIds ?? []);
    setAccommodationRequested(booking.accommodationRequested === true);
    setAccommodationNote(booking.accommodationNote ?? "");
    setActiveStep(0);
    setSubmitError(null);
  }, [existingTerminalBooking]);

  useEffect(() => {
    if (!guestTicketTypes.length) {
      setGuestTicketTypeId(null);
      setExtraGuestTicketTypeId(null);
      return;
    }
    setGuestTicketTypeId((prev) => {
      if (prev && guestTicketTypes.some((t) => t.id === prev)) return prev;
      return guestTicketTypes[0].id;
    });
    setExtraGuestTicketTypeId((prev) => {
      if (prev && guestTicketTypes.some((t) => t.id === prev)) return prev;
      return guestTicketTypes[0].id;
    });
  }, [guestTicketTypes]);

  const selectedMember = memberTicketTypes.find((t) => t.id === memberTicketTypeId);
  const selectedGuest = guestTicketTypes.find((t) => t.id === guestTicketTypeId);
  const canRequestAccommodation = membershipStatus === "REGULAR" || membershipStatus === "RESERVE";

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const merged = await getSectionMembersMerged(section.id);
        if (!alive) return;
        const options = (merged.members ?? [])
          .filter((m) => m.id !== currentUserData?.user?.id)
          .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }));
        setSeatingOptions(options);
      } catch {
        if (alive) setSeatingOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [section.id, currentUserData?.user?.id]);

  const resetWizardState = useCallback(() => {
    setActiveStep(0);
    setMemberTicketTypeId(null);
    setTotalGuestCount(0);
    setRequestedExtraGuestCount(1);
    setGuestTicketTypeId(guestTicketTypes[0]?.id ?? null);
    setGuestDisplayName("");
    setExtraGuestDisplayName("");
    setExtraGuestDietaryNote("");
    setBookerDietaryNote("");
    setSitNextToUserIds([]);
    setAccommodationRequested(false);
    setAccommodationNote("");
    setSubmitError(null);
    setPostSubmitFlow(false);
    if (!existingDraft?.clientSubmissionKey?.trim()) {
      idempotencyKeyRef.current = null;
    }
  }, [existingDraft?.clientSubmissionKey, guestTicketTypes]);

  const closeWizard = useCallback(() => {
    setWizardMode("full");
    setPostSubmitFlow(false);
    setIsEditingBooking(false);
    onWizardOpenChange?.(false);
  }, [onWizardOpenChange]);

  const paymentSummaryForBooking = useMemo(() => {
    if (!existingTerminalBooking) return null;
    return summarizeEventBookingPayment({
      booking: existingTerminalBooking,
      eventId: event.id,
      ticketOrders: ticketOrdersData?.user?.ticketOrders ?? [],
      adjustments: bookingPaymentAdjustments,
    });
  }, [existingTerminalBooking, event.id, ticketOrdersData, bookingPaymentAdjustments]);

  const validateGuestCountStep = (): boolean => {
    if (wizardMode === "additionalGuests") {
      if (extraGuestRequestCount < 1) {
        setSubmitError("Enter how many extra guest tickets you need.");
        return false;
      }
      return true;
    }
    if (totalGuestCount > 0 && !guestTicketTypes.length) {
      setSubmitError("Guest tickets are not available for this event.");
      return false;
    }
    return true;
  };

  const validateGuestDetailsStep = (): boolean => {
    if (wizardMode === "additionalGuests" || includeGuest) {
      const typeId = wizardMode === "additionalGuests" ? extraGuestTicketTypeId : guestTicketTypeId;
      const name = wizardMode === "additionalGuests" ? extraGuestDisplayName : guestDisplayName;
      if (!typeId) {
        setSubmitError("Choose a guest ticket type.");
        return false;
      }
      if (!name.trim()) {
        setSubmitError("Enter a name for your guest.");
        return false;
      }
    }
    if (wizardMode === "full" && extraGuestRequestCount > 0) {
      if (!extraGuestTicketTypeId) {
        setSubmitError("Choose a ticket type for additional guests.");
        return false;
      }
      if (!extraGuestDisplayName.trim()) {
        setSubmitError("Enter a contact name for the additional guest request.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    setSubmitError(null);
    if (wizardMode === "additionalGuests") {
      if (activeStep === 0) {
        if (!validateGuestCountStep()) return;
        setActiveStep(1);
        return;
      }
      if (activeStep === 1) {
        if (!validateGuestDetailsStep()) return;
        setActiveStep(2);
      }
      return;
    }

    if (activeStep === 0) {
      if (!memberTicketTypeId) {
        setSubmitError("Choose a ticket for yourself.");
        return;
      }
      setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      if (!validateGuestCountStep()) return;
      setActiveStep(2);
      return;
    }
    if (activeStep === 2) {
      if (!validateGuestDetailsStep()) return;
      setActiveStep(3);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
  };

  const submitAdditionalGuestRequest = async (bookingId: string) => {
    if (extraGuestRequestCount < 1 || !extraGuestTicketTypeId) return;
    await submitGuestTicketRequest({
      bookingId,
      requestedGuestCount: extraGuestRequestCount,
      guestTicketTypeId: extraGuestTicketTypeId,
      guestDisplayName: extraGuestDisplayName.trim(),
      dietaryNote: extraGuestDietaryNote.trim() || null,
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (wizardMode === "additionalGuests") {
        if (!existingTerminalBooking) {
          setSubmitError("Submit your main booking before requesting additional guests.");
          return;
        }
        await submitAdditionalGuestRequest(existingTerminalBooking.id);
        await refetchMyBookings();
        onBookingComplete?.();
        closeWizard();
        return;
      }

      if (!memberTicketTypeId || !membershipStatus || gate.ok !== true) return;

      if (!idempotencyKeyRef.current) {
        const fromDraft = existingDraft?.clientSubmissionKey?.trim();
        if (fromDraft) {
          try {
            idempotencyKeyRef.current = toCanonicalUuid(fromDraft);
          } catch {
            idempotencyKeyRef.current = crypto.randomUUID();
          }
        } else {
          idempotencyKeyRef.current = crypto.randomUUID();
        }
      }

      const lines: {
        ticketTypeId: string;
        sortOrder: number;
        guestUserId: string | null;
        guestDisplayName: string | null;
        dietaryNote: string | null;
      }[] = [
        {
          ticketTypeId: memberTicketTypeId,
          sortOrder: 0,
          guestUserId: null,
          guestDisplayName: null,
          dietaryNote: null,
        },
      ];

      if (includeGuest && guestTicketTypeId) {
        lines.push({
          ticketTypeId: guestTicketTypeId,
          sortOrder: 1,
          guestUserId: null,
          guestDisplayName: guestDisplayName.trim(),
          dietaryNote: null,
        });
      }

      const result = await submitEventBooking({
        idempotencyKey: idempotencyKeyRef.current,
        eventId: event.id,
        baseBookingId: existingTerminalBooking?.id,
        baseRevisionNumber: existingTerminalBooking?.revisionNumber,
        lines,
        bookerDietaryNote,
        sitNextToUserIds,
        accommodationRequested,
        accommodationNote,
      });

      if (extraGuestRequestCount > 0) {
        await submitAdditionalGuestRequest(result.bookingId);
      }

      await refetchMyBookings();
      setIsEditingBooking(false);
      setPostSubmitFlow(true);
      setActiveStep(4);
      onBookingComplete?.();
    } catch (err: unknown) {
      const code = extractCallableErrorCode(err);
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Booking failed. Please try again.";
      if (code === "BOOKING_ALREADY_SUBMITTED") {
        setSubmitError("You already have a submitted booking for this event.");
        await refetchMyBookings();
      } else if (code === "OUTSIDE_BOOKING_WINDOW") {
        setSubmitError("The booking window is closed.");
      } else if (code === "IDEMPOTENCY_DRAFT_CONFLICT") {
        const refreshed = await refetchMyBookings();
        const bookings = refreshed.data?.user?.bookings ?? [];
        const draft = bookings.find((b) => b.status === BookingStatus.DRAFT);
        const raw = draft?.clientSubmissionKey?.trim();
        if (raw) {
          try {
            idempotencyKeyRef.current = toCanonicalUuid(raw);
            setSubmitError(
              "Your in-progress booking was found. Review your choices and press Confirm booking again."
            );
          } catch {
            setSubmitError(
              "A draft booking is in progress but could not be resumed. Please contact support if this continues."
            );
          }
        } else {
          setSubmitError(
            "A draft booking exists without a resume key. Please contact a moderator to clear it, or try again later."
          );
        }
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayNow = async (ticketTypeId: string) => {
    setPayingTicketTypeId(ticketTypeId);
    try {
      const { url } = await createTicketCheckoutSession({ ticketTypeId, quantity: 1 });
      window.location.assign(url);
    } catch (err: unknown) {
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Could not start checkout. Please try again.";
      setSubmitError(message);
    } finally {
      setPayingTicketTypeId(null);
    }
  };

  const showBookingSummary =
    Boolean(existingTerminalBooking) &&
    !isEditingBooking &&
    !postSubmitFlow &&
    wizardMode === "full" &&
    !wizardOpen;

  const showWizard =
    wizardOpen ||
    isEditingBooking ||
    postSubmitFlow ||
    wizardMode === "additionalGuests";

  const editingExistingBooking = isEditingBooking && Boolean(existingTerminalBooking);
  const pendingAdditionalGuestRequest = (existingTerminalBooking?.guestTicketRequests ?? []).some(
    (request) => request.status === "PENDING"
  );

  if (loadingProfile || loadingBookings) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!membershipStatus) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Complete your membership profile before booking events.
      </Alert>
    );
  }

  if (gate.ok !== true) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        {gate.message}
      </Alert>
    );
  }

  if (!memberTicketTypes.length && wizardMode === "full") {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        There are no member ticket types you are eligible for. If you believe this is wrong, contact a moderator.
      </Alert>
    );
  }

  if (!showWizard && !showBookingSummary) {
    return null;
  }

  return (
    <Box sx={{ mt: 1 }}>
      {showBookingSummary && existingTerminalBooking ? (
        <>
          <EventBookingStatusSummary
            booking={existingTerminalBooking}
            eventId={event.id}
            eventTitle={event.title}
            ticketOrders={ticketOrdersData?.user?.ticketOrders ?? []}
            paymentAdjustments={bookingPaymentAdjustments}
            onEditBooking={() => {
              setWizardMode("full");
              setIsEditingBooking(true);
              onWizardOpenChange?.(true);
            }}
            onPayNow={(ticketTypeId) => void handlePayNow(ticketTypeId)}
            payingTicketTypeId={payingTicketTypeId}
          />
          {submitError ? (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          ) : null}
          <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="outlined"
              disabled={pendingAdditionalGuestRequest || !guestTicketTypes.length}
              onClick={() => {
                setWizardMode("additionalGuests");
                setRequestedExtraGuestCount(1);
                setActiveStep(0);
                onWizardOpenChange?.(true);
              }}
            >
              Request additional guests
            </Button>
            {pendingAdditionalGuestRequest ? (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                You already have a pending guest request awaiting review.
              </Typography>
            ) : null}
          </Box>
        </>
      ) : null}

      {showWizard ? (
        <>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            {wizardMode === "additionalGuests"
              ? "Request additional guest tickets"
              : editingExistingBooking
                ? "Edit your booking"
                : postSubmitFlow
                  ? "Complete your booking"
                  : "Book this event"}
          </Typography>
          {editingExistingBooking && existingTerminalBooking ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Editing revision {existingTerminalBooking.revisionNumber} (
              {getBookingStatusLabel(existingTerminalBooking.status).toLowerCase()}). Saving will create a new
              booking revision.
            </Alert>
          ) : null}

          {showExpiredDraftHoldNotice && !editingExistingBooking && !postSubmitFlow ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {EXPIRED_DRAFT_HOLD_MESSAGE}
            </Alert>
          ) : null}

          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {submitError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            {wizardMode === "additionalGuests" && activeStep === 0 ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {formatEventGuestPolicy(event.maxGuestsWithoutModeratorApproval)}
                </Typography>
                <TextField
                  label="How many extra guest tickets?"
                  type="number"
                  size="small"
                  inputProps={{ min: 1, step: 1 }}
                  value={requestedExtraGuestCount}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setRequestedExtraGuestCount(Number.isFinite(n) && n >= 1 ? n : 1);
                  }}
                  helperText="Moderator review may be required depending on event policy."
                  sx={{ minWidth: 260 }}
                />
              </Box>
            ) : null}

            {wizardMode === "full" && activeStep === 0 ? (
              <FormControl component="fieldset" fullWidth>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Select your member ticket category.
                </Typography>
                <RadioGroup
                  value={memberTicketTypeId ?? ""}
                  onChange={(_, v) => setMemberTicketTypeId(v || null)}
                >
                  {memberTicketTypes.map((tt) => (
                    <FormControlLabel
                      key={tt.id}
                      value={tt.id}
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" component="span">
                            {tt.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {tt.price != null ? String(tt.price) : "—"}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
                <TextField
                  label="Dietary requirements (you)"
                  fullWidth
                  size="small"
                  value={bookerDietaryNote}
                  onChange={(e) => setBookerDietaryNote(e.target.value)}
                  sx={{ mt: 2 }}
                />
                <Autocomplete
                  multiple
                  options={seatingOptions}
                  value={seatingOptions.filter((o) => sitNextToUserIds.includes(o.id))}
                  onChange={(_, next) => setSitNextToUserIds(next.map((n) => n.id))}
                  getOptionLabel={(o) => o.label}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Sit next to (optional)"
                      helperText="Choose members you would like to sit near."
                      size="small"
                      sx={{ mt: 2 }}
                    />
                  )}
                />
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Checkbox
                      checked={accommodationRequested}
                      onChange={(_, checked) => setAccommodationRequested(checked)}
                    />
                  }
                  label="Request accommodation (booker only)"
                  disabled={!canRequestAccommodation}
                />
                {accommodationRequested ? (
                  <TextField
                    label="Accommodation details (optional)"
                    fullWidth
                    size="small"
                    value={accommodationNote}
                    onChange={(e) => setAccommodationNote(e.target.value)}
                  />
                ) : null}
                {!canRequestAccommodation ? (
                  <Typography variant="caption" color="text.secondary">
                    Accommodation requests are only available for{" "}
                    {getMembershipStatusLabel("REGULAR")} or {getMembershipStatusLabel("RESERVE")} members.
                  </Typography>
                ) : null}
              </FormControl>
            ) : null}

            {wizardMode === "full" && activeStep === 1 ? (
              <Box>
                {!guestTicketTypes.length ? (
                  <Typography variant="body2" color="text.secondary">
                    No guest ticket types are available. Continue with just your ticket.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {formatEventGuestPolicy(event.maxGuestsWithoutModeratorApproval)}
                    </Typography>
                    <TextField
                      label="How many guest tickets in total?"
                      type="number"
                      size="small"
                      inputProps={{ min: 0, step: 1 }}
                      value={totalGuestCount}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        setTotalGuestCount(Number.isFinite(n) && n >= 0 ? n : 0);
                      }}
                      helperText="One guest can be included in your booking. Additional guests are submitted for organiser review."
                      sx={{ minWidth: 280 }}
                    />
                  </>
                )}
              </Box>
            ) : null}

            {(wizardMode === "full" && activeStep === 2) || (wizardMode === "additionalGuests" && activeStep === 1) ? (
              <Box>
                {wizardMode === "full" && includeGuest ? (
                  <Box sx={{ mb: 2, pl: 1, borderLeft: 2, borderColor: "divider" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Guest on your booking
                    </Typography>
                    <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                      <RadioGroup
                        value={guestTicketTypeId ?? ""}
                        onChange={(_, v) => setGuestTicketTypeId(v || null)}
                      >
                        {guestTicketTypes.map((tt) => (
                          <FormControlLabel
                            key={tt.id}
                            value={tt.id}
                            control={<Radio size="small" />}
                            label={`${tt.title} (${tt.price != null ? String(tt.price) : "—"})`}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <TextField
                      label="Guest name"
                      fullWidth
                      size="small"
                      value={guestDisplayName}
                      onChange={(e) => setGuestDisplayName(e.target.value)}
                      helperText="Shown on the guest ticket"
                    />
                  </Box>
                ) : null}
                {(wizardMode === "additionalGuests" || extraGuestRequestCount > 0) ? (
                  <Box sx={{ pl: 1, borderLeft: 2, borderColor: "divider" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {wizardMode === "additionalGuests" ? "Guest request details" : "Additional guest request"}
                    </Typography>
                    <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                      <RadioGroup
                        value={extraGuestTicketTypeId ?? ""}
                        onChange={(_, v) => setExtraGuestTicketTypeId(v || null)}
                      >
                        {guestTicketTypes.map((tt) => (
                          <FormControlLabel
                            key={tt.id}
                            value={tt.id}
                            control={<Radio size="small" />}
                            label={`${tt.title} (${tt.price != null ? String(tt.price) : "—"})`}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <TextField
                      label="Guest name"
                      fullWidth
                      size="small"
                      value={extraGuestDisplayName}
                      onChange={(e) => setExtraGuestDisplayName(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Dietary requirements (optional)"
                      fullWidth
                      size="small"
                      value={extraGuestDietaryNote}
                      onChange={(e) => setExtraGuestDietaryNote(e.target.value)}
                    />
                  </Box>
                ) : null}
                {wizardMode === "full" && !includeGuest && extraGuestRequestCount === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No guest tickets selected. Continue to review your booking.
                  </Typography>
                ) : null}
              </Box>
            ) : null}

            {(wizardMode === "full" && activeStep === 3) || (wizardMode === "additionalGuests" && activeStep === 2) ? (
              <Box>
                {guestCountNeedsModerationNotice(
                  wizardMode === "additionalGuests" ? extraGuestRequestCount : totalGuestCount,
                  event.maxGuestsWithoutModeratorApproval
                ) ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Your guest count may require organiser review before all guest tickets are confirmed.
                  </Alert>
                ) : null}
                {wizardMode === "full" ? (
                  <Box component="dl" sx={{ m: 0, "& dt": { fontWeight: 600, mt: 1.5 }, "& dd": { m: 0 } }}>
                    <Typography component="dt" variant="body2">
                      Your ticket
                    </Typography>
                    <Typography component="dd" variant="body2" color="text.secondary">
                      {selectedMember?.title ?? "—"}
                      {selectedMember?.price != null ? ` · ${String(selectedMember.price)}` : ""}
                    </Typography>
                    <Typography component="dt" variant="body2">
                      Guest tickets
                    </Typography>
                    <Typography component="dd" variant="body2" color="text.secondary">
                      {totalGuestCount === 0
                        ? "None"
                        : `${totalGuestCount} total${extraGuestRequestCount > 0 ? ` (${extraGuestRequestCount} via organiser review)` : ""}`}
                    </Typography>
                    {includeGuest ? (
                      <>
                        <Typography component="dt" variant="body2">
                          Guest on booking
                        </Typography>
                        <Typography component="dd" variant="body2" color="text.secondary">
                          {selectedGuest?.title ?? "—"} — {guestDisplayName.trim()}
                        </Typography>
                      </>
                    ) : null}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Requesting {extraGuestRequestCount} additional guest ticket
                    {extraGuestRequestCount === 1 ? "" : "s"} for {extraGuestDisplayName.trim() || "your guest"}.
                  </Typography>
                )}
              </Box>
            ) : null}

            {wizardMode === "full" && activeStep === 4 && existingTerminalBooking && paymentSummaryForBooking ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Pay for each ticket type below to secure your place. You can also finish later from your booking
                  summary.
                </Typography>
                {(existingTerminalBooking.lines ?? []).map((line) => {
                  const ticketTypeId = line.ticketType?.id;
                  if (!ticketTypeId) return null;
                  const isUnpaid = paymentSummaryForBooking.unpaidTicketTypeId === ticketTypeId;
                  return (
                    <Box
                      key={line.id}
                      sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
                    >
                      <Typography variant="body2">
                        {line.ticketType?.title ?? "Ticket"}
                        {line.guestDisplayName ? ` — ${line.guestDisplayName}` : ""}
                      </Typography>
                      {isUnpaid ? (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={payingTicketTypeId === ticketTypeId}
                          onClick={() => void handlePayNow(ticketTypeId)}
                          sx={{ backgroundColor: colors.callToAction }}
                        >
                          {payingTicketTypeId === ticketTypeId ? "Starting checkout…" : "Pay now"}
                        </Button>
                      ) : (
                        <Typography variant="caption" color="success.main">
                          Paid
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : null}

            {wizardMode === "full" && activeStep === 5 ? (
              <Alert severity="success">
                Your booking has been submitted. Payment and guest-request updates will appear in your booking summary.
              </Alert>
            ) : null}
          </Paper>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Button onClick={handleBack} disabled={activeStep === 0 || submitting}>
              Back
            </Button>
            <Box sx={{ display: "flex", gap: 1 }}>
              {wizardMode === "full" && activeStep === 4 ? (
                <>
                  <Button variant="outlined" onClick={() => setActiveStep(5)} disabled={submitting}>
                    Skip for now
                  </Button>
                  {paymentSummaryForBooking?.kind === "paid" ? (
                    <Button variant="contained" onClick={() => setActiveStep(5)} sx={{ backgroundColor: colors.callToAction }}>
                      Continue
                    </Button>
                  ) : null}
                </>
              ) : null}
              {activeStep < steps.length - 1 &&
              !(wizardMode === "full" && activeStep === 4) ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={submitting}
                  sx={{ backgroundColor: colors.callToAction }}
                >
                  Next
                </Button>
              ) : null}
              {(wizardMode === "full" && activeStep === 3) || (wizardMode === "additionalGuests" && activeStep === 2) ? (
                <Button
                  variant="contained"
                  onClick={() => void handleConfirm()}
                  disabled={submitting}
                  sx={{ backgroundColor: colors.callToAction }}
                >
                  {submitting
                    ? "Submitting…"
                    : wizardMode === "additionalGuests"
                      ? "Submit request"
                      : editingExistingBooking
                        ? "Save booking changes"
                        : "Confirm booking"}
                </Button>
              ) : null}
              {wizardMode === "full" && activeStep === 5 ? (
                <Button variant="contained" onClick={closeWizard} sx={{ backgroundColor: colors.callToAction }}>
                  Done
                </Button>
              ) : null}
            </Box>
          </Box>

          {activeStep > 0 && wizardMode === "full" && !postSubmitFlow ? (
            <Button size="small" onClick={resetWizardState} disabled={submitting} sx={{ mt: 1 }}>
              Start over
            </Button>
          ) : null}
          {editingExistingBooking ? (
            <Button size="small" onClick={() => setIsEditingBooking(false)} disabled={submitting} sx={{ mt: 1, ml: 1 }}>
              Cancel editing
            </Button>
          ) : null}
          {wizardMode === "additionalGuests" ? (
            <Button size="small" onClick={closeWizard} disabled={submitting} sx={{ mt: 1, ml: 1 }}>
              Cancel
            </Button>
          ) : null}
          {wizardMode === "full" && activeStep === 5 ? (
            <Button component={RouterLink} to={ROUTES.MY_BOOKINGS} size="small" sx={{ mt: 1, ml: 1 }}>
              View in My Bookings
            </Button>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
