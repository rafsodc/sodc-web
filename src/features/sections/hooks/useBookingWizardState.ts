import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { GetEventByIdData, GetSectionByIdData } from "@dataconnect/generated";
import { BookingStatus } from "@dataconnect/generated";
import { useQueryClient } from "@tanstack/react-query";
import {
  createEventBookingCheckoutSession,
  submitEventBooking,
  type SubmitEventBookingResponse,
} from "../../../shared/utils/firebaseFunctions";
import { idsEqual, toCanonicalUuid } from "../../../shared/utils/uuid";
import { refreshMyBookingsFromServer } from "../../../shared/query/invalidation";
import {
  extractDomainErrorCode,
  reportError,
  toBookingUserFacingError,
} from "../../../shared/errors";
import { bookingFormMatchesSavedSnapshot, hydrateFormFromExistingBooking } from "../utils/bookingWizardHydration";
import {
  BOOKING_STEPS,
  buildBookingSubmissionLines,
  guestDetailsValidationError,
  resizeGuestDetails,
  type GuestDetailRow,
} from "./bookingWizardModel";
import { useBookingWizardData } from "./useBookingWizardData";
import { useSectionMemberSeatingSearch } from "./useSectionMemberSeatingOptions";
import { useDraftUnloadWarning, useSessionDraft } from "../../../shared/hooks/useSessionDraft";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";
import { captureSession, isPrivateSessionSuspended, isSessionCurrent, type SessionToken } from "../../../shared/appShell/sessionLifecycle";

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

interface BookingFormFields {
  memberTicketTypeId: string | null;
  guests: GuestDetailRow[];
  guestCountInput: string;
  memberDietaryNote: string;
  sitNextToUserIds: string[];
  accommodationRequested: boolean;
}
interface BookingFormDraft extends BookingFormFields {
  activeStep: number;
  isEditingBooking: boolean;
  idempotencyKey: string | null;
  submissionBase: { baseBookingId?: string; baseRevisionNumber?: number } | null;
  editingBase: { baseBookingId?: string; baseRevisionNumber?: number } | null;
  hydratedVersion: string | null;
  baseline: BookingFormFields;
}
function formFields(draft: BookingFormFields): BookingFormFields {
  return { memberTicketTypeId: draft.memberTicketTypeId, guests: draft.guests, guestCountInput: draft.guestCountInput,
    memberDietaryNote: draft.memberDietaryNote, sitNextToUserIds: draft.sitNextToUserIds,
    accommodationRequested: draft.accommodationRequested };
}
function emptyBookingDraft(): BookingFormDraft {
  const baseline: BookingFormFields = { memberTicketTypeId: null, guests: [], guestCountInput: "0",
    memberDietaryNote: "", sitNextToUserIds: [], accommodationRequested: false };
  return { ...baseline, activeStep: 0, isEditingBooking: false, idempotencyKey: null,
    submissionBase: null, editingBase: null, hydratedVersion: null, baseline };
}
function hasUnsavedForm(draft: BookingFormDraft): boolean {
  return JSON.stringify(formFields(draft)) !== JSON.stringify(formFields(draft.baseline));
}
function sessionMatches(left: SessionToken, right: SessionToken): boolean {
  return left.lifecycle === right.lifecycle && left.uid === right.uid && left.generation === right.generation;
}
const emptyTransient = () => ({ submitError: null as string | null, submitting: false, payingAllTickets: false,
  lastSubmission: null as SubmitEventBookingResponse | null });

export function useBookingWizardState({
  section,
  event,
  wizardOpen,
  onWizardOpenChange,
  onBookingComplete,
  onHasExistingBookingChange,
}: UseBookingWizardStateProps) {
  const queryClient = useQueryClient();
  const resourceKey = `member-booking:${section.id}:${event.id}`;
  const { lifecycle, uid, generation } = captureSession();
  const session = useMemo(() => ({ lifecycle, uid, generation }), [lifecycle, uid, generation]);
  const [draft, setDraft, discardDraft] = useSessionDraft(resourceKey, emptyBookingDraft);
  const { activeStep, memberTicketTypeId, guests, guestCountInput, memberDietaryNote,
    sitNextToUserIds, accommodationRequested, isEditingBooking } = draft;
  const dirty = hasUnsavedForm(draft);
  useDraftUnloadWarning(dirty || draft.submissionBase !== null);
  const requestGuard = useLatestRequestGuard();
  const submittingAttempt = useRef<{ resourceKey: string; session: SessionToken; idempotencyKey: string | null } | null>(null);
  useLayoutEffect(() => () => {
    requestGuard.invalidate();
    submittingAttempt.current = null;
  }, [resourceKey, session, requestGuard]);
  const operationCurrent = (request: number) => requestGuard.isCurrent(request) &&
    isSessionCurrent(session) && !isPrivateSessionSuspended(session);
  const [transient, setTransient] = useState(() => ({ key: resourceKey, session, value: emptyTransient() }));
  const transientMatches = transient.key === resourceKey && sessionMatches(transient.session, session);
  const currentTransient = transientMatches ? transient.value : emptyTransient();
  // A return visit must not revive an abandoned loading/error state.
  if (!transientMatches) setTransient({ key: resourceKey, session, value: emptyTransient() });
  const { submitError, submitting, payingAllTickets, lastSubmission } = currentTransient;
  const setters = useMemo(() => {
    const field = <K extends keyof BookingFormDraft,>(name: K) => (action: SetStateAction<BookingFormDraft[K]>) => {
      setDraft(previous => ({ ...previous, [name]: typeof action === "function"
        ? (action as (value: BookingFormDraft[K]) => BookingFormDraft[K])(previous[name]) : action }));
    };
    const local = <K extends keyof ReturnType<typeof emptyTransient>,>(name: K) => (value: ReturnType<typeof emptyTransient>[K]) => {
      if (!isSessionCurrent(session) || isPrivateSessionSuspended(session)) return;
      setTransient(previous => ({ key: resourceKey, session, value: {
        ...(previous.key === resourceKey && sessionMatches(previous.session, session) ? previous.value : emptyTransient()), [name]: value,
      } }));
    };
    return { setActiveStep: field("activeStep"), setMemberTicketTypeId: field("memberTicketTypeId"),
      setGuests: field("guests"), setGuestCountInput: field("guestCountInput"), setMemberDietaryNote: field("memberDietaryNote"),
      setSitNextToUserIds: field("sitNextToUserIds"), setAccommodationRequested: field("accommodationRequested"),
      setSubmitError: local("submitError"), setSubmitting: local("submitting"), setPayingAllTickets: local("payingAllTickets"),
      setLastSubmission: local("lastSubmission") };
  }, [setDraft, resourceKey, session]);
  const { setActiveStep, setMemberTicketTypeId, setGuests, setGuestCountInput, setMemberDietaryNote,
    setSitNextToUserIds, setAccommodationRequested, setSubmitError, setSubmitting, setPayingAllTickets, setLastSubmission } = setters;

  const {
    bookingTicketOrders,
    bookingRevisions = [],
    bookingsError,
    bookingsQueryError,
    bookingPaymentAdjustments,
    currentUserData,
    existingDraft,
    existingTerminalBooking,
    gate,
    guestTicketTypes,
    isAdmin,
    loadingBookings,
    refreshingBookings = false,
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

  const savedRetainedBooking = draft.submissionBase && draft.idempotencyKey &&
    !loadingBookings && !refreshingBookings && !bookingsError
    ? bookingRevisions.find(booking =>
      (booking.status === BookingStatus.SUBMITTED || booking.status === BookingStatus.CONFIRMED) &&
      idsEqual(booking.clientSubmissionKey, draft.idempotencyKey))
    : undefined;
  const savedRetainedSubmission = Boolean(savedRetainedBooking);
  const savedSubmissionSnapshot = useMemo(() => savedRetainedBooking
    ? hydrateFormFromExistingBooking(savedRetainedBooking, bookingTicketOrders) : null,
  [savedRetainedBooking, bookingTicketOrders]);
  const submittedFormUnchanged = savedSubmissionSnapshot !== null &&
    bookingFormMatchesSavedSnapshot(draft, savedSubmissionSnapshot);
  const checkingRetainedSubmission = draft.submissionBase !== null && refreshingBookings;
  const savedWithNewEditsMessage = "Your earlier save completed, but these newer edits have not been saved. Cancel these edits to review the saved booking, then choose Edit booking to make another change.";

  useEffect(() => {
    if (!savedRetainedSubmission) return;
    // A server read can observe the commit before its callable response arrives.
    // Retire that response so it cannot later reset a newly opened edit.
    if (submittingAttempt.current?.idempotencyKey === draft.idempotencyKey) {
      requestGuard.invalidate();
      submittingAttempt.current = null;
      setSubmitting(false);
    }
    if (!submittedFormUnchanged) {
      // Keep a new booking's newer edits visible too, with a real Cancel action.
      setDraft(previous => previous.idempotencyKey === draft.idempotencyKey && previous.submissionBase &&
        !previous.isEditingBooking ? { ...previous, isEditingBooking: true } : previous);
      setSubmitError(savedWithNewEditsMessage);
      return;
    }
    const retainedKey = draft.idempotencyKey;
    const snapshot = existingTerminalBooking
      ? hydrateFormFromExistingBooking(existingTerminalBooking, bookingTicketOrders)
      : emptyBookingDraft().baseline;
    const values = { ...snapshot, guestCountInput: String(snapshot.guests.length) };
    setDraft(previous => previous.idempotencyKey !== retainedKey || !previous.submissionBase ||
      !savedSubmissionSnapshot || !bookingFormMatchesSavedSnapshot(previous, savedSubmissionSnapshot) ? previous : {
        ...emptyBookingDraft(), ...values, baseline: values,
      });
    setLastSubmission(null);
    setSubmitError(null);
  }, [savedRetainedSubmission, submittedFormUnchanged, savedSubmissionSnapshot, draft.idempotencyKey, existingTerminalBooking,
    bookingTicketOrders, requestGuard, setDraft, setLastSubmission, setSubmitError, setSubmitting]);

  const resetDraft = () => {
    discardDraft();
    setDraft(() => {
      const empty = emptyBookingDraft();
      const memberTicketTypeId = memberTicketTypes[0]?.id ?? null;
      return { ...empty, memberTicketTypeId, baseline: { ...empty.baseline, memberTicketTypeId } };
    });
  };

  const selectedMember = memberTicketTypes.find((ticket) => ticket.id === memberTicketTypeId);
  const canRequestAccommodation = membershipStatus === "REGULAR" || membershipStatus === "RESERVE";
  const {
    inputValue: seatingSearchInputValue,
    setInputValue: setSeatingSearchInputValue,
    options: seatingOptions,
    loading: seatingOptionsLoading,
  } = useSectionMemberSeatingSearch(section.id, currentUserData?.user?.id, sitNextToUserIds);

  useEffect(() => {
    if (bookingsError) reportError("booking.load", bookingsQueryError);
  }, [bookingsError, bookingsQueryError]);

  const applyBookingSnapshot = useCallback((booking: NonNullable<typeof existingTerminalBooking>, editing = false) => {
    const snapshot = hydrateFormFromExistingBooking(booking, bookingTicketOrders);
    const values = { ...snapshot, guestCountInput: String(snapshot.guests.length) };
    setDraft(previous => ({ ...previous, ...values, baseline: values, isEditingBooking: editing }));
  }, [bookingTicketOrders, setDraft]);

  useEffect(() => {
    onHasExistingBookingChange?.(Boolean(existingTerminalBooking));
  }, [existingTerminalBooking, onHasExistingBookingChange]);

  useEffect(() => {
    const raw = existingDraft?.clientSubmissionKey;
    if (!raw || typeof raw !== "string" || !raw.trim()) return;
    try {
      const key = toCanonicalUuid(raw.trim());
      setDraft(previous => previous.idempotencyKey ? previous : { ...previous, idempotencyKey: key });
    } catch {
      // A malformed legacy key is replaced on submit.
    }
  }, [existingDraft?.clientSubmissionKey, setDraft]);

  useEffect(() => {
    if (!existingTerminalBooking || isEditingBooking || dirty || draft.submissionBase) return;
    const orderVersion = bookingTicketOrders.map((order) => `${order.id}:${order.status}`).sort().join(",");
    const version = `${existingTerminalBooking.id}:${existingTerminalBooking.updatedAt}:${orderVersion}`;
    if (draft.hydratedVersion === version) return;
    const snapshot = hydrateFormFromExistingBooking(existingTerminalBooking, bookingTicketOrders);
    const values = { ...snapshot, guestCountInput: String(snapshot.guests.length) };
    setDraft(previous => ({ ...previous, ...values, baseline: values, hydratedVersion: version }));
  }, [bookingTicketOrders, existingTerminalBooking, isEditingBooking, dirty, draft.submissionBase, draft.hydratedVersion, setDraft]);

  useEffect(() => {
    if (loadingProfile || loadingBookings || gate.ok !== true) return;
    setDraft(previous => {
      const next = { ...previous, memberTicketTypeId: previous.memberTicketTypeId &&
        memberTicketTypes.some((ticket) => ticket.id === previous.memberTicketTypeId)
        ? previous.memberTicketTypeId : memberTicketTypes[0]?.id ?? null };
      return { ...next, baseline: hasUnsavedForm(previous) ? previous.baseline : formFields(next) };
    });
  }, [memberTicketTypes, loadingProfile, loadingBookings, gate.ok, setDraft]);

  useEffect(() => {
    if (loadingProfile || loadingBookings || gate.ok !== true) return;
    setDraft(previous => {
      const next = { ...previous, guests: previous.guests.map((guest) => ({ ...guest,
        ticketTypeId: guest.ticketTypeId && guestTicketTypes.some((ticket) => ticket.id === guest.ticketTypeId)
          ? guest.ticketTypeId : guestTicketTypes[0]?.id ?? null,
      })) };
      return { ...next, baseline: hasUnsavedForm(previous) ? previous.baseline : formFields(next) };
    });
  }, [guestTicketTypes, loadingProfile, loadingBookings, gate.ok, setDraft]);

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

    const pending = submittingAttempt.current;
    if (savedRetainedSubmission) {
      setSubmitError(savedWithNewEditsMessage);
      return;
    }
    if (submitting || checkingRetainedSubmission || (pending?.resourceKey === resourceKey && sessionMatches(pending.session, session))) return;
    const request = requestGuard.start();
    if (!operationCurrent(request)) return;
    const attempt: NonNullable<typeof submittingAttempt.current> = { resourceKey, session, idempotencyKey: null };
    submittingAttempt.current = attempt;
    setSubmitting(true);
    setSubmitError(null);
    let idempotencyKey = draft.idempotencyKey;
    if (!idempotencyKey) {
      const fromDraft = existingDraft?.clientSubmissionKey?.trim();
      try { idempotencyKey = fromDraft ? toCanonicalUuid(fromDraft) : crypto.randomUUID(); }
      catch { idempotencyKey = crypto.randomUUID(); }
    }
    const submissionBase = draft.submissionBase ?? draft.editingBase ?? { baseBookingId: existingTerminalBooking?.id,
      baseRevisionNumber: existingTerminalBooking?.revisionNumber };
    attempt.idempotencyKey = idempotencyKey;
    setDraft(previous => ({ ...previous, idempotencyKey, submissionBase }));
    try {
      const result = await submitEventBooking({
        idempotencyKey,
        eventId: event.id,
        ...submissionBase,
        lines: buildBookingSubmissionLines({
          memberTicketTypeId,
          memberDietaryNote,
          guests,
        }),
        sitNextToUserIds,
        accommodationRequested,
        accommodationNote: null,
      });

      if (!operationCurrent(request)) return;
      resetDraft();
      setLastSubmission(result);

      try {
        await refreshMyBookingsFromServer(queryClient, event.id);
      } catch (refreshError) {
        if (!operationCurrent(request)) return;
        reportError("booking.refresh-after-submit", refreshError);
        setSubmitError("Your booking was saved, but the latest details could not be loaded. Please try refreshing.");
      }
      if (operationCurrent(request)) onBookingComplete?.();
    } catch (error: unknown) {
      if (!operationCurrent(request)) return;
      reportError("booking.submit", error);
      const code = extractDomainErrorCode(error);
      if (code === "BOOKING_ALREADY_SUBMITTED") {
        setSubmitError("You already have a submitted booking for this event.");
        await refreshMyBookingsFromServer(queryClient, event.id);
      } else if (code === "OUTSIDE_BOOKING_WINDOW") {
        setSubmitError("The booking window is closed.");
      } else if (code === "IDEMPOTENCY_KEY_REUSE_CONFLICT") {
        // Reconciliation is read-only. Never rotate the key and replay changed
        // details automatically when the original request may have committed.
        setSubmitError(toBookingUserFacingError(error, "booking-submit").message);
        try {
          await refreshMyBookingsFromServer(queryClient, event.id);
        } catch (refreshError) {
          if (!operationCurrent(request)) return;
          reportError("booking.refresh-after-conflict", refreshError);
          setSubmitError("An earlier save has already been processed, but the latest booking could not be loaded. Refresh and review it before making another change.");
        }
      } else if (code === "IDEMPOTENCY_DRAFT_CONFLICT") {
        const refreshed = await refreshMyBookingsFromServer(queryClient, event.id);
        if (!operationCurrent(request)) return;
        const serverDraft = refreshed.user?.bookings?.find((booking) => booking.status === BookingStatus.DRAFT);
        const raw = serverDraft?.clientSubmissionKey?.trim();
        if (raw) {
          try {
            const recoveredKey = toCanonicalUuid(raw);
            setDraft(previous => ({ ...previous, idempotencyKey: recoveredKey }));
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
      if (submittingAttempt.current === attempt) submittingAttempt.current = null;
      if (operationCurrent(request)) setSubmitting(false);
    }
  };

  const handlePayAllTickets = async () => {
    if (payingAllTickets) return;
    const request = requestGuard.start();
    if (!operationCurrent(request)) return;
    setPayingAllTickets(true);
    setSubmitError(null);
    try {
      const { url, confirmed } = await createEventBookingCheckoutSession({ eventId: event.id });
      if (!operationCurrent(request)) return;
      if (url) window.location.assign(url);
      else if (confirmed) {
        try {
          await refreshMyBookingsFromServer(queryClient, event.id);
        } catch (refreshError) {
          if (!operationCurrent(request)) return;
          reportError("booking.refresh-after-checkout", refreshError);
          setSubmitError("Payment completed, but the latest booking details could not be loaded. Please try refreshing.");
        }
      }
      else throw new Error("Checkout completed without a payment URL or booking confirmation");
    } catch (error: unknown) {
      if (!operationCurrent(request)) return;
      reportError("booking.checkout-start", error);
      setSubmitError(toBookingUserFacingError(error, "checkout-start").message);
    } finally {
      if (operationCurrent(request)) setPayingAllTickets(false);
    }
  };

  const beginEditingBooking = () => {
    if (!existingTerminalBooking) return;
    applyBookingSnapshot(existingTerminalBooking, true);
    setDraft(previous => ({ ...previous, activeStep: 0, idempotencyKey: crypto.randomUUID(), submissionBase: null,
        editingBase: { baseBookingId: existingTerminalBooking.id, baseRevisionNumber: existingTerminalBooking.revisionNumber } }));
    setLastSubmission(null);
    setSubmitError(null);
    onWizardOpenChange?.(true);
  };

  const cancelEditing = () => {
    if (submitting) return;
    resetDraft();
    setSubmitError(null);
    onWizardOpenChange?.(false);
  };

  const closeWizard = () => {
    if (submitting) return;
    resetDraft();
    setSubmitError(null);
    onWizardOpenChange?.(false);
  };
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
    submitting: submitting || checkingRetainedSubmission,
    payingAllTickets,
    memberTicketTypes,
    guestTicketTypes,
    selectedMember,
    isAdmin,
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
    bookingsError,
    bookingsQueryError,
    loadingProfile,
    loadingBookings,
    refetchMyBookings,
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
