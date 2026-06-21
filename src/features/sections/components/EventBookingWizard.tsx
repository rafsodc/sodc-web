import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
import { BookingStatus, GuestTicketRequestStatus, TicketAudience } from "@dataconnect/generated";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import { formatGbpMajorAmount } from "../../../shared/utils/currencyDisplay";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import {
  createEventBookingCheckoutSession,
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
  bookingNeedsPayment,
  bookingTicketPaymentChipColor,
  buildBookingTicketRowsWithPaymentStatus,
  guestTicketRequestsForBookingEdit,
  guestTicketRequestCount,
  hasPendingGuestTicketsAwaitingApproval,
  hasExpiredDraftHold,
  isBookingPaymentComplete,
  summarizeEventBookingPayment,
} from "../utils/eventBookingStatusSummary";
import EventBookingStatusSummary from "./EventBookingStatusSummary";

type EventDetail = NonNullable<GetEventByIdData["event"]>;
type SectionDetail = NonNullable<GetSectionByIdData["section"]>;

const BOOKING_STEPS = [
  "Your ticket",
  "Guest details",
  "Review",
  "Payment",
  "Confirmation",
] as const;

const ADDITIONAL_GUEST_STEPS = ["Extra guests", "Guest details", "Review"] as const;

type WizardMode = "full" | "additionalGuests";

type GuestDetailFields = {
  guestDisplayName: string;
  dietaryNote: string;
};

type ExtraGuestDetailRow = GuestDetailFields & {
  guestRequestStatus?: GuestTicketRequestStatus | string | null;
};

const EMPTY_GUEST_DETAIL: GuestDetailFields = { guestDisplayName: "", dietaryNote: "" };

function extractCallableErrorCode(err: unknown): string | undefined {
  const e = err as {
    code?: string;
    message?: string;
    details?: { code?: string };
    customData?: { code?: string };
  };
  return e?.details?.code ?? e?.customData?.code;
}

function parseOptionalNonNegativeInt(raw: string): number | null {
  if (raw === "") {
    return 0;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10);
}

function parseOptionalPositiveInt(raw: string): number | null {
  if (raw === "") {
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : null;
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
  const [seatingOptions, setSeatingOptions] = useState<Array<{ id: string; label: string }>>([]);
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
    setExtraGuestDetails((prev) => {
      if (wizardMode === "additionalGuests") {
        const next = prev.slice(0, extraGuestRequestCount);
        while (next.length < extraGuestRequestCount) {
          next.push({ ...EMPTY_GUEST_DETAIL });
        }
        return next;
      }
      if (prev.length === extraGuestRequestCount) {
        return prev;
      }
      const next = [...prev];
      while (next.length < extraGuestRequestCount) {
        next.push({ ...EMPTY_GUEST_DETAIL });
      }
      while (next.length > extraGuestRequestCount) {
        next.pop();
      }
      return next;
    });
  }, [extraGuestRequestCount, wizardMode]);

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
      .filter(
        (b) =>
          (b.status === BookingStatus.SUBMITTED || b.status === BookingStatus.CONFIRMED) &&
          b.supersededAt == null
      )
      .reduce<typeof list[number] | null>((latest, booking) => {
        if (!latest) return booking;
        return booking.revisionNumber > latest.revisionNumber ? booking : latest;
      }, null);
  }, [myBookingsData]);

  const editingExistingBooking = isEditingBooking && Boolean(existingTerminalBooking);
  const steps = wizardMode === "additionalGuests" ? ADDITIONAL_GUEST_STEPS : BOOKING_STEPS;

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
      if (!postSubmitFlow) {
        setIsEditingBooking(false);
      }
      return;
    }
    if (hydratedBookingIdRef.current === booking.id) {
      return;
    }
    hydratedBookingIdRef.current = booking.id;
    if (postSubmitFlow) {
      return;
    }
    setIsEditingBooking(false);
    const memberLine = (booking.lines ?? []).find((line) => line.ticketType?.audience === TicketAudience.MEMBER);
    const guestLine = (booking.lines ?? []).find((line) => line.ticketType?.audience === TicketAudience.GUEST);
    const editableGuestRequests = guestTicketRequestsForBookingEdit(booking.guestTicketRequests);
    setMemberTicketTypeId(memberLine?.ticketType?.id ?? null);
    const guestLines = editableGuestRequests.reduce(
      (sum, request) => sum + guestTicketRequestCount(request),
      guestLine ? 1 : 0
    );
    setTotalGuestCount(guestLines);
    setTotalGuestCountInput(String(guestLines));
    setGuestTicketTypeId(guestLine?.ticketType?.id ?? null);
    setGuestDisplayName(guestLine?.guestDisplayName ?? "");
    setGuestDietaryNote(guestLine?.dietaryNote ?? "");
    const includedGuestCount = guestLine ? 1 : 0;
    const extraCount = Math.max(0, guestLines - includedGuestCount);
    const flattenedExtraGuests: ExtraGuestDetailRow[] = [];
    for (const request of editableGuestRequests) {
      for (let i = 0; i < guestTicketRequestCount(request); i++) {
        flattenedExtraGuests.push({
          guestDisplayName: request.guestDisplayName ?? "",
          dietaryNote: request.dietaryNote ?? "",
          guestRequestStatus: request.status,
        });
      }
    }
    setExtraGuestDetails(
      Array.from({ length: extraCount }, (_, index) => flattenedExtraGuests[index] ?? { ...EMPTY_GUEST_DETAIL })
    );
    const firstGuestRequest = editableGuestRequests[0];
    if (firstGuestRequest?.guestTicketType?.id) {
      setExtraGuestTicketTypeId(firstGuestRequest.guestTicketType.id);
    }
    setBookerDietaryNote(booking.bookerDietaryNote ?? "");
    setSitNextToUserIds(booking.sitNextToUserIds ?? []);
    setAccommodationRequested(booking.accommodationRequested === true);
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
    setTotalGuestCountInput("0");
    setRequestedExtraGuestCount(1);
    setRequestedExtraGuestCountInput("1");
    setGuestTicketTypeId(guestTicketTypes[0]?.id ?? null);
    setGuestDisplayName("");
    setGuestDietaryNote("");
    setExtraGuestDetails([]);
    setBookerDietaryNote("");
    setSitNextToUserIds([]);
    setAccommodationRequested(false);
    setSubmitError(null);
    setPostSubmitFlow(false);
    if (!existingDraft?.clientSubmissionKey?.trim()) {
      idempotencyKeyRef.current = null;
    }
  }, [existingDraft?.clientSubmissionKey, guestTicketTypes]);

  const closeWizard = useCallback(() => {
    setWizardMode("full");
    setPostSubmitFlow(false);
    setPaymentResumeFlow(false);
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

  const paymentTicketRows = useMemo(() => {
    if (!existingTerminalBooking) return [];
    return buildBookingTicketRowsWithPaymentStatus({
      booking: existingTerminalBooking,
      eventId: event.id,
      ticketOrders: ticketOrdersData?.user?.ticketOrders ?? [],
    });
  }, [existingTerminalBooking, event.id, ticketOrdersData]);

  const pendingGuestTicketsAwaitingApproval = useMemo(() => {
    if (!existingTerminalBooking) return false;
    return hasPendingGuestTicketsAwaitingApproval(existingTerminalBooking);
  }, [existingTerminalBooking]);

  const canProceedToConfirmation =
    paymentSummaryForBooking != null && isBookingPaymentComplete(paymentSummaryForBooking);

  useEffect(() => {
    if (wizardMode !== "full" || activeStep !== 4 || canProceedToConfirmation) {
      return;
    }
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
    existingTerminalBooking?.id,
    paymentSummaryForBooking?.kind,
  ]);

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
    if (wizardMode === "full" && includeGuest) {
      if (!guestTicketTypeId) {
        setSubmitError("Choose a guest ticket type.");
        return false;
      }
      if (!guestDisplayName.trim()) {
        setSubmitError("Enter a name for your guest.");
        return false;
      }
    }
    if (extraGuestRequestCount > 0) {
      if (!extraGuestTicketTypeId) {
        setSubmitError(
          wizardMode === "additionalGuests"
            ? "Choose a guest ticket type."
            : "Choose a ticket type for additional guests."
        );
        return false;
      }
      for (let index = 0; index < extraGuestRequestCount; index++) {
        if (!extraGuestDetails[index]?.guestDisplayName.trim()) {
          setSubmitError(
            extraGuestRequestCount === 1
              ? "Enter a name for the additional guest."
              : `Enter a name for additional guest ${index + 1}.`
          );
          return false;
        }
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
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
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
          dietaryNote: guestDietaryNote.trim() || null,
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

  const showBookingSummary =
    Boolean(existingTerminalBooking) &&
    !isEditingBooking &&
    !postSubmitFlow &&
    !paymentResumeFlow &&
    wizardMode === "full" &&
    !wizardOpen;

  const showWizard =
    wizardOpen ||
    isEditingBooking ||
    postSubmitFlow ||
    paymentResumeFlow ||
    wizardMode === "additionalGuests";

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
              idempotencyKeyRef.current = crypto.randomUUID();
              setPaymentResumeFlow(false);
              setWizardMode("full");
              setIsEditingBooking(true);
              setActiveStep(0);
              onWizardOpenChange?.(true);
            }}
            onPayNow={() => void handlePayAllTickets()}
            payingTicketTypeId={payingAllTickets ? "all" : null}
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
                setRequestedExtraGuestCountInput("1");
                setExtraGuestDetails([{ ...EMPTY_GUEST_DETAIL }]);
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
                : postSubmitFlow || paymentResumeFlow
                  ? "Complete your booking"
                  : "Book this event"}
          </Typography>
          {editingExistingBooking && existingTerminalBooking ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Editing your {getBookingStatusLabel(existingTerminalBooking.status).toLowerCase()} booking. Saving
              will update your booking details.
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
                  value={requestedExtraGuestCountInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!/^\d*$/.test(raw)) {
                      return;
                    }
                    setRequestedExtraGuestCountInput(raw);
                    const parsed = parseOptionalPositiveInt(raw);
                    if (parsed !== null) {
                      setRequestedExtraGuestCount(parsed);
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseOptionalPositiveInt(requestedExtraGuestCountInput);
                    if (parsed === null) {
                      setRequestedExtraGuestCountInput("1");
                      setRequestedExtraGuestCount(1);
                    }
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
                            {formatGbpMajorAmount(tt.price)}
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
                {!canRequestAccommodation ? (
                  <Typography variant="caption" color="text.secondary">
                    Accommodation requests are only available for{" "}
                    {getMembershipStatusLabel("REGULAR")} or {getMembershipStatusLabel("RESERVE")} members.
                  </Typography>
                ) : null}
              </FormControl>
            ) : null}

            {(wizardMode === "full" && activeStep === 1) || (wizardMode === "additionalGuests" && activeStep === 1) ? (
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
                          {formatEventGuestPolicy(event.maxGuestsWithoutModeratorApproval)}
                        </Typography>
                        <TextField
                          label="How many guest tickets in total?"
                          type="number"
                          size="small"
                          inputProps={{ min: 0, step: 1 }}
                          value={totalGuestCountInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!(/^\d*$/).test(raw)) {
                              return;
                            }
                            setTotalGuestCountInput(raw);
                            const parsed = parseOptionalNonNegativeInt(raw);
                            if (parsed !== null) {
                              setTotalGuestCount(parsed);
                            }
                          }}
                          onBlur={() => {
                            if (totalGuestCountInput === "") {
                              setTotalGuestCountInput("0");
                              setTotalGuestCount(0);
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
                        onChange={(_, v) => setGuestTicketTypeId(v || null)}
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
                      onChange={(e) => setGuestDisplayName(e.target.value)}
                      helperText="Shown on the guest ticket"
                    />
                    <TextField
                      label="Dietary requirements (optional)"
                      fullWidth
                      size="small"
                      value={guestDietaryNote}
                      onChange={(e) => setGuestDietaryNote(e.target.value)}
                      sx={{ mt: 1.5 }}
                    />
                  </Box>
                ) : null}
                {(wizardMode === "additionalGuests" || extraGuestRequestCount > 0) ? (
                  <Box sx={{ pl: 1, borderLeft: 2, borderColor: "divider" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {wizardMode === "additionalGuests"
                        ? "Guest request details"
                        : "Additional guests (organiser review)"}
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
                              setExtraGuestDetails((prev) => {
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
                              setExtraGuestDetails((prev) => {
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
            ) : null}

            {(wizardMode === "full" && activeStep === 2) || (wizardMode === "additionalGuests" && activeStep === 2) ? (
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
                      {selectedMember?.price != null ? ` · ${formatGbpMajorAmount(selectedMember.price)}` : ""}
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
                    <Typography component="dt" variant="body2">
                      Guest tickets requested
                    </Typography>
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
            ) : null}

            {wizardMode === "full" && activeStep === 3 && existingTerminalBooking && paymentSummaryForBooking ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Pay for all tickets in one checkout to secure your place. You can also finish later and return from
                  your booking summary.
                </Typography>
                {paymentTicketRows.length > 0 ? (
                  <Table size="small" sx={{ mb: 2 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Ticket</TableCell>
                        <TableCell>Guest</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Payment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentTicketRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {row.ticketTitle}
                            {row.source === "approved_guest_request" ? (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                                (approved extra guest)
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>{row.guestName ?? "—"}</TableCell>
                          <TableCell>{formatGbpMajorAmount(row.price)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={row.paymentStatusLabel}
                              color={bookingTicketPaymentChipColor(row.paymentStatus)}
                              variant={row.paymentStatus === "awaiting_approval" ? "outlined" : "filled"}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
                {!canProceedToConfirmation ? (
                  <Button
                    variant="contained"
                    disabled={payingAllTickets}
                    onClick={() => void handlePayAllTickets()}
                    sx={{ mt: 1, backgroundColor: colors.callToAction }}
                  >
                    {payingAllTickets ? "Starting checkout…" : "Pay for all tickets"}
                  </Button>
                ) : pendingGuestTicketsAwaitingApproval ? (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    All tickets due now are paid. When your additional guest request is approved, return here to pay for
                    their ticket.
                  </Alert>
                ) : (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    Payment complete. Continue to confirmation when you are ready.
                  </Alert>
                )}
              </Box>
            ) : null}

            {wizardMode === "full" && activeStep === 4 ? (
              <Alert severity="success">
                Your booking is confirmed. Guest-request updates will appear in your booking summary.
              </Alert>
            ) : null}
          </Paper>

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Button onClick={handleBack} disabled={activeStep === 0 || submitting}>
              Back
            </Button>
            <Box sx={{ display: "flex", gap: 1 }}>
              {activeStep < steps.length - 1 &&
              !(wizardMode === "full" && activeStep === 2) &&
              !(wizardMode === "full" && activeStep === 3 && !canProceedToConfirmation) ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={submitting || payingAllTickets}
                  sx={{ backgroundColor: colors.callToAction }}
                >
                  Next
                </Button>
              ) : null}
              {((wizardMode === "full" && activeStep === 2 && !paymentResumeFlow && !postSubmitFlow) ||
                (wizardMode === "additionalGuests" && activeStep === 2)) ? (
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
              {wizardMode === "full" && activeStep === 4 ? (
                <Button variant="contained" onClick={closeWizard} sx={{ backgroundColor: colors.callToAction }}>
                  Done
                </Button>
              ) : null}
            </Box>
          </Box>

          {activeStep > 0 && wizardMode === "full" && !postSubmitFlow && !editingExistingBooking ? (
            <Button size="small" onClick={resetWizardState} disabled={submitting} sx={{ mt: 1 }}>
              Start over
            </Button>
          ) : null}
          {editingExistingBooking ? (
            <Button size="small" onClick={cancelEditing} disabled={submitting || payingAllTickets} sx={{ mt: 1, ml: 1 }}>
              Cancel editing
            </Button>
          ) : null}
          {wizardMode === "additionalGuests" ? (
            <Button size="small" onClick={closeWizard} disabled={submitting} sx={{ mt: 1, ml: 1 }}>
              Cancel
            </Button>
          ) : null}
          {wizardMode === "full" && activeStep === 4 ? (
            <Button component={RouterLink} to={ROUTES.MY_BOOKINGS} size="small" sx={{ mt: 1, ml: 1 }}>
              View in My Bookings
            </Button>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
