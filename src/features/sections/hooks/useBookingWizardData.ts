import { useMemo } from "react";
import type { GetEventByIdData, GetSectionByIdData, UUIDString } from "@dataconnect/generated";
import { BookingStatus, TicketAudience } from "@dataconnect/generated";
import {
  useGetCurrentUser,
  useGetMyBookingPaymentAdjustments,
  useGetMyBookingsForEvent,
  useGetMyTicketOrders,
  useGetUserAccessGroups,
} from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { evaluateBookingGatePreview, userMatchesUserGroup } from "../utils/bookingEligibility";
import {
  buildBookingTicketRowsWithPaymentStatus,
  hasExpiredDraftHold,
  isBookingPaymentComplete,
  summarizeEventBookingPayment,
} from "../utils/eventBookingStatusSummary";

type EventDetail = NonNullable<GetEventByIdData["event"]>;
type SectionDetail = NonNullable<GetSectionByIdData["section"]>;

export function useBookingWizardData(args: {
  section: SectionDetail;
  event: EventDetail;
  postSubmitFlow: boolean;
}) {
  const { section, event, postSubmitFlow } = args;
  const { data: currentUserData, isLoading: loadingProfile } = useGetCurrentUser(dataConnect, {});
  const { data: accessData } = useGetUserAccessGroups(dataConnect, {});
  const {
    data: myBookingsData,
    isLoading: loadingBookings,
    isError: bookingsError,
    error: bookingsQueryError,
    refetch: refetchMyBookings,
  } = useGetMyBookingsForEvent(dataConnect, { eventId: event.id as UUIDString });
  const membershipStatus = currentUserData?.user?.membershipStatus;

  const explicitGroupIds = useMemo(() => {
    const ids = accessData?.user?.userGroups?.map((group) => group.userGroup.id) ?? [];
    return new Set(ids);
  }, [accessData]);

  const gate = useMemo(() => {
    if (!membershipStatus) {
      return {
        ok: false as const,
        message: "Your profile must include a membership status before booking.",
      };
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
      (ticketType) =>
        ticketType.audience === TicketAudience.MEMBER &&
        userMatchesUserGroup(membershipStatus, ticketType.userGroup, explicitGroupIds)
    );
  }, [event.ticketTypes, membershipStatus, explicitGroupIds, gate]);

  const guestTicketTypes = useMemo(() => {
    if (!membershipStatus || gate.ok !== true) return [];
    return (event.ticketTypes ?? []).filter(
      (ticketType) =>
        ticketType.audience === TicketAudience.GUEST &&
        userMatchesUserGroup(membershipStatus, ticketType.userGroup, explicitGroupIds)
    );
  }, [event.ticketTypes, membershipStatus, explicitGroupIds, gate]);

  const existingTerminalBooking = useMemo(() => {
    const bookings = myBookingsData?.user?.bookings ?? [];
    return bookings
      .filter(
        (booking) =>
          (booking.status === BookingStatus.SUBMITTED ||
            booking.status === BookingStatus.CONFIRMED) &&
          booking.supersededAt == null
      )
      .reduce<(typeof bookings)[number] | null>((latest, booking) => {
        if (!latest) return booking;
        return booking.revisionNumber > latest.revisionNumber ? booking : latest;
      }, null);
  }, [myBookingsData]);

  const paymentEligibleBooking = useMemo(() => {
    const bookings = myBookingsData?.user?.bookings ?? [];
    return bookings
      .filter(
        (booking) =>
          (booking.status === BookingStatus.SUBMITTED ||
            booking.status === BookingStatus.CONFIRMED) &&
          booking.supersededAt == null &&
          booking.approvalStatus !== "PENDING" &&
          booking.approvalStatus !== "REJECTED"
      )
      .reduce<(typeof bookings)[number] | null>((latest, booking) => {
        if (!latest) return booking;
        return booking.revisionNumber > latest.revisionNumber ? booking : latest;
      }, null);
  }, [myBookingsData]);

  const existingDraft = useMemo(() => {
    const bookings = myBookingsData?.user?.bookings ?? [];
    return bookings.find((booking) => booking.status === BookingStatus.DRAFT) ?? null;
  }, [myBookingsData]);

  const showExpiredDraftHoldNotice = useMemo(
    () => hasExpiredDraftHold(myBookingsData?.user?.bookings),
    [myBookingsData]
  );

  const { data: ticketOrdersData } = useGetMyTicketOrders(dataConnect, {
    enabled: Boolean(existingTerminalBooking) || Boolean(paymentEligibleBooking) || postSubmitFlow,
  });
  const { data: paymentAdjustmentsData } = useGetMyBookingPaymentAdjustments(dataConnect, {
    enabled: Boolean(existingTerminalBooking) || postSubmitFlow,
  });

  const bookingPaymentAdjustments = useMemo(() => {
    if (!paymentEligibleBooking) return [];
    const booking = paymentAdjustmentsData?.user?.bookings?.find(
      (row) => row.id === paymentEligibleBooking.id
    );
    return booking?.adjustments ?? [];
  }, [paymentEligibleBooking, paymentAdjustmentsData]);

  const paymentSummaryForBooking = useMemo(() => {
    if (!paymentEligibleBooking) return null;
    return summarizeEventBookingPayment({
      booking: paymentEligibleBooking,
      eventId: event.id,
      ticketOrders: ticketOrdersData?.user?.ticketOrders ?? [],
      adjustments: bookingPaymentAdjustments,
    });
  }, [paymentEligibleBooking, event.id, ticketOrdersData, bookingPaymentAdjustments]);

  const paymentTicketRows = useMemo(() => {
    if (!paymentEligibleBooking) return [];
    return buildBookingTicketRowsWithPaymentStatus({
      booking: paymentEligibleBooking,
      eventId: event.id,
      ticketOrders: ticketOrdersData?.user?.ticketOrders ?? [],
    });
  }, [paymentEligibleBooking, event.id, ticketOrdersData]);

  const canProceedToConfirmation =
    paymentSummaryForBooking != null && isBookingPaymentComplete(paymentSummaryForBooking);

  return {
    bookingTicketOrders: myBookingsData?.user?.bookingTicketOrders ?? [],
    bookingsError,
    bookingsQueryError,
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
    paymentEligibleBooking,
    refetchMyBookings,
    showExpiredDraftHoldNotice,
    ticketOrdersData,
  };
}
