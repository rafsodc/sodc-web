import { useCallback, useEffect, useRef, useState } from "react";
import type { GetEventByIdData, GetSectionByIdData } from "@dataconnect/generated";
import { BookingStatus } from "@dataconnect/generated";
import { useQueryClient } from "@tanstack/react-query";
import {
  createEventBookingCheckoutSession,
  submitEventBooking,
  type SubmitEventBookingResponse,
} from "../../../shared/utils/firebaseFunctions";
import { toCanonicalUuid } from "../../../shared/utils/uuid";
import { invalidateMyBookings } from "../../../shared/query/invalidation";
import {
  extractDomainErrorCode,
  reportError,
  toBookingUserFacingError,
} from "../../../shared/errors";
import { hydrateFormFromExistingBooking } from "../utils/bookingWizardHydration";
import {
  BOOKING_STEPS,
  buildBookingSubmissionLines,
  guestDetailsValidationError,
  resizeGuestDetails,
  type GuestDetailRow,
} from "./bookingWizardModel";
import { useBookingWizardData } from "./useBookingWizardData";
import { useSectionMemberSeatingSearch } from "./useSectionMemberSeatingOptions";

export { BOOKING_STEPS, EMPTY_GUEST_DETAIL } from "./bookingWizardModel";
export type { ExtraGuestDetailRow, GuestDetailFields, GuestDetailRow } from "./bookingWizardModel";

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
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [memberTicketTypeId, setMemberTicketTypeId] = useState<string | null>(null);
  const [guests, setGuests] = useState<GuestDetailRow[]>([]);
  const [guestCountInput, setGuestCountInput] = useState("0");
  const [memberDietaryNote, setMemberDietaryNote] = useState("");
  const [sitNextToUserIds, setSitNextToUserIds] = useState<string[]>([]);
  const [accommodationRequested, setAccommodationRequested] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [payingAllTickets, setPayingAllTickets] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<SubmitEventBookingResponse | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);
  const hydratedBookingVersionRef = useRef<string | null>(null);

  const {
    bookingPaymentAdjustments,
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
    paymentEligibleBooking,
    refetchMyBookings,
    showExpiredDraftHoldNotice,
    ticketOrdersData,
  } = useBookingWizardData({ section, event, postSubmitFlow: Boolean(lastSubmission) });

  const selectedMember = memberTicketTypes.find((ticket) => ticket.id === memberTicketTypeId);
  const canRequestAccommodation = membershipStatus === "REGULAR" || membershipStatus === "RESERVE";
  const {
    inputValue: seatingSearchInputValue,
    setInputValue: setSeatingSearchInputValue,
    options: seatingOptions,
    loading: seatingOptionsLoading,
  } = useSectionMemberSeatingSearch(section.id, currentUserData?.user?.id, sitNextToUserIds);

  const applyBookingSnapshot = useCallback((booking: NonNullable<typeof existingTerminalBooking>) => {
    const snapshot = hydrateFormFromExistingBooking(booking);
    setMemberTicketTypeId(snapshot.memberTicketTypeId);
    setGuests(snapshot.guests);
    setGuestCountInput(String(snapshot.guests.length));
    setMemberDietaryNote(snapshot.memberDietaryNote);
    setSitNextToUserIds(snapshot.sitNextToUserIds);
    setAccommodationRequested(snapshot.accommodationRequested);
  }, []);

  useEffect(() => {
    onHasExistingBookingChange?.(Boolean(existingTerminalBooking));
  }, [existingTerminalBooking, onHasExistingBookingChange]);

  useEffect(() => {
    const raw = existingDraft?.clientSubmissionKey;
    if (!raw || typeof raw !== "string" || !raw.trim()) return;
    try {
      idempotencyKeyRef.current = toCanonicalUuid(raw.trim());
    } catch {
      // A malformed legacy key is replaced on submit.
    }
  }, [existingDraft?.clientSubmissionKey]);

  useEffect(() => {
    if (!existingTerminalBooking) {
      hydratedBookingVersionRef.current = null;
      return;
    }
    if (isEditingBooking) return;
    const version = `${existingTerminalBooking.id}:${existingTerminalBooking.updatedAt}`;
    if (hydratedBookingVersionRef.current === version) return;
    hydratedBookingVersionRef.current = version;
    applyBookingSnapshot(existingTerminalBooking);
  }, [applyBookingSnapshot, existingTerminalBooking, isEditingBooking]);

  useEffect(() => {
    if (!memberTicketTypes.length) {
      setMemberTicketTypeId(null);
      return;
    }
    setMemberTicketTypeId((previous) =>
      previous && memberTicketTypes.some((ticket) => ticket.id === previous)
        ? previous
        : memberTicketTypes[0]!.id
    );
  }, [memberTicketTypes]);

  useEffect(() => {
    const defaultTicketTypeId = guestTicketTypes[0]?.id ?? null;
    setGuests((previous) => previous.map((guest) => ({
      ...guest,
      ticketTypeId:
        guest.ticketTypeId && guestTicketTypes.some((ticket) => ticket.id === guest.ticketTypeId)
          ? guest.ticketTypeId
          : defaultTicketTypeId,
    })));
  }, [guestTicketTypes]);

  const setGuestCount = (count: number) => {
    const normalized = Math.max(0, count);
    const removed = guests.slice(normalized);
    if (removed.some((guest) => guest.paid)) {
      setSubmitError("Paid guests cannot be removed. Refund requests will be added later.");
      setGuestCountInput(String(guests.length));
      return;
    }
    setSubmitError(null);
    setGuests((previous) => resizeGuestDetails(previous, normalized, guestTicketTypes[0]?.id ?? null));
    setGuestCountInput(String(normalized));
  };

  const updateGuest = (index: number, changes: Partial<GuestDetailRow>) => {
    const current = guests[index];
    if (
      current?.paid &&
      ((changes.ticketTypeId != null && changes.ticketTypeId !== current.ticketTypeId) ||
        (changes.guestDisplayName != null && changes.guestDisplayName !== current.guestDisplayName))
    ) {
      setSubmitError("A paid ticket cannot be transferred to another guest.");
      return;
    }
    setGuests((previous) => previous.map((guest, guestIndex) =>
      guestIndex === index ? { ...guest, ...changes } : guest
    ));
  };

  const removeGuest = (index: number) => {
    const guest = guests[index];
    if (guest?.paid) {
      setSubmitError("This guest cannot be removed because their ticket has been paid for.");
      return;
    }
    const next = guests.filter((_, guestIndex) => guestIndex !== index);
    setGuests(next);
    setGuestCountInput(String(next.length));
    setSubmitError(null);
  };

  const handleNext = () => {
    setSubmitError(null);
    if (activeStep === 0) {
      if (!memberTicketTypeId) {
        setSubmitError("Choose a ticket for yourself.");
        return;
      }
      setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      const error = guestDetailsValidationError({
        guests,
        hasGuestTicketTypes: guestTicketTypes.length > 0,
      });
      if (error) {
        setSubmitError(error);
        return;
      }
      setActiveStep(2);
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (activeStep > 0) setActiveStep((step) => step - 1);
  };

  const handleConfirm = async () => {
    if (!memberTicketTypeId || !membershipStatus || gate.ok !== true) return;
    const guestError = guestDetailsValidationError({ guests, hasGuestTicketTypes: guestTicketTypes.length > 0 });
    if (guestError) {
      setSubmitError(guestError);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!idempotencyKeyRef.current) {
        const fromDraft = existingDraft?.clientSubmissionKey?.trim();
        try {
          idempotencyKeyRef.current = fromDraft ? toCanonicalUuid(fromDraft) : crypto.randomUUID();
        } catch {
          idempotencyKeyRef.current = crypto.randomUUID();
        }
      }

      const result = await submitEventBooking({
        idempotencyKey: idempotencyKeyRef.current,
        eventId: event.id,
        baseBookingId: existingTerminalBooking?.id,
        baseRevisionNumber: existingTerminalBooking?.revisionNumber,
        lines: buildBookingSubmissionLines({
          memberTicketTypeId,
          memberDietaryNote,
          guests,
        }),
        sitNextToUserIds,
        accommodationRequested,
        accommodationNote: null,
      });

      idempotencyKeyRef.current = null;
      hydratedBookingVersionRef.current = null;
      setLastSubmission(result);
      setIsEditingBooking(false);
      setActiveStep(0);
      await Promise.all([refetchMyBookings(), invalidateMyBookings(queryClient)]);
      onBookingComplete?.();
    } catch (error: unknown) {
      reportError("booking.submit", error);
      const code = extractDomainErrorCode(error);
      if (code === "BOOKING_ALREADY_SUBMITTED") {
        setSubmitError("You already have a submitted booking for this event.");
        await refetchMyBookings();
      } else if (code === "OUTSIDE_BOOKING_WINDOW") {
        setSubmitError("The booking window is closed.");
      } else if (code === "IDEMPOTENCY_DRAFT_CONFLICT") {
        const refreshed = await refetchMyBookings();
        const draft = refreshed.data?.user?.bookings?.find((booking) => booking.status === BookingStatus.DRAFT);
        const raw = draft?.clientSubmissionKey?.trim();
        if (raw) {
          try {
            idempotencyKeyRef.current = toCanonicalUuid(raw);
            setSubmitError("Your in-progress booking was found. Review it and submit again.");
          } catch {
            setSubmitError("Your in-progress booking could not be resumed. Please contact support.");
          }
        } else {
          setSubmitError("Your in-progress booking could not be resumed. Please contact support.");
        }
      } else {
        setSubmitError(toBookingUserFacingError(error, "booking-submit").message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayAllTickets = async () => {
    setPayingAllTickets(true);
    setSubmitError(null);
    try {
      const { url, confirmed } = await createEventBookingCheckoutSession({ eventId: event.id });
      if (url) window.location.assign(url);
      else if (confirmed) await Promise.all([refetchMyBookings(), invalidateMyBookings(queryClient)]);
      else throw new Error("Checkout completed without a payment URL or booking confirmation");
    } catch (error: unknown) {
      reportError("booking.checkout-start", error);
      setSubmitError(toBookingUserFacingError(error, "checkout-start").message);
    } finally {
      setPayingAllTickets(false);
    }
  };

  const beginEditingBooking = () => {
    if (!existingTerminalBooking) return;
    applyBookingSnapshot(existingTerminalBooking);
    idempotencyKeyRef.current = crypto.randomUUID();
    setLastSubmission(null);
    setSubmitError(null);
    setActiveStep(0);
    setIsEditingBooking(true);
    onWizardOpenChange?.(true);
  };

  const cancelEditing = () => {
    if (existingTerminalBooking) applyBookingSnapshot(existingTerminalBooking);
    setIsEditingBooking(false);
    setSubmitError(null);
    setActiveStep(0);
    onWizardOpenChange?.(false);
  };

  const closeWizard = () => onWizardOpenChange?.(false);
  const showBookingSummary = Boolean(existingTerminalBooking) && !isEditingBooking;
  const showWizard = isEditingBooking || (wizardOpen && !showBookingSummary && !lastSubmission);

  return {
    activeStep,
    steps: BOOKING_STEPS,
    memberTicketTypeId,
    setMemberTicketTypeId,
    guests,
    guestCountInput,
    setGuestCountInput,
    setGuestCount,
    updateGuest,
    removeGuest,
    memberDietaryNote,
    setMemberDietaryNote,
    sitNextToUserIds,
    setSitNextToUserIds,
    accommodationRequested,
    setAccommodationRequested,
    seatingOptions,
    seatingSearchInputValue,
    setSeatingSearchInputValue,
    seatingOptionsLoading,
    submitError,
    setSubmitError,
    submitting,
    payingAllTickets,
    memberTicketTypes,
    guestTicketTypes,
    selectedMember,
    canRequestAccommodation,
    existingTerminalBooking,
    existingDraft,
    editingExistingBooking: isEditingBooking && Boolean(existingTerminalBooking),
    showExpiredDraftHoldNotice,
    paymentSummaryForBooking,
    paymentTicketRows,
    paymentEligibleBooking,
    showBookingSummary,
    showWizard,
    lastSubmission,
    ticketOrdersData,
    bookingPaymentAdjustments,
    loadingProfile,
    loadingBookings,
    membershipStatus,
    gate,
    handleNext,
    handleBack,
    handleConfirm,
    handlePayAllTickets,
    closeWizard,
    cancelEditing,
    beginEditingBooking,
  };
}
