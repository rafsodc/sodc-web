import { useCallback, useEffect, useRef, useState } from "react";
import type { GetEventByIdData, GetSectionByIdData } from "@dataconnect/generated";
import { BookingStatus } from "@dataconnect/generated";
import {
  createEventBookingCheckoutSession,
  submitEventBooking,
  submitGuestTicketRequest,
} from "../../../shared/utils/firebaseFunctions";
import { toCanonicalUuid } from "../../../shared/utils/uuid";
import { bookingNeedsPayment } from "../utils/eventBookingStatusSummary";
import { hydrateFormFromExistingBooking } from "../utils/bookingWizardHydration";
import {
  ADDITIONAL_GUEST_STEPS,
  BOOKING_STEPS,
  buildBookingSubmissionLines,
  EMPTY_GUEST_DETAIL,
  extractCallableErrorCode,
  guestCountValidationError,
  guestDetailsValidationError,
  resizeExtraGuestDetails,
  type ExtraGuestDetailRow,
  type WizardMode,
} from "./bookingWizardModel";
import { useBookingWizardData } from "./useBookingWizardData";
import { useSectionMemberSeatingOptions } from "./useSectionMemberSeatingOptions";

export {
  ADDITIONAL_GUEST_STEPS,
  BOOKING_STEPS,
  EMPTY_GUEST_DETAIL,
} from "./bookingWizardModel";
export type {
  ExtraGuestDetailRow,
  GuestDetailFields,
  WizardMode,
} from "./bookingWizardModel";

type EventDetail = NonNullable<GetEventByIdData["event"]>;
type SectionDetail = NonNullable<GetSectionByIdData["section"]>;

export interface UseBookingWizardStateProps {
  section: SectionDetail;
  event: EventDetail;
  wizardOpen: boolean;
  onWizardOpenChange?: (open: boolean) => void;
  onBookingComplete?: () => void;
  onHasExistingBookingChange?: (hasBooking: boolean) => void;
}

export function useBookingWizardState({
  section,
  event,
  wizardOpen,
  onWizardOpenChange,
  onBookingComplete,
  onHasExistingBookingChange,
}: UseBookingWizardStateProps) {
  const [wizardMode, setWizardMode] = useState<WizardMode>("full");
  const [activeStep, setActiveStep] = useState(0);
  const [memberTicketTypeId, setMemberTicketTypeId] = useState<string | null>(null);
  const [totalGuestCount, setTotalGuestCount] = useState(0);
  const [totalGuestCountInput, setTotalGuestCountInput] = useState("0");
  const [requestedExtraGuestCount, setRequestedExtraGuestCount] = useState(1);
  const [requestedExtraGuestCountInput, setRequestedExtraGuestCountInput] = useState("1");
  const [guestTicketTypeId, setGuestTicketTypeId] = useState<string | null>(null);
  const [guestDisplayName, setGuestDisplayName] = useState("");
  const [guestDietaryNote, setGuestDietaryNote] = useState("");
  const [extraGuestTicketTypeId, setExtraGuestTicketTypeId] = useState<string | null>(null);
  const [extraGuestDetails, setExtraGuestDetails] = useState<ExtraGuestDetailRow[]>([]);
  const [bookerDietaryNote, setBookerDietaryNote] = useState("");
  const [sitNextToUserIds, setSitNextToUserIds] = useState<string[]>([]);
  const [accommodationRequested, setAccommodationRequested] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [postSubmitFlow, setPostSubmitFlow] = useState(false);
  const [paymentResumeFlow, setPaymentResumeFlow] = useState(false);
  const [payingAllTickets, setPayingAllTickets] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);
  const hydratedBookingIdRef = useRef<string | null>(null);

  const includeGuest = wizardMode === "additionalGuests" ? false : totalGuestCount >= 1;
  const extraGuestRequestCount =
    wizardMode === "additionalGuests" ? requestedExtraGuestCount : Math.max(0, totalGuestCount - 1);

  useEffect(() => {
    setExtraGuestDetails((previous) =>
      resizeExtraGuestDetails(previous, extraGuestRequestCount, wizardMode)
    );
  }, [extraGuestRequestCount, wizardMode]);

  const {
    bookingPaymentAdjustments,
    canProceedToConfirmation,
    currentUserData,
    existingDraft,
    existingTerminalBooking,
    gate,
    guestTicketTypes,
    loadingBookings,
    loadingProfile,
    memberTicketTypes,
    membershipStatus,
    paymentSummaryForBooking,
    paymentTicketRows,
    pendingGuestTicketsAwaitingApproval,
    refetchMyBookings,
    showExpiredDraftHoldNotice,
    ticketOrdersData,
  } = useBookingWizardData({ section, event, postSubmitFlow });

  const editingExistingBooking = isEditingBooking && Boolean(existingTerminalBooking);
  const steps = wizardMode === "additionalGuests" ? ADDITIONAL_GUEST_STEPS : BOOKING_STEPS;

  useEffect(() => {
    onHasExistingBookingChange?.(Boolean(existingTerminalBooking));
  }, [existingTerminalBooking, onHasExistingBookingChange]);

  useEffect(() => {
    const raw = existingDraft?.clientSubmissionKey;
    if (!raw || typeof raw !== "string" || !raw.trim()) return;
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
      if (!postSubmitFlow) setIsEditingBooking(false);
      return;
    }
    if (hydratedBookingIdRef.current === booking.id) return;
    hydratedBookingIdRef.current = booking.id;
    if (postSubmitFlow) return;

    setIsEditingBooking(false);
    const snapshot = hydrateFormFromExistingBooking(booking);
    setMemberTicketTypeId(snapshot.memberTicketTypeId);
    setTotalGuestCount(snapshot.totalGuestCount);
    setTotalGuestCountInput(snapshot.totalGuestCountInput);
    setGuestTicketTypeId(snapshot.guestTicketTypeId);
    setGuestDisplayName(snapshot.guestDisplayName);
    setGuestDietaryNote(snapshot.guestDietaryNote);
    if (snapshot.extraGuestTicketTypeId) setExtraGuestTicketTypeId(snapshot.extraGuestTicketTypeId);
    setExtraGuestDetails(snapshot.extraGuestDetails);
    setBookerDietaryNote(snapshot.bookerDietaryNote);
    setSitNextToUserIds(snapshot.sitNextToUserIds);
    setAccommodationRequested(snapshot.accommodationRequested);
    setActiveStep(0);
    setSubmitError(null);
  }, [existingTerminalBooking, postSubmitFlow]);

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
  const seatingOptions = useSectionMemberSeatingOptions(
    section.id,
    currentUserData?.user?.id
  );

  useEffect(() => {
    if (wizardMode !== "full" || activeStep !== 4 || canProceedToConfirmation) return;
    setActiveStep(3);
  }, [wizardMode, activeStep, canProceedToConfirmation]);

  useEffect(() => {
    if (
      loadingBookings ||
      wizardOpen ||
      isEditingBooking ||
      postSubmitFlow ||
      wizardMode !== "full" ||
      !existingTerminalBooking ||
      !paymentSummaryForBooking ||
      !bookingNeedsPayment(paymentSummaryForBooking) ||
      (paymentSummaryForBooking.kind !== "failed" && paymentSummaryForBooking.kind !== "pending")
    ) {
      return;
    }
    setPaymentResumeFlow(true);
    setActiveStep(3);
  }, [
    loadingBookings,
    wizardOpen,
    isEditingBooking,
    postSubmitFlow,
    wizardMode,
    existingTerminalBooking,
    paymentSummaryForBooking,
  ]);

  const validateGuestCountStep = (): boolean => {
    const error = guestCountValidationError({
      mode: wizardMode,
      extraGuestRequestCount,
      totalGuestCount,
      hasGuestTicketTypes: guestTicketTypes.length > 0,
    });
    if (error) {
      setSubmitError(error);
      return false;
    }
    return true;
  };

  const validateGuestDetailsStep = (): boolean => {
    const error = guestDetailsValidationError({
      mode: wizardMode,
      includeGuest,
      guestTicketTypeId,
      guestDisplayName,
      extraGuestRequestCount,
      extraGuestTicketTypeId,
      extraGuestDetails,
    });
    if (error) {
      setSubmitError(error);
      return false;
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
      if (!editingExistingBooking && !validateGuestCountStep()) return;
      if (!validateGuestDetailsStep()) return;
      setActiveStep(2);
      return;
    }
    if (activeStep === 2) {
      setActiveStep(3);
      return;
    }
    if (activeStep === 3) {
      if (!canProceedToConfirmation) {
        setSubmitError("Pay for all tickets before continuing to confirmation.");
        return;
      }
      setActiveStep(4);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  const submitAdditionalGuestRequest = async (bookingId: string) => {
    if (extraGuestRequestCount < 1 || !extraGuestTicketTypeId) return;
    const guests = extraGuestDetails.slice(0, extraGuestRequestCount);
    for (const guest of guests) {
      await submitGuestTicketRequest({
        bookingId,
        requestedGuestCount: 1,
        guestTicketTypeId: extraGuestTicketTypeId,
        guestDisplayName: guest.guestDisplayName.trim(),
        dietaryNote: guest.dietaryNote.trim() || null,
      });
    }
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

      if (isEditingBooking && existingTerminalBooking) {
        idempotencyKeyRef.current = crypto.randomUUID();
      } else if (!idempotencyKeyRef.current) {
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

      const lines = buildBookingSubmissionLines({
        memberTicketTypeId,
        includeGuest,
        guestTicketTypeId,
        guestDisplayName,
        guestDietaryNote,
      });

      const result = await submitEventBooking({
        idempotencyKey: idempotencyKeyRef.current,
        eventId: event.id,
        baseBookingId: existingTerminalBooking?.id,
        baseRevisionNumber: existingTerminalBooking?.revisionNumber,
        lines,
        bookerDietaryNote,
        sitNextToUserIds,
        accommodationRequested,
        accommodationNote: null,
      });

      if (extraGuestRequestCount > 0) {
        await submitAdditionalGuestRequest(result.bookingId);
      }

      hydratedBookingIdRef.current = result.bookingId;
      await refetchMyBookings();
      setIsEditingBooking(false);
      setPostSubmitFlow(true);
      setActiveStep(3);
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

  const handlePayAllTickets = async () => {
    setPayingAllTickets(true);
    setSubmitError(null);
    try {
      const { url } = await createEventBookingCheckoutSession({ eventId: event.id });
      window.location.assign(url);
    } catch (err: unknown) {
      const message =
        err && typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : "Could not start checkout. Please try again.";
      setSubmitError(message);
    } finally {
      setPayingAllTickets(false);
    }
  };

  const closeWizard = useCallback(() => {
    setWizardMode("full");
    setPostSubmitFlow(false);
    setPaymentResumeFlow(false);
    setIsEditingBooking(false);
    onWizardOpenChange?.(false);
  }, [onWizardOpenChange]);

  const cancelEditing = () => {
    setIsEditingBooking(false);
    setSubmitError(null);
    onWizardOpenChange?.(false);
    if (existingTerminalBooking && paymentSummaryForBooking && bookingNeedsPayment(paymentSummaryForBooking)) {
      setPaymentResumeFlow(true);
      setActiveStep(3);
    } else {
      setPaymentResumeFlow(false);
    }
  };

  const beginEditingBooking = () => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setPaymentResumeFlow(false);
    setWizardMode("full");
    setIsEditingBooking(true);
    onWizardOpenChange?.(true);
  };

  const pendingAdditionalGuestRequest = (existingTerminalBooking?.guestTicketRequests ?? []).some(
    (r) => r.status === "PENDING"
  );

  const showBookingSummary =
    Boolean(existingTerminalBooking) &&
    !isEditingBooking &&
    !postSubmitFlow &&
    !paymentResumeFlow &&
    wizardMode === "full" &&
    !wizardOpen;

  const showWizard =
    wizardOpen || isEditingBooking || postSubmitFlow || paymentResumeFlow || wizardMode === "additionalGuests";

  return {
    // mode / step
    wizardMode,
    setWizardMode,
    activeStep,
    steps,
    // form field state
    memberTicketTypeId,
    setMemberTicketTypeId,
    totalGuestCount,
    setTotalGuestCount,
    totalGuestCountInput,
    setTotalGuestCountInput,
    requestedExtraGuestCount,
    setRequestedExtraGuestCount,
    requestedExtraGuestCountInput,
    setRequestedExtraGuestCountInput,
    guestTicketTypeId,
    setGuestTicketTypeId,
    guestDisplayName,
    setGuestDisplayName,
    guestDietaryNote,
    setGuestDietaryNote,
    extraGuestTicketTypeId,
    setExtraGuestTicketTypeId,
    extraGuestDetails,
    setExtraGuestDetails,
    bookerDietaryNote,
    setBookerDietaryNote,
    sitNextToUserIds,
    setSitNextToUserIds,
    accommodationRequested,
    setAccommodationRequested,
    seatingOptions,
    submitError,
    setSubmitError,
    submitting,
    payingAllTickets,
    // computed
    includeGuest,
    extraGuestRequestCount,
    memberTicketTypes,
    guestTicketTypes,
    selectedMember,
    selectedGuest,
    canRequestAccommodation,
    existingTerminalBooking,
    existingDraft,
    editingExistingBooking,
    showExpiredDraftHoldNotice,
    paymentSummaryForBooking,
    paymentTicketRows,
    pendingGuestTicketsAwaitingApproval,
    canProceedToConfirmation,
    pendingAdditionalGuestRequest,
    showBookingSummary,
    showWizard,
    paymentResumeFlow,
    postSubmitFlow,
    isEditingBooking,
    ticketOrdersData,
    bookingPaymentAdjustments,
    loadingProfile,
    loadingBookings,
    membershipStatus,
    gate,
    idempotencyKeyRef,
    // handlers
    handleNext,
    handleBack,
    handleConfirm,
    handlePayAllTickets,
    closeWizard,
    cancelEditing,
    beginEditingBooking,
    setIsEditingBooking,
    setPaymentResumeFlow,
    setWizardModeToAdditionalGuests: () => {
      setWizardMode("additionalGuests");
      setRequestedExtraGuestCount(1);
      setRequestedExtraGuestCountInput("1");
      setExtraGuestDetails([{ ...EMPTY_GUEST_DETAIL }]);
      setActiveStep(0);
    },
  };
}
