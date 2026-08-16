import { useState, useCallback, useEffect, useMemo } from "react";
import { Box } from "@mui/material";
import { dataConnect } from "../../../config/firebase";
import {
  executeDataConnectMutation,
  executeDataConnectQuery,
} from "../../../shared/query/dataConnectExecution";
import { reviewBookingRevision } from "../../../shared/utils/firebaseFunctions";
import {
  useGetEventsForSection,
  useGetEventById,
  useListBookingPaymentAdjustmentsForAdmin,
  useListEventBookingsForAdmin,
  useListUserNamesByIds,
  useListTicketOrdersForAdmin,
} from "@dataconnect/generated/react";
import {
  createEventRef,
  updateEventRef,
  deleteEventRef,
  createTicketTypeRef,
  updateTicketTypeRef,
  deleteTicketTypeRef,
  listUserGroupsRef,
  getEventByIdRef,
  listEventBookingsForAdminRef,
  adminDeleteBookingLineRef,
  adminDeleteBookingRef,
  TicketAudience,
  BookingApprovalStatus,
} from "@dataconnect/generated";
import type { UUIDString } from "@dataconnect/generated";
import type {
  EventBookingAdminRow,
  EventRow,
  BookingPaymentAdjustmentAdminRow,
  TicketOrderAdminRow,
  TicketTypeRow,
} from "./sectionEventsManagerTypes";
import { fromDatetimeLocal, toDatetimeLocal } from "../utils/eventDatetime";
import {
  activeEventTicketRows,
  currentActiveBookings,
  pendingBookingRevisions,
} from "../utils/bookingApprovalsAdmin";
import {
  EventDialogSurface,
  EventListSurface,
  TicketAdminSurface,
  TicketTypeDialogSurface,
} from "./SectionEventsManagerSurfaces";
import SendAnnouncementPage from "./SendAnnouncementPage";
import SnackbarAlert from "../../../shared/components/SnackbarAlert";
import { useSnackbar } from "../../../shared/hooks/useSnackbar";
import "../../../shared/components/PageContainer.css";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";

interface SectionEventsManagerProps {
  sectionId: string;
  sectionName: string;
  initialEventId?: string | null;
  onBack: () => void;
}

export default function SectionEventsManager({ sectionId, sectionName, initialEventId, onBack }: SectionEventsManagerProps) {
  const {
    data: eventsData,
    isLoading: loadingEvents,
    isError: errorEvents,
    error: eventsQueryError,
    refetch: refetchEvents,
  } = useGetEventsForSection(
    dataConnect,
    { sectionId: sectionId as UUIDString }
  );
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [guestOfHonour, setGuestOfHonour] = useState("");
  const [sponsors, setSponsors] = useState("");
  const [details, setDetails] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [bookingStartDateTime, setBookingStartDateTime] = useState("");
  const [bookingEndDateTime, setBookingEndDateTime] = useState("");
  const [maxGuestsStr, setMaxGuestsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { snackbar, showSuccess, close: closeSnackbar } = useSnackbar();
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Ticket types: which event we're managing ticket types for
  const [ticketTypesEventId, setTicketTypesEventId] = useState<string | null>(initialEventId ?? null);
  const {
    data: eventDetailData,
    isLoading: loadingEventDetail,
    isError: eventDetailFailed,
    error: eventDetailError,
    refetch: refetchEventDetail,
  } = useGetEventById(
    dataConnect,
    { id: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );
  const [ticketTypeDialogOpen, setTicketTypeDialogOpen] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketTypeRow | null>(null);
  const [ttTitle, setTtTitle] = useState("");
  const [ttDescription, setTtDescription] = useState("");
  const [ttPrice, setTtPrice] = useState<string>("0");
  const [ttSortOrder, setTtSortOrder] = useState<string>("0");
  const [ttAccessGroup, setTtAccessGroup] = useState<{ id: string; name: string } | null>(null);
  const [ttAudience, setTtAudience] = useState<TicketAudience>(TicketAudience.MEMBER);
  const [ttIncludesDinner, setTtIncludesDinner] = useState(false);
  const [ttIncludesSymposium, setTtIncludesSymposium] = useState(false);
  const [allUserGroups, setAllUserGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [submittingTicketType, setSubmittingTicketType] = useState(false);
  const [deletingTicketTypeId, setDeletingTicketTypeId] = useState<string | null>(null);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [moderatorNoteDraft, setModeratorNoteDraft] = useState<Record<string, string>>({});
  const {
    data: eventBookingsData,
    isLoading: loadingEventBookings,
    isError: eventBookingsFailed,
    error: eventBookingsError,
    refetch: refetchEventBookings,
  } = useListEventBookingsForAdmin(
    dataConnect,
    { eventId: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );
  const {
    data: ticketOrdersData,
    isLoading: loadingTicketOrders,
    isError: ticketOrdersFailed,
    error: ticketOrdersError,
    refetch: refetchTicketOrders,
  } = useListTicketOrdersForAdmin(
    dataConnect,
    { eventId: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );
  const seatingPreferenceUserIds = useMemo(
    () => Array.from(new Set(
      currentActiveBookings(eventBookingsData?.event?.bookings ?? [])
        .flatMap((booking) => booking.sitNextToUserIds ?? [])
    )),
    [eventBookingsData]
  );
  const { data: seatingPreferenceUsersData } = useListUserNamesByIds(
    dataConnect,
    { ids: seatingPreferenceUserIds },
    { enabled: !!ticketTypesEventId && seatingPreferenceUserIds.length > 0 }
  );
  const {
    data: paymentAdjustmentsData,
    isLoading: loadingPaymentAdjustments,
    isError: paymentAdjustmentsFailed,
    error: paymentAdjustmentsError,
    refetch: refetchPaymentAdjustments,
  } = useListBookingPaymentAdjustmentsForAdmin(
    dataConnect,
    { eventId: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );

  useEffect(() => {
    if (!errorEvents) return;
    reportError("admin.events.list", eventsQueryError, { sectionId });
  }, [errorEvents, eventsQueryError, sectionId]);

  useEffect(() => {
    const failures = [
      { failed: eventDetailFailed, error: eventDetailError, operation: "detail", context: "events" as const },
      { failed: eventBookingsFailed, error: eventBookingsError, operation: "bookings", context: "tickets" as const },
      { failed: ticketOrdersFailed, error: ticketOrdersError, operation: "orders", context: "tickets" as const },
      { failed: paymentAdjustmentsFailed, error: paymentAdjustmentsError, operation: "adjustments", context: "payment-reconciliation" as const },
    ].filter((failure) => failure.failed);

    if (failures.length === 0) return;

    for (const failure of failures) {
      reportError(`admin.events.${failure.operation}`, failure.error, {
        sectionId,
        eventId: ticketTypesEventId,
      });
    }
    setError(toAdminUserFacingError(failures[0].error, failures[0].context).message);
  }, [
    eventBookingsError,
    eventBookingsFailed,
    eventDetailError,
    eventDetailFailed,
    paymentAdjustmentsError,
    paymentAdjustmentsFailed,
    sectionId,
    ticketOrdersError,
    ticketOrdersFailed,
    ticketTypesEventId,
  ]);

  const fetchUserGroups = useCallback(async () => {
    setLoadingUserGroups(true);
    try {
      const ref = listUserGroupsRef(dataConnect);
      const result = await executeDataConnectQuery(ref);
      setAllUserGroups((result.data?.userGroups ?? []).map((ug) => ({ id: ug.id, name: ug.name })));
    } catch (caught) {
      reportError("admin.events.user-groups", caught, { sectionId });
      setAllUserGroups([]);
    } finally {
      setLoadingUserGroups(false);
    }
  }, [sectionId]);

  const openEventDialog = (event?: EventRow | null) => {
    if (event) {
      setEditingEvent(event);
      setTitle(event.title);
      setLocation(event.location ?? "");
      setGuestOfHonour(event.guestOfHonour ?? "");
      setSponsors(event.sponsors ?? "");
      setDetails(event.details ?? "");
      setStartDateTime(toDatetimeLocal(event.startDateTime));
      setEndDateTime(toDatetimeLocal(event.endDateTime));
      setBookingStartDateTime(toDatetimeLocal(event.bookingStartDateTime));
      setBookingEndDateTime(toDatetimeLocal(event.bookingEndDateTime));
      setMaxGuestsStr(
        event.maxGuestsWithoutModeratorApproval != null ? String(event.maxGuestsWithoutModeratorApproval) : ""
      );
    } else {
      setEditingEvent(null);
      setTitle("");
      setLocation("");
      setGuestOfHonour("");
      setSponsors("");
      setDetails("");
      const now = new Date();
      setStartDateTime(toDatetimeLocal(now.toISOString()));
      setEndDateTime(toDatetimeLocal(now.toISOString()));
      setBookingStartDateTime(toDatetimeLocal(now.toISOString()));
      setBookingEndDateTime(toDatetimeLocal(now.toISOString()));
      setMaxGuestsStr("0");
    }
    setError(null);
    setEventDialogOpen(true);
  };

  const handleEventSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const mg = maxGuestsStr.trim();
    const n = Number(mg);
    if (mg === "" || !Number.isInteger(n) || n < 0) {
      setError("Max guests without moderator approval is required and must be a non-negative integer");
      setSubmitting(false);
      return;
    }
    const maxGuestsWithoutModeratorApproval = n;
    try {
      if (editingEvent) {
        await executeDataConnectMutation(
          updateEventRef(dataConnect, {
            id: editingEvent.id,
            title: title.trim(),
            location: location.trim() || null,
            guestOfHonour: guestOfHonour.trim() || null,
            sponsors: sponsors.trim() || null,
            details: details.trim() || null,
            startDateTime: fromDatetimeLocal(startDateTime),
            endDateTime: fromDatetimeLocal(endDateTime),
            bookingStartDateTime: fromDatetimeLocal(bookingStartDateTime),
            bookingEndDateTime: fromDatetimeLocal(bookingEndDateTime),
            maxGuestsWithoutModeratorApproval,
          })
        );
      } else {
        await executeDataConnectMutation(
          createEventRef(dataConnect, {
            sectionId: sectionId as UUIDString,
            title: title.trim(),
            location: location.trim() || null,
            guestOfHonour: guestOfHonour.trim() || null,
            sponsors: sponsors.trim() || null,
            details: details.trim() || null,
            startDateTime: fromDatetimeLocal(startDateTime),
            endDateTime: fromDatetimeLocal(endDateTime),
            bookingStartDateTime: fromDatetimeLocal(bookingStartDateTime),
            bookingEndDateTime: fromDatetimeLocal(bookingEndDateTime),
            maxGuestsWithoutModeratorApproval,
          })
        );
      }
      const refreshes: Array<Promise<unknown>> = [refetchEvents()];
      if (editingEvent && ticketTypesEventId === editingEvent.id) {
        refreshes.push(refetchEventDetail());
      }
      await Promise.all(refreshes);
      setEventDialogOpen(false);
      showSuccess(`Event ${editingEvent ? "updated" : "created"}`);
    } catch (err: unknown) {
      reportError("admin.events.save", err, { sectionId, editing: Boolean(editingEvent) });
      setError(toAdminUserFacingError(err, "events").message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: EventRow) => {
    if (!confirm(`Delete event "${event.title}"? This will also remove all ticket types for this event.`)) return;
    setDeletingEventId(event.id);
    setError(null);
    try {
      const bookingsResult = await executeDataConnectQuery(listEventBookingsForAdminRef(dataConnect, { eventId: event.id as UUIDString }));
      const bookingsList = bookingsResult.data?.event?.bookings ?? [];
      for (const b of bookingsList) {
        for (const line of b.lines) {
          await executeDataConnectMutation(adminDeleteBookingLineRef(dataConnect, { id: line.id }));
        }
        await executeDataConnectMutation(adminDeleteBookingRef(dataConnect, { id: b.id }));
      }
      const detailResult = await executeDataConnectQuery(getEventByIdRef(dataConnect, { id: event.id as UUIDString }));
      const ticketTypes = detailResult.data?.event?.ticketTypes ?? [];
      for (const tt of ticketTypes) {
        await executeDataConnectMutation(deleteTicketTypeRef(dataConnect, { id: tt.id }));
      }
      await executeDataConnectMutation(deleteEventRef(dataConnect, { id: event.id }));
      refetchEvents();
      if (ticketTypesEventId === event.id) setTicketTypesEventId(null);
      showSuccess(`Event "${event.title}" deleted`);
    } catch (err: unknown) {
      reportError("admin.events.delete", err, { sectionId, eventId: event.id });
      setError(toAdminUserFacingError(err, "events").message);
    } finally {
      setDeletingEventId(null);
    }
  };

  const openTicketTypeDialog = (ticketType?: TicketTypeRow) => {
    if (ticketType) {
      setEditingTicketType(ticketType);
      setTtTitle(ticketType.title);
      setTtDescription(ticketType.description ?? "");
      setTtPrice(String(ticketType.price));
      setTtSortOrder(String(ticketType.sortOrder));
      setTtAudience(ticketType.audience);
      setTtIncludesDinner(ticketType.includesDinner);
      setTtIncludesSymposium(ticketType.includesSymposium);
      setTtAccessGroup(ticketType.userGroup ? { id: ticketType.userGroup.id, name: ticketType.userGroup.name } : null);
    } else {
      setEditingTicketType(null);
      setTtTitle("");
      setTtDescription("");
      setTtPrice("0");
      setTtSortOrder(String((eventDetailData?.event?.ticketTypes?.length ?? 0)));
      setTtAudience(TicketAudience.MEMBER);
      setTtIncludesDinner(false);
      setTtIncludesSymposium(false);
      setTtAccessGroup(null);
    }
    setTicketTypeDialogOpen(true);
    fetchUserGroups();
  };

  const handleTicketTypeSubmit = async () => {
    if (!ticketTypesEventId || !ttTitle.trim() || !ttAccessGroup) {
      setError("Title and user group are required");
      return;
    }
    const priceNum = parseFloat(ttPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Price must be a non-negative number");
      return;
    }
    const sortOrderNum = parseInt(ttSortOrder, 10) || 0;
    setSubmittingTicketType(true);
    setError(null);
    try {
      if (editingTicketType) {
        await executeDataConnectMutation(
          updateTicketTypeRef(dataConnect, {
            id: editingTicketType.id,
            userGroupId: ttAccessGroup.id as UUIDString,
            audience: ttAudience,
            title: ttTitle.trim(),
            description: ttDescription.trim() || null,
            price: priceNum,
            includesDinner: ttIncludesDinner,
            includesSymposium: ttIncludesSymposium,
            sortOrder: sortOrderNum,
          })
        );
      } else {
        await executeDataConnectMutation(
          createTicketTypeRef(dataConnect, {
            eventId: ticketTypesEventId as UUIDString,
            userGroupId: ttAccessGroup.id as UUIDString,
            audience: ttAudience,
            title: ttTitle.trim(),
            description: ttDescription.trim() || null,
            price: priceNum,
            includesDinner: ttIncludesDinner,
            includesSymposium: ttIncludesSymposium,
            sortOrder: sortOrderNum,
          })
        );
      }
      refetchEventDetail();
      refetchEvents();
      setTicketTypeDialogOpen(false);
      showSuccess(`Ticket type ${editingTicketType ? "updated" : "created"}`);
    } catch (err: unknown) {
      reportError("admin.tickets.save", err, { eventId: ticketTypesEventId, editing: Boolean(editingTicketType) });
      setError(toAdminUserFacingError(err, "tickets").message);
    } finally {
      setSubmittingTicketType(false);
    }
  };

  const handleDeleteTicketType = async (id: string) => {
    if (!confirm("Delete this ticket type?")) return;
    setDeletingTicketTypeId(id);
    setError(null);
    try {
      await executeDataConnectMutation(deleteTicketTypeRef(dataConnect, { id }));
      refetchEventDetail();
      refetchEvents();
      showSuccess("Ticket type deleted");
    } catch (err: unknown) {
      reportError("admin.tickets.delete", err, { ticketTypeId: id });
      setError(toAdminUserFacingError(err, "tickets").message);
    } finally {
      setDeletingTicketTypeId(null);
    }
  };

  const events: EventRow[] = eventsData?.section?.events ?? [];
  const eventBookings = useMemo<EventBookingAdminRow[]>(
    () => eventBookingsData?.event?.bookings ?? [],
    [eventBookingsData]
  );
  const approvalBookings = useMemo(() => {
    if (approvalStatusFilter === "PENDING") return pendingBookingRevisions(eventBookings);
    return eventBookings
      .filter(
        (booking) =>
          approvalStatusFilter === "ALL" || booking.approvalStatus === approvalStatusFilter
      )
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [approvalStatusFilter, eventBookings]);
  const ticketOrders = useMemo<TicketOrderAdminRow[]>(
    () => ticketOrdersData?.event?.ticketOrders ?? [],
    [ticketOrdersData]
  );
  const ticketOrdersById = useMemo(
    () => new Map((eventBookingsData?.event?.bookingTicketOrders ?? []).map((order) => [order.id, order])),
    [eventBookingsData]
  );
  const seatingPreferenceUserNamesById = useMemo(
    () => new Map((seatingPreferenceUsersData?.users ?? []).map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`.trim(),
    ])),
    [seatingPreferenceUsersData]
  );
  const attendeeTickets = useMemo(
    () => activeEventTicketRows(eventBookings, ticketOrdersById, seatingPreferenceUserNamesById),
    [eventBookings, seatingPreferenceUserNamesById, ticketOrdersById]
  );
  const bookingPaymentAdjustments: BookingPaymentAdjustmentAdminRow[] = paymentAdjustmentsData?.event?.bookings ?? [];

  const handleReviewBooking = async (
    booking: EventBookingAdminRow,
    decision: BookingApprovalStatus.APPROVED | BookingApprovalStatus.REJECTED
  ) => {
    setReviewingBookingId(booking.id);
    setError(null);
    try {
      await reviewBookingRevision({
        bookingId: booking.id,
        expectedRevisionNumber: booking.revisionNumber,
        decision,
        moderatorNote: moderatorNoteDraft[booking.id]?.trim() || null,
      });
      setModeratorNoteDraft((prev) => ({ ...prev, [booking.id]: "" }));
      await Promise.all([
        refetchEventBookings(),
        refetchEventDetail(),
        refetchTicketOrders(),
        refetchPaymentAdjustments(),
      ]);
      showSuccess(`Booking revision ${decision === BookingApprovalStatus.APPROVED ? "approved" : "returned for changes"}`);
    } catch (err: unknown) {
      reportError("admin.booking-approval.review", err, { bookingId: booking.id, decision });
      setError(toAdminUserFacingError(err, "booking-approval").message);
    } finally {
      setReviewingBookingId(null);
    }
  };

  if (sendingAnnouncement) {
    return (
      <SendAnnouncementPage
        sectionId={sectionId}
        sectionName={sectionName}
        onBack={() => setSendingAnnouncement(false)}
      />
    );
  }

  if (ticketTypesEventId) {
    const event = events.find((e) => e.id === ticketTypesEventId);
    const eventForAdmin: EventRow | null = eventDetailData?.event
      ? {
          id: eventDetailData.event.id,
          title: eventDetailData.event.title,
          location: eventDetailData.event.location,
          guestOfHonour: eventDetailData.event.guestOfHonour,
          sponsors: eventDetailData.event.sponsors,
          details: eventDetailData.event.details,
          startDateTime: eventDetailData.event.startDateTime,
          endDateTime: eventDetailData.event.endDateTime,
          bookingStartDateTime: eventDetailData.event.bookingStartDateTime,
          bookingEndDateTime: eventDetailData.event.bookingEndDateTime,
          maxGuestsWithoutModeratorApproval: eventDetailData.event.maxGuestsWithoutModeratorApproval,
        }
      : event ?? null;
    const ticketTypes = eventDetailData?.event?.ticketTypes ?? [];
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
        <TicketAdminSurface
          event={eventForAdmin}
          eventTitle={eventForAdmin?.title ?? "Event"}
          error={error}
          onDismissError={() => setError(null)}
          onBack={() => setTicketTypesEventId(null)}
          onEditEvent={openEventDialog}
          onAddTicketType={() => openTicketTypeDialog()}
          loadingEventDetail={loadingEventDetail}
          ticketTypes={ticketTypes}
          deletingTicketTypeId={deletingTicketTypeId}
          onEditTicketType={openTicketTypeDialog}
          onDeleteTicketType={(id) => void handleDeleteTicketType(id)}
          approvalStatusFilter={approvalStatusFilter}
          onApprovalStatusFilterChange={setApprovalStatusFilter}
          approvalBookings={approvalBookings}
          allEventBookings={eventBookings}
          ticketOrdersById={ticketOrdersById}
          attendeeTickets={attendeeTickets}
          moderatorNoteDraft={moderatorNoteDraft}
          onModeratorNoteChange={(bookingId, value) =>
            setModeratorNoteDraft((prev) => ({ ...prev, [bookingId]: value }))
          }
          reviewingBookingId={reviewingBookingId}
          onReviewBooking={(booking, decision) => void handleReviewBooking(booking, decision)}
          loadingEventBookings={loadingEventBookings}
          eventBookings={eventBookings}
          loadingTicketOrders={loadingTicketOrders}
          ticketOrders={ticketOrders}
          loadingPaymentAdjustments={loadingPaymentAdjustments}
          bookingPaymentAdjustments={bookingPaymentAdjustments}
        />

        <TicketTypeDialogSurface
          open={ticketTypeDialogOpen}
          editingTicketType={editingTicketType}
          title={ttTitle}
          description={ttDescription}
          price={ttPrice}
          sortOrder={ttSortOrder}
          audience={ttAudience}
          includesDinner={ttIncludesDinner}
          includesSymposium={ttIncludesSymposium}
          accessGroup={ttAccessGroup}
          userGroups={allUserGroups}
          loadingUserGroups={loadingUserGroups}
          submitting={submittingTicketType}
          onClose={() => setTicketTypeDialogOpen(false)}
          onSubmit={handleTicketTypeSubmit}
          onTitleChange={setTtTitle}
          onDescriptionChange={setTtDescription}
          onPriceChange={setTtPrice}
          onSortOrderChange={setTtSortOrder}
          onAudienceChange={setTtAudience}
          onIncludesDinnerChange={setTtIncludesDinner}
          onIncludesSymposiumChange={setTtIncludesSymposium}
          onAccessGroupChange={setTtAccessGroup}
        />

        <EventDialogSurface
          open={eventDialogOpen}
          editingEvent={editingEvent}
          title={title}
          location={location}
          guestOfHonour={guestOfHonour}
          sponsors={sponsors}
          details={details}
          startDateTime={startDateTime}
          endDateTime={endDateTime}
          bookingStartDateTime={bookingStartDateTime}
          bookingEndDateTime={bookingEndDateTime}
          maxGuestsStr={maxGuestsStr}
          submitting={submitting}
          onClose={() => setEventDialogOpen(false)}
          onSubmit={handleEventSubmit}
          onTitleChange={setTitle}
          onLocationChange={setLocation}
          onGuestOfHonourChange={setGuestOfHonour}
          onSponsorsChange={setSponsors}
          onDetailsChange={setDetails}
          onStartDateTimeChange={setStartDateTime}
          onEndDateTimeChange={setEndDateTime}
          onBookingStartDateTimeChange={setBookingStartDateTime}
          onBookingEndDateTimeChange={setBookingEndDateTime}
          onMaxGuestsChange={setMaxGuestsStr}
        />

        <SnackbarAlert snackbar={snackbar} onClose={closeSnackbar} />
      </Box>
    );
  }

  return (
    <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
      <EventListSurface
        sectionName={sectionName}
        onBack={onBack}
        error={error}
        onDismissError={() => setError(null)}
        onAddEvent={() => openEventDialog()}
        onSendAnnouncement={() => setSendingAnnouncement(true)}
        loadingEvents={loadingEvents}
        errorEvents={errorEvents}
        events={events}
        deletingEventId={deletingEventId}
        onManageEventAdmin={setTicketTypesEventId}
        onDeleteEvent={(event) => void handleDeleteEvent(event)}
      />

      <EventDialogSurface
        open={eventDialogOpen}
        editingEvent={editingEvent}
        title={title}
        location={location}
        guestOfHonour={guestOfHonour}
        sponsors={sponsors}
        details={details}
        startDateTime={startDateTime}
        endDateTime={endDateTime}
        bookingStartDateTime={bookingStartDateTime}
        bookingEndDateTime={bookingEndDateTime}
        maxGuestsStr={maxGuestsStr}
        submitting={submitting}
        onClose={() => setEventDialogOpen(false)}
        onSubmit={handleEventSubmit}
        onTitleChange={setTitle}
        onLocationChange={setLocation}
        onGuestOfHonourChange={setGuestOfHonour}
        onSponsorsChange={setSponsors}
        onDetailsChange={setDetails}
        onStartDateTimeChange={setStartDateTime}
        onEndDateTimeChange={setEndDateTime}
        onBookingStartDateTimeChange={setBookingStartDateTime}
        onBookingEndDateTimeChange={setBookingEndDateTime}
        onMaxGuestsChange={setMaxGuestsStr}
      />

      <SnackbarAlert snackbar={snackbar} onClose={closeSnackbar} />
    </Box>
  );
}
