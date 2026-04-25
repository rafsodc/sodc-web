import { useState, useCallback, useMemo } from "react";
import { Box } from "@mui/material";
import { executeQuery, executeMutation } from "firebase/data-connect";
import { dataConnect } from "../../../config/firebase";
import {
  useGetEventsForSection,
  useGetEventById,
  useListEventBookingsForAdmin,
  useListGuestTicketRequestsForAdmin,
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
  adminReviewGuestTicketRequestRef,
  adminDeleteGuestTicketRequestRef,
  adminDeleteBookingLineRef,
  adminDeleteBookingRef,
  TicketAudience,
  GuestTicketRequestStatus,
} from "@dataconnect/generated";
import type { UUIDString } from "@dataconnect/generated";
import type {
  EventBookingAdminRow,
  EventRow,
  GuestTicketRequestWithBooking,
  TicketOrderAdminRow,
  TicketTypeRow,
} from "./sectionEventsManagerTypes";
import { fromDatetimeLocal, toDatetimeLocal } from "../utils/eventDatetime";
import {
  EventDialogSurface,
  EventListSurface,
  TicketAdminSurface,
  TicketTypeDialogSurface,
} from "./SectionEventsManagerSurfaces";
import "../../../shared/components/PageContainer.css";

interface SectionEventsManagerProps {
  sectionId: string;
  sectionName: string;
  initialEventId?: string | null;
  onBack: () => void;
}

export default function SectionEventsManager({ sectionId, sectionName, initialEventId, onBack }: SectionEventsManagerProps) {
  const { data: eventsData, isLoading: loadingEvents, isError: errorEvents, refetch: refetchEvents } = useGetEventsForSection(
    dataConnect,
    { sectionId: sectionId as UUIDString }
  );
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [guestOfHonour, setGuestOfHonour] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [bookingStartDateTime, setBookingStartDateTime] = useState("");
  const [bookingEndDateTime, setBookingEndDateTime] = useState("");
  const [maxGuestsStr, setMaxGuestsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Ticket types: which event we're managing ticket types for
  const [ticketTypesEventId, setTicketTypesEventId] = useState<string | null>(initialEventId ?? null);
  const { data: eventDetailData, isLoading: loadingEventDetail, refetch: refetchEventDetail } = useGetEventById(
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
  const [allUserGroups, setAllUserGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [submittingTicketType, setSubmittingTicketType] = useState(false);
  const [deletingTicketTypeId, setDeletingTicketTypeId] = useState<string | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [moderatorNoteDraft, setModeratorNoteDraft] = useState<Record<string, string>>({});
  const {
    data: guestRequestsData,
    isLoading: loadingGuestRequests,
    refetch: refetchGuestRequests,
  } = useListGuestTicketRequestsForAdmin(
    dataConnect,
    { eventId: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );
  const { data: eventBookingsData, isLoading: loadingEventBookings } = useListEventBookingsForAdmin(
    dataConnect,
    { eventId: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );
  const { data: ticketOrdersData, isLoading: loadingTicketOrders } = useListTicketOrdersForAdmin(
    dataConnect,
    { eventId: (ticketTypesEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!ticketTypesEventId }
  );

  const fetchUserGroups = useCallback(async () => {
    setLoadingUserGroups(true);
    try {
      const ref = listUserGroupsRef(dataConnect);
      const result = await executeQuery(ref);
      setAllUserGroups((result.data?.userGroups ?? []).map((ug) => ({ id: ug.id, name: ug.name })));
    } catch {
      setAllUserGroups([]);
    } finally {
      setLoadingUserGroups(false);
    }
  }, []);

  const openEventDialog = (event?: EventRow | null) => {
    if (event) {
      setEditingEvent(event);
      setTitle(event.title);
      setLocation(event.location ?? "");
      setGuestOfHonour(event.guestOfHonour ?? "");
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
      const now = new Date();
      setStartDateTime(toDatetimeLocal(now.toISOString()));
      setEndDateTime(toDatetimeLocal(now.toISOString()));
      setBookingStartDateTime(toDatetimeLocal(now.toISOString()));
      setBookingEndDateTime(toDatetimeLocal(now.toISOString()));
      setMaxGuestsStr("");
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
    let maxGuestsWithoutModeratorApproval: number | null = null;
    const mg = maxGuestsStr.trim();
    if (mg !== "") {
      const n = parseInt(mg, 10);
      if (Number.isNaN(n) || n < 0) {
        setError("Max guests without moderator approval must be a non-negative integer, or leave blank");
        setSubmitting(false);
        return;
      }
      maxGuestsWithoutModeratorApproval = n;
    }
    try {
      if (editingEvent) {
        await executeMutation(
          updateEventRef(dataConnect, {
            id: editingEvent.id,
            title: title.trim(),
            location: location.trim() || null,
            guestOfHonour: guestOfHonour.trim() || null,
            startDateTime: fromDatetimeLocal(startDateTime),
            endDateTime: fromDatetimeLocal(endDateTime),
            bookingStartDateTime: fromDatetimeLocal(bookingStartDateTime),
            bookingEndDateTime: fromDatetimeLocal(bookingEndDateTime),
            maxGuestsWithoutModeratorApproval,
          })
        );
      } else {
        await executeMutation(
          createEventRef(dataConnect, {
            sectionId: sectionId as UUIDString,
            title: title.trim(),
            location: location.trim() || null,
            guestOfHonour: guestOfHonour.trim() || null,
            startDateTime: fromDatetimeLocal(startDateTime),
            endDateTime: fromDatetimeLocal(endDateTime),
            bookingStartDateTime: fromDatetimeLocal(bookingStartDateTime),
            bookingEndDateTime: fromDatetimeLocal(bookingEndDateTime),
            maxGuestsWithoutModeratorApproval,
          })
        );
      }
      refetchEvents();
      setEventDialogOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: EventRow) => {
    if (!confirm(`Delete event "${event.title}"? This will also remove all ticket types for this event.`)) return;
    setDeletingEventId(event.id);
    setError(null);
    try {
      const bookingsResult = await executeQuery(listEventBookingsForAdminRef(dataConnect, { eventId: event.id as UUIDString }));
      const bookingsList = bookingsResult.data?.event?.bookings ?? [];
      for (const b of bookingsList) {
        for (const gtr of b.guestTicketRequests) {
          await executeMutation(adminDeleteGuestTicketRequestRef(dataConnect, { id: gtr.id }));
        }
        for (const line of b.lines) {
          await executeMutation(adminDeleteBookingLineRef(dataConnect, { id: line.id }));
        }
        await executeMutation(adminDeleteBookingRef(dataConnect, { id: b.id }));
      }
      const detailResult = await executeQuery(getEventByIdRef(dataConnect, { id: event.id as UUIDString }));
      const ticketTypes = detailResult.data?.event?.ticketTypes ?? [];
      for (const tt of ticketTypes) {
        await executeMutation(deleteTicketTypeRef(dataConnect, { id: tt.id }));
      }
      await executeMutation(deleteEventRef(dataConnect, { id: event.id }));
      refetchEvents();
      if (ticketTypesEventId === event.id) setTicketTypesEventId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
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
      setTtAccessGroup(ticketType.userGroup ? { id: ticketType.userGroup.id, name: ticketType.userGroup.name } : null);
    } else {
      setEditingTicketType(null);
      setTtTitle("");
      setTtDescription("");
      setTtPrice("0");
      setTtSortOrder(String((eventDetailData?.event?.ticketTypes?.length ?? 0)));
      setTtAudience(TicketAudience.MEMBER);
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
        await executeMutation(
          updateTicketTypeRef(dataConnect, {
            id: editingTicketType.id,
            userGroupId: ttAccessGroup.id as UUIDString,
            audience: ttAudience,
            title: ttTitle.trim(),
            description: ttDescription.trim() || null,
            price: priceNum,
            sortOrder: sortOrderNum,
          })
        );
      } else {
        await executeMutation(
          createTicketTypeRef(dataConnect, {
            eventId: ticketTypesEventId as UUIDString,
            userGroupId: ttAccessGroup.id as UUIDString,
            audience: ttAudience,
            title: ttTitle.trim(),
            description: ttDescription.trim() || null,
            price: priceNum,
            sortOrder: sortOrderNum,
          })
        );
      }
      refetchEventDetail();
      refetchEvents();
      setTicketTypeDialogOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ticket type");
    } finally {
      setSubmittingTicketType(false);
    }
  };

  const handleDeleteTicketType = async (id: string) => {
    if (!confirm("Delete this ticket type?")) return;
    setDeletingTicketTypeId(id);
    setError(null);
    try {
      await executeMutation(deleteTicketTypeRef(dataConnect, { id }));
      refetchEventDetail();
      refetchEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket type");
    } finally {
      setDeletingTicketTypeId(null);
    }
  };

  const events: EventRow[] = eventsData?.section?.events ?? [];
  const guestRequests = useMemo<GuestTicketRequestWithBooking[]>(() => {
    const bookings = guestRequestsData?.event?.bookings ?? [];
    return bookings.flatMap((booking) =>
      (booking.guestTicketRequests ?? []).map((request) => ({
        ...request,
        bookingId: booking.id,
        bookingStatus: booking.status,
        booker: booking.booker,
      }))
    );
  }, [guestRequestsData]);

  const filteredGuestRequests = useMemo(() => {
    if (requestStatusFilter === "ALL") return guestRequests;
    return guestRequests.filter((r) => r.status === requestStatusFilter);
  }, [guestRequests, requestStatusFilter]);
  const eventBookings: EventBookingAdminRow[] = eventBookingsData?.event?.bookings ?? [];
  const ticketOrders: TicketOrderAdminRow[] = ticketOrdersData?.event?.ticketOrders ?? [];

  const handleReviewRequest = async (
    request: GuestTicketRequestWithBooking,
    status: GuestTicketRequestStatus.APPROVED | GuestTicketRequestStatus.REJECTED
  ) => {
    setReviewingRequestId(request.id);
    setError(null);
    try {
      await executeMutation(
        adminReviewGuestTicketRequestRef(dataConnect, {
          id: request.id as UUIDString,
          status,
          moderatorNote: moderatorNoteDraft[request.id]?.trim() || null,
        })
      );
      setModeratorNoteDraft((prev) => ({ ...prev, [request.id]: "" }));
      refetchGuestRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to review guest ticket request");
    } finally {
      setReviewingRequestId(null);
    }
  };

  if (ticketTypesEventId) {
    const event = events.find((e) => e.id === ticketTypesEventId);
    const eventForAdmin: EventRow | null = eventDetailData?.event
      ? {
          id: eventDetailData.event.id,
          title: eventDetailData.event.title,
          location: eventDetailData.event.location,
          guestOfHonour: eventDetailData.event.guestOfHonour,
          startDateTime: eventDetailData.event.startDateTime,
          endDateTime: eventDetailData.event.endDateTime,
          bookingStartDateTime: eventDetailData.event.bookingStartDateTime,
          bookingEndDateTime: eventDetailData.event.bookingEndDateTime,
          maxGuestsWithoutModeratorApproval: eventDetailData.event.maxGuestsWithoutModeratorApproval,
        }
      : event ?? null;
    const ticketTypes = eventDetailData?.event?.ticketTypes ?? [];
    return (
      <Box className="page-container" sx={{ backgroundColor: "#fafafa", minHeight: "100vh" }}>
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
          requestStatusFilter={requestStatusFilter}
          onRequestStatusFilterChange={setRequestStatusFilter}
          loadingGuestRequests={loadingGuestRequests}
          guestRequests={filteredGuestRequests}
          moderatorNoteDraft={moderatorNoteDraft}
          onModeratorNoteChange={(requestId, value) =>
            setModeratorNoteDraft((prev) => ({ ...prev, [requestId]: value }))
          }
          reviewingRequestId={reviewingRequestId}
          onReviewRequest={(request, status) => void handleReviewRequest(request, status)}
          loadingEventBookings={loadingEventBookings}
          eventBookings={eventBookings}
          loadingTicketOrders={loadingTicketOrders}
          ticketOrders={ticketOrders}
        />

        <TicketTypeDialogSurface
          open={ticketTypeDialogOpen}
          editingTicketType={editingTicketType}
          title={ttTitle}
          description={ttDescription}
          price={ttPrice}
          sortOrder={ttSortOrder}
          audience={ttAudience}
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
          onAccessGroupChange={setTtAccessGroup}
        />

        <EventDialogSurface
          open={eventDialogOpen}
          editingEvent={editingEvent}
          title={title}
          location={location}
          guestOfHonour={guestOfHonour}
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
          onStartDateTimeChange={setStartDateTime}
          onEndDateTimeChange={setEndDateTime}
          onBookingStartDateTimeChange={setBookingStartDateTime}
          onBookingEndDateTimeChange={setBookingEndDateTime}
          onMaxGuestsChange={setMaxGuestsStr}
        />
      </Box>
    );
  }

  return (
    <Box className="page-container" sx={{ backgroundColor: "#fafafa", minHeight: "100vh" }}>
      <EventListSurface
        sectionName={sectionName}
        onBack={onBack}
        error={error}
        onDismissError={() => setError(null)}
        onAddEvent={() => openEventDialog()}
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
        onStartDateTimeChange={setStartDateTime}
        onEndDateTimeChange={setEndDateTime}
        onBookingStartDateTimeChange={setBookingStartDateTime}
        onBookingEndDateTimeChange={setBookingEndDateTime}
        onMaxGuestsChange={setMaxGuestsStr}
      />
    </Box>
  );
}
