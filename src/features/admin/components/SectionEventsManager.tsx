import { useSessionMutation } from "../../../shared/hooks/useSessionMutation";
import {
  captureSession,
  isSessionCurrent,
  isPrivateSessionSuspended,
} from "../../../shared/appShell/sessionLifecycle";
import { idsEqual } from "../../../shared/utils/uuid";
import {
  eventAnnouncementPath,
  readEventAnnouncementFilters,
} from "../utils/eventAnnouncementNavigation";
import {
  useSessionDraft,
  useDraftUnloadWarning,
} from "../../../shared/hooks/useSessionDraft";
import type { Dispatch, SetStateAction } from "react";
import { listSectionTicketAccessGroupsRef } from "../../../shared/query/sectionModerationMetadata";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  eventManagementPath,
  eventEditorPath,
  ticketEditorPath,
  normalizedResourceId,
  sectionManagementPath,
  readEventManagementTask,
} from "../../../shared/navigation/sectionRoutes";
import { emptyEventAttendeeTicketFilters } from "../utils/bookingApprovalsAdmin";
import type { EventAttendeeTicketFilters } from "../utils/bookingApprovalsAdmin";
import TicketAttendanceDialog from "./TicketAttendanceDialog";
import AddUserTicketDialog from "./AddUserTicketDialog";
import type { EventAttendeeTicketRow } from "../utils/bookingApprovalsAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { guestCall, type GuestList } from "../../guests/api";
import { organiserGuestTicketRows } from "../../guests/reporting";
import OrganiserGuestsManager from "../../guests/OrganiserGuestsManager";
import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Alert, Box, Button } from "@mui/material";
import { invalidateMyBookings } from "../../../shared/query/invalidation";
import {
  refreshDataConnectQuery,
  SERVER_ONLY_QUERY_OPTIONS,
} from "../../../shared/query/authoritativeDataConnect";
import { auth, dataConnect } from "../../../config/firebase";
import {
  executeDataConnectMutation,
  executeDataConnectQuery,
} from "../../../shared/query/dataConnectExecution";
import {
  getSectionMemberNamesByIds,
  reviewBookingRevision,
} from "../../../shared/utils/firebaseFunctions";
import {
  useGetEventsForSection,
  useGetEventById,
  useListBookingPaymentAdjustmentsForAdmin,
  useListEventBookingsForAdmin,
  useListTicketOrdersForAdmin,
} from "../../../shared/query/authoritativeHooks";
import {
  getEventsForSectionRef,
  getEventByIdRef,
  listEventBookingsForAdminRef,
  listTicketOrdersForAdminRef,
  listBookingPaymentAdjustmentsForAdminRef,
  createEventRef,
  updateEventRef,
  deleteEventRef,
  createTicketTypeRef,
  updateTicketTypeRef,
  deleteTicketTypeRef,
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
import ConfirmationDialog from "../../../shared/components/ConfirmationDialog";
import { useSnackbar } from "../../../shared/hooks/useSnackbar";
import "../../../shared/components/PageContainer.css";
import { reportError, toAdminUserFacingError } from "../../../shared/errors";

/** Async callbacks belong to the exact mounted URL activation, even on A→B→A. */
function useCurrentView(scope: string) {
  const { lifecycle, uid, generation } = captureSession();
  const activation = useMemo(
    () => ({ scope, session: { lifecycle, uid, generation } }),
    [scope, lifecycle, uid, generation],
  );
  const current = useRef<typeof activation | null>(null);
  useLayoutEffect(() => {
    current.current = activation;
    return () => {
      if (current.current === activation) current.current = null;
    };
  }, [activation]);
  return useCallback(
    () =>
      current.current === activation &&
      isSessionCurrent(activation.session) &&
      !isPrivateSessionSuspended(activation.session),
    [activation],
  );
}

type FieldSetters<T> = { [K in keyof T]: Dispatch<SetStateAction<T[K]>> };
function useFormDraft<T extends object>(key: string, initial: T) {
  const [value, update, discard] = useSessionDraft(key, initial);
  const setters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(initial).map((field) => [
          field,
          (action: SetStateAction<unknown>) =>
            update((previous) => {
              const k = field as keyof T;
              return {
                ...previous,
                [k]:
                  typeof action === "function"
                    ? (action as (value: T[keyof T]) => T[keyof T])(previous[k])
                    : action,
              };
            }),
        ]),
      ) as FieldSetters<T>,
    [initial, update],
  );
  return [value, setters, update, discard] as const;
}
const INITIAL_EVENT_FORM = {
  initialized: false,
  baseline: "",
  title: "",
  location: "",
  guestOfHonour: "",
  sponsors: "",
  details: "",
  startDateTime: "",
  endDateTime: "",
  bookingStartDateTime: "",
  bookingEndDateTime: "",
  maxGuestsStr: "",
};
const INITIAL_TICKET_FORM = {
  initialized: false,
  baseline: "",
  ttTitle: "",
  ttDescription: "",
  ttPrice: "0",
  ttSortOrder: "0",
  ttAccessGroup: null as { id: string; name: string } | null,
  ttAudience: TicketAudience.MEMBER,
  ttIncludesDinner: false,
  ttIncludesSymposium: false,
};
function formSnapshot(form: object) {
  const {
    initialized: _initialized,
    baseline: _baseline,
    ...fields
  } = form as Record<string, unknown>;
  void _initialized;
  void _baseline;
  return JSON.stringify(fields);
}

type DeleteTarget =
  | { kind: "event"; item: EventRow }
  | { kind: "ticketType"; item: Pick<TicketTypeRow, "id" | "title"> };

interface SectionEventsManagerProps {
  sectionId: string;
  sectionName: string;
  initialEventId?: string | null;
  onBack: () => void;
  routeControlled?: boolean;
}

export default function SectionEventsManager({
  sectionId,
  sectionName,
  initialEventId,
  onBack,
  routeControlled = false,
}: SectionEventsManagerProps) {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const task = readEventManagementTask(routeLocation.search);
  const isCurrentView = useCurrentView(
    `${sectionId}:${initialEventId ?? "list"}:${routeLocation.pathname}${routeLocation.search}`,
  );
  const queryClient = useQueryClient();
  const [refreshFailure, setRefreshFailure] = useState<{
    message: string;
    savedMessage: string;
    retry: () => Promise<unknown>;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ticketEdit, setTicketEdit] = useState<{
    row: EventAttendeeTicketRow;
    action: "edit" | "delete" | "restore";
  } | null>(null);
  const [addingUserTicket, setAddingUserTicket] = useState(false);
  const {
    data: eventsData,
    isLoading: loadingEvents,
    isError: errorEvents,
    error: eventsQueryError,
  } = useGetEventsForSection(dataConnect, {
    sectionId: sectionId as UUIDString,
  });
  const [localEventDialogOpen, setLocalEventDialogOpen] = useState(false);
  const [localEditingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSubmitting(false);
    setSubmittingTicketType(false);
    setRefreshing(false);
    setError(null);
    setWriteReview(null);
  }, [routeLocation.pathname, routeLocation.search]);
  const { snackbar, showSuccess, close: closeSnackbar } = useSnackbar();
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletionInFlight = useRef(false);

  // Ticket types: which event we're managing ticket types for
  const [localEventId, setLocalEventId] = useState<string | null>(
    initialEventId ?? null,
  );
  const ticketTypesEventId = routeControlled
    ? (initialEventId ?? null)
    : localEventId;
  const setTicketTypesEventId = (id: string | null) =>
    routeControlled
      ? navigate(
          id
            ? eventManagementPath(sectionId, id)
            : sectionManagementPath(sectionId, "events"),
        )
      : setLocalEventId(id);
  const selectedEventIsKnown =
    !!ticketTypesEventId &&
    idsEqual(eventsData?.section?.id, sectionId) &&
    !!eventsData?.section?.events.some((event) =>
      idsEqual(event.id, ticketTypesEventId),
    );
  const {
    data: eventDetailData,
    isLoading: loadingEventDetail,
    isError: eventDetailFailed,
    error: eventDetailError,
  } = useGetEventById(
    dataConnect,
    {
      id: (ticketTypesEventId ??
        "00000000-0000-0000-0000-000000000000") as UUIDString,
    },
    {
      enabled:
        !!ticketTypesEventId && (!routeControlled || selectedEventIsKnown),
    },
  );
  const [localTicketTypeDialogOpen, setLocalTicketTypeDialogOpen] =
    useState(false);
  const [localEditingTicketType, setEditingTicketType] =
    useState<TicketTypeRow | null>(null);
  const searchParams = new URLSearchParams(routeLocation.search);
  const editSelector = searchParams.get("edit");
  const ticketSelector = searchParams.get("ticket");
  const eventDialogOpen = routeControlled
    ? editSelector === "new-event" ||
      (editSelector === "event" && !!ticketTypesEventId)
    : localEventDialogOpen;
  const ticketTypeDialogOpen = routeControlled
    ? !!ticketSelector && !!ticketTypesEventId
    : localTicketTypeDialogOpen;
  const editingEvent = routeControlled
    ? editSelector === "event"
      ? (eventDetailData?.event ?? null)
      : null
    : localEditingEvent;
  const editingTicketType = routeControlled
    ? (eventDetailData?.event?.ticketTypes.find((ticket) =>
        idsEqual(ticket.id, ticketSelector),
      ) ?? null)
    : localEditingTicketType;
  const changeEditor = (name?: "edit" | "ticket", value?: string) => {
    const next = new URLSearchParams(routeLocation.search);
    next.delete("edit");
    next.delete("ticket");
    if (name && value) next.set(name, value);
    navigate({
      pathname: routeLocation.pathname,
      search: next.toString() ? `?${next}` : "",
    });
  };
  const setEventDialogOpen = (open: boolean) =>
    routeControlled
      ? changeEditor(
          open ? "edit" : undefined,
          open ? (ticketTypesEventId ? "event" : "new-event") : undefined,
        )
      : setLocalEventDialogOpen(open);
  const setTicketTypeDialogOpen = (open: boolean) =>
    routeControlled
      ? changeEditor(
          open ? "ticket" : undefined,
          open ? (editingTicketType?.id ?? "new") : undefined,
        )
      : setLocalTicketTypeDialogOpen(open);
  const [eventForm, eventSetters, updateEventForm, discardEventDraft] =
    useFormDraft(
      `section-event:${normalizedResourceId(sectionId)}:${normalizedResourceId(editingEvent?.id ?? initialEventId ?? "new")}`,
      INITIAL_EVENT_FORM,
    );
  const eventWrite = useSessionMutation<unknown>(
    `event-write:${normalizedResourceId(sectionId)}:${normalizedResourceId(editingEvent?.id ?? initialEventId ?? "new")}`,
  );
  const ticketWrite = useSessionMutation<unknown>(
    `ticket-write:${normalizedResourceId(sectionId)}:${normalizedResourceId(ticketTypesEventId ?? "none")}:${normalizedResourceId(routeControlled ? (ticketSelector ?? "new") : (editingTicketType?.id ?? "new"))}`,
  );
  const [writeReview, setWriteReview] = useState<{
    kind: "event" | "ticket";
    titles: string[];
    receipt: object;
    isCurrent: () => boolean;
  } | null>(null);
  const activeWriteReview = writeReview?.isCurrent === isCurrentView && writeReview.isCurrent() &&
    (writeReview.kind === "event" ? eventWrite : ticketWrite).receipt === writeReview.receipt
    ? writeReview : null;
  const {
    title,
    location,
    guestOfHonour,
    sponsors,
    details,
    startDateTime,
    endDateTime,
    bookingStartDateTime,
    bookingEndDateTime,
    maxGuestsStr,
  } = eventForm;
  const {
    title: setTitle,
    location: setLocation,
    guestOfHonour: setGuestOfHonour,
    sponsors: setSponsors,
    details: setDetails,
    startDateTime: setStartDateTime,
    endDateTime: setEndDateTime,
    bookingStartDateTime: setBookingStartDateTime,
    bookingEndDateTime: setBookingEndDateTime,
    maxGuestsStr: setMaxGuestsStr,
  } = eventSetters;
  const [ticketForm, ticketSetters, updateTicketForm, discardTicketDraft] =
    useFormDraft(
      `section-ticket:${normalizedResourceId(sectionId)}:${normalizedResourceId(ticketTypesEventId ?? "none")}:${normalizedResourceId(routeControlled ? (ticketSelector ?? "new") : (editingTicketType?.id ?? "new"))}`,
      INITIAL_TICKET_FORM,
    );
  const {
    ttTitle,
    ttDescription,
    ttPrice,
    ttSortOrder,
    ttAccessGroup,
    ttAudience,
    ttIncludesDinner,
    ttIncludesSymposium,
  } = ticketForm;
  const {
    ttTitle: setTtTitle,
    ttDescription: setTtDescription,
    ttPrice: setTtPrice,
    ttSortOrder: setTtSortOrder,
    ttAccessGroup: setTtAccessGroup,
    ttAudience: setTtAudience,
    ttIncludesDinner: setTtIncludesDinner,
    ttIncludesSymposium: setTtIncludesSymposium,
  } = ticketSetters;
  useDraftUnloadWarning(
    (eventDialogOpen &&
      eventForm.initialized &&
      formSnapshot(eventForm) !== eventForm.baseline) ||
      (ticketTypeDialogOpen &&
        ticketForm.initialized &&
        formSnapshot(ticketForm) !== ticketForm.baseline),
  );
  const [allUserGroups, setAllUserGroups] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingUserGroups, setLoadingUserGroups] = useState(false);
  const [submittingTicketType, setSubmittingTicketType] = useState(false);
  const [deletingTicketTypeId, setDeletingTicketTypeId] = useState<
    string | null
  >(null);
  const [localApprovalFilter, setLocalApprovalFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("PENDING");
  const rawApprovalFilter = searchParams.get("approval");
  const approvalStatusFilter = routeControlled
    ? ["ALL", "APPROVED", "REJECTED"].includes(rawApprovalFilter ?? "")
      ? (rawApprovalFilter as "ALL" | "APPROVED" | "REJECTED")
      : "PENDING"
    : localApprovalFilter;
  const setApprovalStatusFilter = (
    value: "ALL" | "PENDING" | "APPROVED" | "REJECTED",
  ) => {
    if (!routeControlled) {
      setLocalApprovalFilter(value);
      return;
    }
    const next = new URLSearchParams(routeLocation.search);
    next.set("approval", value);
    navigate({ pathname: routeLocation.pathname, search: `?${next}` });
  };
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(
    null,
  );
  const [eventAnnouncement, setEventAnnouncement] = useState<
    | {
        eventId: string;
        eventTitle?: string;
        filters: EventAttendeeTicketFilters;
      }
    | undefined
  >();
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [moderatorNoteDraft, setModeratorNoteDraft] = useSessionDraft<
    Record<string, string>
  >(
    `event-notes:${normalizedResourceId(sectionId)}:${normalizedResourceId(ticketTypesEventId ?? "none")}`,
    {},
  );
  const {
    data: eventBookingsData,
    isLoading: loadingEventBookings,
    isError: eventBookingsFailed,
    error: eventBookingsError,
  } = useListEventBookingsForAdmin(
    dataConnect,
    {
      eventId: (ticketTypesEventId ??
        "00000000-0000-0000-0000-000000000000") as UUIDString,
    },
    {
      enabled:
        !!ticketTypesEventId && (!routeControlled || selectedEventIsKnown),
    },
  );
  const {
    data: ticketOrdersData,
    isLoading: loadingTicketOrders,
    isError: ticketOrdersFailed,
    error: ticketOrdersError,
  } = useListTicketOrdersForAdmin(
    dataConnect,
    {
      eventId: (ticketTypesEventId ??
        "00000000-0000-0000-0000-000000000000") as UUIDString,
    },
    {
      enabled:
        !!ticketTypesEventId && (!routeControlled || selectedEventIsKnown),
    },
  );
  const seatingPreferenceUserIds = useMemo(
    () =>
      Array.from(
        new Set(
          currentActiveBookings(
            eventBookingsData?.event?.bookings ?? [],
          ).flatMap((booking) => [
            ...(booking.sitNextToUserIds ?? []),
            ...booking.lines.flatMap(
              (line) => line.bookingPlace?.attendanceSitNextToUserIds ?? [],
            ),
          ]),
        ),
      ),
    [eventBookingsData],
  );
  const { data: seatingPreferenceUsersData } = useQuery({
    queryKey: [
      "section-member-names",
      sectionId,
      seatingPreferenceUserIds,
      auth.currentUser?.uid,
    ],
    queryFn: async () => {
      const chunks: string[][] = [];
      for (
        let offset = 0;
        offset < seatingPreferenceUserIds.length;
        offset += 100
      )
        chunks.push(seatingPreferenceUserIds.slice(offset, offset + 100));
      const results = await Promise.all(
        chunks.map((ids) => getSectionMemberNamesByIds(sectionId, ids)),
      );
      return { users: results.flatMap((result) => result.users) };
    },
    enabled:
      !!ticketTypesEventId &&
      (!routeControlled || selectedEventIsKnown) &&
      seatingPreferenceUserIds.length > 0,
  });
  const {
    data: paymentAdjustmentsData,
    isLoading: loadingPaymentAdjustments,
    isError: paymentAdjustmentsFailed,
    error: paymentAdjustmentsError,
  } = useListBookingPaymentAdjustmentsForAdmin(
    dataConnect,
    {
      eventId: (ticketTypesEventId ??
        "00000000-0000-0000-0000-000000000000") as UUIDString,
    },
    {
      enabled:
        !!ticketTypesEventId && (!routeControlled || selectedEventIsKnown),
    },
  );

  const refetchEvents = () =>
    refreshDataConnectQuery(
      queryClient,
      getEventsForSectionRef(dataConnect, { sectionId }),
    );
  const refetchEventDetail = () =>
    ticketTypesEventId
      ? refreshDataConnectQuery(
          queryClient,
          getEventByIdRef(dataConnect, { id: ticketTypesEventId }),
        )
      : Promise.resolve();
  const refetchEventBookings = () =>
    ticketTypesEventId
      ? refreshDataConnectQuery(
          queryClient,
          listEventBookingsForAdminRef(dataConnect, {
            eventId: ticketTypesEventId,
          }),
        )
      : Promise.resolve();
  const refetchTicketOrders = () =>
    ticketTypesEventId
      ? refreshDataConnectQuery(
          queryClient,
          listTicketOrdersForAdminRef(dataConnect, {
            eventId: ticketTypesEventId,
          }),
        )
      : Promise.resolve();
  const refetchPaymentAdjustments = () =>
    ticketTypesEventId
      ? refreshDataConnectQuery(
          queryClient,
          listBookingPaymentAdjustmentsForAdminRef(dataConnect, {
            eventId: ticketTypesEventId,
          }),
        )
      : Promise.resolve();
  const refreshEventAdministration = () =>
    Promise.all([
      refetchEvents(),
      refetchEventDetail(),
      refetchEventBookings(),
      refetchTicketOrders(),
      refetchPaymentAdjustments(),
      queryClient.invalidateQueries(
        { queryKey: ["eventAttendees", ticketTypesEventId] },
        { throwOnError: true },
      ),
      invalidateMyBookings(queryClient),
    ]);
  const refreshSavedChange = async (
    message: string,
    read: () => Promise<unknown>,
  ) => {
    if (isCurrentView()) setRefreshing(true);
    try {
      await read();
      if (!isCurrentView()) return;
      setRefreshFailure(null);
      showSuccess(message);
      return true;
    } catch (caught) {
      if (!isCurrentView()) return;
      reportError("admin.events.refresh-after-save", caught, {
        sectionId,
        eventId: ticketTypesEventId,
      });
      setRefreshFailure({
        message: `${message}. The latest event data could not be loaded. Retry the refresh; the change is already saved.`,
        savedMessage: message,
        retry: read,
      });
      return false;
    } finally {
      if (isCurrentView()) setRefreshing(false);
    }
  };
  const refreshWarning = refreshFailure && (
    <Alert
      severity="warning"
      action={
        <Button
          disabled={refreshing}
          onClick={() =>
            void refreshSavedChange(
              refreshFailure.savedMessage,
              refreshFailure.retry,
            )
          }
        >
          Retry refresh
        </Button>
      }
    >
      {refreshFailure.message}
    </Alert>
  );

  useEffect(() => {
    if (!errorEvents) return;
    reportError("admin.events.list", eventsQueryError, { sectionId });
  }, [errorEvents, eventsQueryError, sectionId]);

  useEffect(() => {
    const failures = [
      {
        failed: eventDetailFailed,
        error: eventDetailError,
        operation: "detail",
        context: "events" as const,
      },
      {
        failed: eventBookingsFailed,
        error: eventBookingsError,
        operation: "bookings",
        context: "tickets" as const,
      },
      {
        failed: ticketOrdersFailed,
        error: ticketOrdersError,
        operation: "orders",
        context: "tickets" as const,
      },
      {
        failed: paymentAdjustmentsFailed,
        error: paymentAdjustmentsError,
        operation: "adjustments",
        context: "payment-reconciliation" as const,
      },
    ].filter((failure) => failure.failed);

    if (failures.length === 0) return;

    for (const failure of failures) {
      reportError(`admin.events.${failure.operation}`, failure.error, {
        sectionId,
        eventId: ticketTypesEventId,
      });
    }
    setError(
      toAdminUserFacingError(failures[0].error, failures[0].context).message,
    );
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
      const ref = listSectionTicketAccessGroupsRef(dataConnect, { sectionId });
      const result = await executeDataConnectQuery(
        ref,
        SERVER_ONLY_QUERY_OPTIONS,
      );
      if (!isCurrentView()) return;
      setAllUserGroups(
        (result.data?.userGroups ?? []).map((ug) => ({
          id: ug.id,
          name: ug.name,
        })),
      );
    } catch (caught) {
      if (!isCurrentView()) return;
      reportError("admin.events.user-groups", caught, { sectionId });
      setAllUserGroups([]);
    } finally {
      if (isCurrentView()) setLoadingUserGroups(false);
    }
  }, [sectionId, isCurrentView]);

  const reconcileWrite = async (kind: "event" | "ticket") => {
    const receipt = kind === "event" ? eventWrite : ticketWrite;
    if (receipt.status !== "success") return;
    const refreshed = await refreshSavedChange("Saved change loaded", () =>
      kind === "event"
        ? Promise.all([refetchEvents(), refetchEventDetail()])
        : Promise.all([refetchEventDetail(), refetchEvents()]),
    );
    if (!refreshed || !isCurrentView()) return;
    receipt.acknowledge();
    if (kind === "event") {
      discardEventDraft();
      setEventDialogOpen(false);
    } else {
      discardTicketDraft();
      setTicketTypeDialogOpen(false);
    }
  };
  const reviewUnconfirmedWrite = async (kind: "event" | "ticket") => {
    const receipt = kind === "event" ? eventWrite : ticketWrite;
    if (receipt.status !== "error" || !receipt.receipt) return;
    setWriteReview(null);
    try {
      const data = kind === "event" ? await refetchEvents() : await refetchEventDetail();
      if (!isCurrentView()) return;
      const rows = kind === "event"
        ? (data as { section?: { events?: Array<{ title: string }> } })?.section?.events
        : (data as { event?: { ticketTypes?: Array<{ title: string }> } })?.event?.ticketTypes;
      if (!Array.isArray(rows)) throw new Error("The latest list could not be verified.");
      setWriteReview({ kind, titles: rows.map(row => row.title), receipt: receipt.receipt, isCurrent: isCurrentView });
    } catch (caught) {
      if (isCurrentView()) {
        setWriteReview(null);
        setError(toAdminUserFacingError(caught, "events").message);
      }
    }
  };
  const acknowledgeReviewedWrite = (found: boolean) => {
    if (!activeWriteReview?.isCurrent()) return;
    const { kind, receipt } = activeWriteReview;
    if (!(kind === "event" ? eventWrite : ticketWrite).acknowledgeIfCurrent(receipt)) return;
    setWriteReview(null);
    setError(null);
    if (!found) return;
    if (kind === "event") {
      discardEventDraft();
      setEventDialogOpen(false);
    } else {
      discardTicketDraft();
      setTicketTypeDialogOpen(false);
    }
  };
  const writeNotice = (kind: "event" | "ticket") => {
    const receipt = kind === "event" ? eventWrite : ticketWrite;
    if (receipt.status === "idle") return null;
    return (
      <Alert
        severity={
          receipt.status === "error"
            ? "warning"
            : receipt.pending
              ? "info"
              : "success"
        }
        sx={{ mb: 2 }}
        action={
          receipt.status === "success" ? (
            <Button
              disabled={submitting || submittingTicketType || refreshing}
              onClick={() => void reconcileWrite(kind)}
            >
              Load saved change
            </Button>
          ) : receipt.status === "error" ? (
            <Button onClick={() => void reviewUnconfirmedWrite(kind)}>
              Check latest list
            </Button>
          ) : undefined
        }
      >
        {receipt.pending
          ? "This save is still being confirmed. You can leave this page and return; another request will not be sent."
          : receipt.status === "success"
            ? "The previous save completed. Load the saved change before continuing."
            : "The previous save could not be confirmed and may already have completed. Check the latest list before starting another request."}
        {refreshFailure && <Box sx={{ mt: 1 }}>{refreshFailure.message}</Box>}
      </Alert>
    );
  };
  const resetWriteConfirmation = (
    <ConfirmationDialog
      open={!!activeWriteReview}
      title="Start a new save request?"
      confirmLabel="I checked — start a new request"
      onCancel={() => setWriteReview(null)}
      onConfirm={() => acknowledgeReviewedWrite(false)}
    >
      If you found the intended change in the latest list below, close this
      draft without submitting it again. Start a new request only if the change
      is absent.
      <Box component="ul">
        {(activeWriteReview?.titles ?? []).map((title, index) => (
          <li key={`${index}:${title}`}>{title}</li>
        ))}
      </Box>
      {activeWriteReview?.titles.length === 0 && <Box>The latest list is empty.</Box>}
      <Button onClick={() => acknowledgeReviewedWrite(true)} sx={{ mt: 2 }}>
        I found the saved change — close this draft
      </Button>
    </ConfirmationDialog>
  );

  const openEventDialog = (event?: EventRow | null) => {
    setEditingEvent(event ?? null);
    setError(null);
    setEventDialogOpen(true);
  };
  useEffect(() => {
    if (
      !eventDialogOpen ||
      eventForm.initialized ||
      (routeControlled && editSelector === "event" && !editingEvent)
    )
      return;
    const now = toDatetimeLocal(new Date().toISOString());
    const fields = editingEvent
      ? {
          title: editingEvent.title,
          location: editingEvent.location ?? "",
          guestOfHonour: editingEvent.guestOfHonour ?? "",
          sponsors: editingEvent.sponsors ?? "",
          details: editingEvent.details ?? "",
          startDateTime: toDatetimeLocal(editingEvent.startDateTime),
          endDateTime: toDatetimeLocal(editingEvent.endDateTime),
          bookingStartDateTime: toDatetimeLocal(
            editingEvent.bookingStartDateTime,
          ),
          bookingEndDateTime: toDatetimeLocal(editingEvent.bookingEndDateTime),
          maxGuestsStr: String(
            editingEvent.maxGuestsWithoutModeratorApproval ?? "",
          ),
        }
      : {
          ...INITIAL_EVENT_FORM,
          startDateTime: now,
          endDateTime: now,
          bookingStartDateTime: now,
          bookingEndDateTime: now,
          maxGuestsStr: "0",
        };
    updateEventForm({
      ...fields,
      initialized: true,
      baseline: formSnapshot(fields),
    });
  }, [
    eventDialogOpen,
    eventForm.initialized,
    editingEvent,
    routeControlled,
    editSelector,
    updateEventForm,
  ]);

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
      setError(
        "Max guests without moderator approval is required and must be a non-negative integer",
      );
      if (isCurrentView()) setSubmitting(false);
      return;
    }
    const maxGuestsWithoutModeratorApproval = n;
    try {
      await eventWrite.runOnce(async () => {
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
            }),
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
            }),
          );
        }
      });
      const refreshed = await refreshSavedChange(
        `Event ${editingEvent ? "updated" : "created"}`,
        () =>
          Promise.all([
            refetchEvents(),
            editingEvent && idsEqual(ticketTypesEventId, editingEvent.id)
              ? refetchEventDetail()
              : Promise.resolve(),
          ]),
      );
      if (!isCurrentView() || !refreshed) return;
      eventWrite.acknowledge();
      discardEventDraft();
      setEventDialogOpen(false);
    } catch (err: unknown) {
      if (!isCurrentView()) return;
      reportError("admin.events.save", err, {
        sectionId,
        editing: Boolean(editingEvent),
      });
      setError(toAdminUserFacingError(err, "events").message);
    } finally {
      if (isCurrentView()) setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (event: EventRow) => {
    setDeletingEventId(event.id);
    setError(null);
    try {
      await executeDataConnectMutation(
        deleteEventRef(dataConnect, { id: event.id }),
      );
    } catch (err: unknown) {
      if (!isCurrentView()) return;
      reportError("admin.events.delete", err, { sectionId, eventId: event.id });
      setDeleteError(
        String(err).includes("EVENT_HAS_TICKETS")
          ? "This event cannot be deleted because tickets already exist."
          : toAdminUserFacingError(err, "events").message,
      );
      return;
    } finally {
      deletionInFlight.current = false;
      if (isCurrentView()) setDeletingEventId(null);
    }

    if (!isCurrentView()) {
      await refetchEvents();
      return;
    }
    setDeleteConfirmationOpen(false);
    if (idsEqual(ticketTypesEventId, event.id)) setTicketTypesEventId(null);
    await refreshSavedChange(`Event "${event.title}" deleted`, async () => {
      const deletedEventKey = ["GetEventById", { id: event.id }];
      await queryClient.cancelQueries({
        queryKey: deletedEventKey,
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: deletedEventKey,
        exact: true,
        refetchType: "none",
      });
      await refetchEvents();
    });
  };

  const openTicketTypeDialog = (ticketType?: TicketTypeRow) => {
    setEditingTicketType(ticketType ?? null);
    if (routeControlled) changeEditor("ticket", ticketType?.id ?? "new");
    else setLocalTicketTypeDialogOpen(true);
  };
  useEffect(() => {
    if (!ticketTypeDialogOpen) return;
    void fetchUserGroups();
  }, [ticketTypeDialogOpen, fetchUserGroups]);
  useEffect(() => {
    if (
      !ticketTypeDialogOpen ||
      ticketForm.initialized ||
      (routeControlled && ticketSelector !== "new" && !editingTicketType)
    )
      return;
    const fields = editingTicketType
      ? {
          ttTitle: editingTicketType.title,
          ttDescription: editingTicketType.description ?? "",
          ttPrice: String(editingTicketType.price),
          ttSortOrder: String(editingTicketType.sortOrder),
          ttAudience: editingTicketType.audience,
          ttIncludesDinner: editingTicketType.includesDinner,
          ttIncludesSymposium: editingTicketType.includesSymposium,
          ttAccessGroup: editingTicketType.userGroup
            ? {
                id: editingTicketType.userGroup.id,
                name: editingTicketType.userGroup.name,
              }
            : null,
        }
      : {
          ...INITIAL_TICKET_FORM,
          ttSortOrder: String(eventDetailData?.event?.ticketTypes?.length ?? 0),
        };
    updateTicketForm({
      ...fields,
      initialized: true,
      baseline: formSnapshot(fields),
    });
  }, [
    ticketTypeDialogOpen,
    ticketForm.initialized,
    editingTicketType,
    routeControlled,
    ticketSelector,
    eventDetailData,
    updateTicketForm,
  ]);

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
      await ticketWrite.runOnce(async () => {
        if (editingTicketType) {
          await executeDataConnectMutation(
            updateTicketTypeRef(dataConnect, {
              id: editingTicketType.id,
              userGroupId: ttAccessGroup!.id as UUIDString,
              audience: ttAudience,
              title: ttTitle.trim(),
              description: ttDescription.trim() || null,
              price: priceNum,
              includesDinner: ttIncludesDinner,
              includesSymposium: ttIncludesSymposium,
              sortOrder: sortOrderNum,
            }),
          );
        } else {
          await executeDataConnectMutation(
            createTicketTypeRef(dataConnect, {
              eventId: ticketTypesEventId as UUIDString,
              userGroupId: ttAccessGroup!.id as UUIDString,
              audience: ttAudience,
              title: ttTitle.trim(),
              description: ttDescription.trim() || null,
              price: priceNum,
              includesDinner: ttIncludesDinner,
              includesSymposium: ttIncludesSymposium,
              sortOrder: sortOrderNum,
            }),
          );
        }
      });
      const refreshed = await refreshSavedChange(
        `Ticket type ${editingTicketType ? "updated" : "created"}`,
        () => Promise.all([refetchEventDetail(), refetchEvents()]),
      );
      if (!isCurrentView() || !refreshed) return;
      ticketWrite.acknowledge();
      discardTicketDraft();
      setTicketTypeDialogOpen(false);
    } catch (err: unknown) {
      if (!isCurrentView()) return;
      reportError("admin.tickets.save", err, {
        eventId: ticketTypesEventId,
        editing: Boolean(editingTicketType),
      });
      setError(toAdminUserFacingError(err, "tickets").message);
    } finally {
      if (isCurrentView()) setSubmittingTicketType(false);
    }
  };

  const handleDeleteTicketType = async (id: string) => {
    setDeletingTicketTypeId(id);
    setError(null);
    try {
      await executeDataConnectMutation(
        deleteTicketTypeRef(dataConnect, { id }),
      );
    } catch (err: unknown) {
      if (!isCurrentView()) return;
      reportError("admin.tickets.delete", err, { ticketTypeId: id });
      setDeleteError(
        String(err).includes("TICKET_TYPE_IN_USE")
          ? "This ticket type cannot be deleted because tickets already exist."
          : toAdminUserFacingError(err, "tickets").message,
      );
      return;
    } finally {
      deletionInFlight.current = false;
      if (isCurrentView()) setDeletingTicketTypeId(null);
    }

    if (!isCurrentView()) {
      await Promise.all([refetchEventDetail(), refetchEvents()]);
      return;
    }
    setDeleteConfirmationOpen(false);
    await refreshSavedChange("Ticket type deleted", () =>
      Promise.all([refetchEventDetail(), refetchEvents()]),
    );
  };

  const requestDeletion = (target: DeleteTarget) => {
    if (deletionInFlight.current) return;
    setDeleteError(null);
    setDeleteTarget(target);
    setDeleteConfirmationOpen(true);
  };

  const cancelDeletion = () => {
    if (deletionInFlight.current) return;
    setDeleteConfirmationOpen(false);
    setDeleteError(null);
  };

  const confirmDeletion = async () => {
    if (!deleteConfirmationOpen || !deleteTarget || deletionInFlight.current)
      return;
    deletionInFlight.current = true;
    setDeleteError(null);
    if (deleteTarget.kind === "event")
      await handleDeleteEvent(deleteTarget.item);
    else await handleDeleteTicketType(deleteTarget.item.id);
  };

  const deleteConfirmation = (
    <ConfirmationDialog
      open={deleteConfirmationOpen}
      title={
        deleteTarget?.kind === "event" ? "Delete event?" : "Delete ticket type?"
      }
      pending={deletingEventId !== null || deletingTicketTypeId !== null}
      error={deleteError}
      onCancel={cancelDeletion}
      onConfirm={() => void confirmDeletion()}
    >
      {deleteTarget?.kind === "event"
        ? `Delete the event “${deleteTarget.item.title}”? This will also remove its unused ticket types. Events with tickets cannot be deleted. This cannot be undone.`
        : `Delete the ticket type “${deleteTarget?.item.title ?? ""}”? Ticket types already used for tickets cannot be deleted. This cannot be undone.`}
    </ConfirmationDialog>
  );

  const events: EventRow[] = eventsData?.section?.events ?? [];
  const eventBookings = useMemo<EventBookingAdminRow[]>(
    () => eventBookingsData?.event?.bookings ?? [],
    [eventBookingsData],
  );
  const approvalBookings = useMemo(() => {
    if (approvalStatusFilter === "PENDING")
      return pendingBookingRevisions(eventBookings);
    return eventBookings
      .filter(
        (booking) =>
          approvalStatusFilter === "ALL" ||
          booking.approvalStatus === approvalStatusFilter,
      )
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
  }, [approvalStatusFilter, eventBookings]);
  const ticketOrders = useMemo<TicketOrderAdminRow[]>(
    () => ticketOrdersData?.event?.ticketOrders ?? [],
    [ticketOrdersData],
  );
  const ticketOrdersById = useMemo(
    () =>
      new Map(
        (eventBookingsData?.event?.bookingTicketOrders ?? []).map((order) => [
          order.id,
          order,
        ]),
      ),
    [eventBookingsData],
  );
  const seatingPreferenceUserNamesById = useMemo(
    () =>
      new Map(
        (seatingPreferenceUsersData?.users ?? []).map((user) => [
          user.id,
          `${user.firstName} ${user.lastName}`.trim(),
        ]),
      ),
    [seatingPreferenceUsersData],
  );
  const guestReport = useQuery({
    queryKey: ["organiser-guests", ticketTypesEventId, auth.currentUser?.uid],
    queryFn: () =>
      guestCall<GuestList>("getOrganiserGuestList", {
        eventId: ticketTypesEventId,
      }),
    enabled:
      Boolean(ticketTypesEventId) && (!routeControlled || selectedEventIsKnown),
    gcTime: 0,
  });
  const attendeeTickets = useMemo(
    () => [
      ...activeEventTicketRows(
        eventBookings,
        ticketOrdersById,
        seatingPreferenceUserNamesById,
      ),
      ...organiserGuestTicketRows(guestReport.data?.guests ?? []),
    ],
    [
      eventBookings,
      seatingPreferenceUserNamesById,
      ticketOrdersById,
      guestReport.data,
    ],
  );
  const removedTickets = useMemo(
    () =>
      activeEventTicketRows(
        eventBookings,
        ticketOrdersById,
        seatingPreferenceUserNamesById,
        "removed",
      ),
    [eventBookings, ticketOrdersById, seatingPreferenceUserNamesById],
  );
  const restoreTicket = (row: EventAttendeeTicketRow) => {
    setAddingUserTicket(false);
    setTicketEdit({ row, action: "restore" });
  };
  const bookingPaymentAdjustments: BookingPaymentAdjustmentAdminRow[] =
    paymentAdjustmentsData?.event?.bookings ?? [];

  const handleReviewBooking = async (
    booking: EventBookingAdminRow,
    decision: BookingApprovalStatus.APPROVED | BookingApprovalStatus.REJECTED,
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
      if (!isCurrentView()) {
        await refreshEventAdministration();
        return;
      }
      setModeratorNoteDraft((prev) => ({ ...prev, [booking.id]: "" }));
      await refreshSavedChange(
        `Booking revision ${decision === BookingApprovalStatus.APPROVED ? "approved" : "returned for changes"}`,
        refreshEventAdministration,
      );
    } catch (err: unknown) {
      if (!isCurrentView()) return;
      reportError("admin.booking-approval.review", err, {
        bookingId: booking.id,
        decision,
      });
      setError(toAdminUserFacingError(err, "booking-approval").message);
    } finally {
      if (isCurrentView()) setReviewingBookingId(null);
    }
  };

  if (
    routeControlled &&
    ticketTypesEventId &&
    (loadingEvents ||
      !selectedEventIsKnown ||
      (eventDetailData?.event &&
        !idsEqual(eventDetailData.event.section.id, sectionId)))
  ) {
    return (
      <Box className="page-container">
        <Alert severity={loadingEvents ? "info" : "error"}>
          {loadingEvents
            ? "Loading this section's event…"
            : "Event unavailable in this section. It may have been removed or you may not have access."}
        </Alert>
        <Button
          component={RouterLink}
          to={sectionManagementPath(sectionId, "events")}
        >
          Back to events
        </Button>
      </Box>
    );
  }
  if (
    routeControlled &&
    ticketSelector &&
    ticketSelector !== "new" &&
    !loadingEventDetail &&
    !editingTicketType
  )
    return (
      <Box className="page-container">
        <Alert severity="error">Ticket type unavailable in this event.</Alert>
        <Button onClick={() => changeEditor()}>Back to event</Button>
      </Box>
    );
  const announcing = routeControlled
    ? task === "announcement"
    : sendingAnnouncement;
  if (announcing) {
    return (
      <SendAnnouncementPage
        sectionId={sectionId}
        sectionName={sectionName}
        eventAudience={
          ticketTypesEventId
            ? routeControlled
              ? {
                  eventId: ticketTypesEventId,
                  filters: readEventAnnouncementFilters(routeLocation.search),
                }
              : (eventAnnouncement ?? {
                  eventId: ticketTypesEventId,
                  filters: emptyEventAttendeeTicketFilters,
                })
            : undefined
        }
        onBack={() => {
          if (routeControlled)
            navigate(
              ticketTypesEventId
                ? eventManagementPath(
                    sectionId,
                    ticketTypesEventId,
                    "attendees",
                  )
                : sectionManagementPath(sectionId, "events"),
            );
          else setSendingAnnouncement(false);
          setEventAnnouncement(undefined);
        }}
      />
    );
  }

  if (ticketTypesEventId) {
    const event = events.find((e) => idsEqual(e.id, ticketTypesEventId));
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
          maxGuestsWithoutModeratorApproval:
            eventDetailData.event.maxGuestsWithoutModeratorApproval,
        }
      : (event ?? null);
    const ticketTypes = eventDetailData?.event?.ticketTypes ?? [];
    return (
      <Box
        className="page-container"
        sx={{ backgroundColor: "background.default" }}
      >
        {refreshWarning}
        {routeControlled && (
          <Box
            component="nav"
            aria-label="Event management"
            sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}
          >
            {(
              [
                ["details", "Event details"],
                ["tickets", "Ticket types"],
                ["approvals", "Booking approvals"],
                ["attendees", "Attendee tickets"],
                ["guests", "Organiser guests"],
                ["activity", "Booking activity"],
                ["payments", "Payment activity"],
                ["announcement", "Announcement"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                component={RouterLink}
                to={eventManagementPath(sectionId, ticketTypesEventId, value)}
                aria-current={task === value ? "page" : undefined}
              >
                {label}
              </Button>
            ))}
          </Box>
        )}
        <TicketAdminSurface
          selectedTask={routeControlled ? task : undefined}
          taskCollapsed={searchParams.get("collapsed") === "1"}
          onTaskSelect={
            routeControlled
              ? (selected) => {
                  const next = new URLSearchParams(routeLocation.search);
                  next.set("task", selected);
                  if (
                    selected === task &&
                    searchParams.get("collapsed") !== "1"
                  )
                    next.set("collapsed", "1");
                  else next.delete("collapsed");
                  navigate({
                    pathname: routeLocation.pathname,
                    search: `?${next}`,
                  });
                }
              : undefined
          }
          eventEditorHref={
            routeControlled
              ? eventEditorPath(sectionId, ticketTypesEventId)
              : undefined
          }
          ticketEditorHref={
            routeControlled
              ? (id) => ticketEditorPath(sectionId, ticketTypesEventId, id)
              : undefined
          }
          onAnnounce={(filters) => {
            setEventAnnouncement({
              eventId: ticketTypesEventId,
              eventTitle: eventForAdmin?.title,
              filters,
            });
            if (routeControlled)
              navigate(
                eventAnnouncementPath(sectionId, ticketTypesEventId, filters),
              );
            else setSendingAnnouncement(true);
          }}
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
          onDeleteTicketType={(id) => {
            const ticketType = ticketTypes.find((row) => row.id === id);
            if (ticketType)
              requestDeletion({ kind: "ticketType", item: ticketType });
          }}
          approvalStatusFilter={approvalStatusFilter}
          onApprovalStatusFilterChange={setApprovalStatusFilter}
          approvalBookings={approvalBookings}
          allEventBookings={eventBookings}
          ticketOrdersById={ticketOrdersById}
          attendeeTickets={attendeeTickets}
          removedTickets={removedTickets}
          onManageTicket={(row, action) => setTicketEdit({ row, action })}
          onAddUserTicket={() => setAddingUserTicket(true)}
          attendeeGuestsUnavailable={
            guestReport.isPending || guestReport.isError
          }
          moderatorNoteDraft={moderatorNoteDraft}
          onModeratorNoteChange={(bookingId, value) =>
            setModeratorNoteDraft((prev) => ({ ...prev, [bookingId]: value }))
          }
          reviewingBookingId={reviewingBookingId}
          onReviewBooking={(booking, decision) =>
            void handleReviewBooking(booking, decision)
          }
          loadingEventBookings={loadingEventBookings}
          eventBookings={eventBookings}
          loadingTicketOrders={loadingTicketOrders}
          ticketOrders={ticketOrders}
          loadingPaymentAdjustments={loadingPaymentAdjustments}
          bookingPaymentAdjustments={bookingPaymentAdjustments}
        />

        {addingUserTicket && (
          <AddUserTicketDialog
            sectionId={sectionId}
            eventId={ticketTypesEventId}
            removedTickets={removedTickets}
            onRestore={restoreTicket}
            onClose={() => setAddingUserTicket(false)}
            onSaved={async () => {
              if (!isCurrentView()) {
                await refreshEventAdministration();
                return;
              }
              setAddingUserTicket(false);
              await refreshSavedChange(
                "Ticket added. The user can pay through their booking once approved.",
                refreshEventAdministration,
              );
            }}
          />
        )}
        {ticketEdit && (
          <TicketAttendanceDialog
            key={ticketEdit.row.key}
            sectionId={sectionId}
            eventId={ticketTypesEventId}
            row={ticketEdit.row}
            action={ticketEdit.action}
            ticketTypes={ticketTypes}
            onClose={() => setTicketEdit(null)}
            onSaved={async () => {
              if (!isCurrentView()) {
                await refreshEventAdministration();
                return;
              }
              setTicketEdit(null);
              await refreshSavedChange(
                ticketEdit.action === "delete"
                  ? "Ticket deleted. Transactions unchanged."
                  : ticketEdit.action === "restore"
                    ? "Ticket restored. Transactions unchanged."
                    : "Ticket saved. Transactions unchanged.",
                refreshEventAdministration,
              );
            }}
          />
        )}
        <Box hidden={routeControlled && task !== "guests"}>
          <OrganiserGuestsManager
            sectionId={sectionId}
            key={ticketTypesEventId}
            eventId={ticketTypesEventId}
          />
        </Box>

        <TicketTypeDialogSurface
          open={ticketTypeDialogOpen}
          editingTicketType={editingTicketType}
          title={ttTitle}
          description={ttDescription}
          price={ttPrice}
          sortOrder={ttSortOrder}
          audience={ttAudience}
          error={error}
          includesDinner={ttIncludesDinner}
          includesSymposium={ttIncludesSymposium}
          accessGroup={ttAccessGroup}
          userGroups={allUserGroups}
          loadingUserGroups={loadingUserGroups}
          submitting={submittingTicketType || ticketWrite.pending}
          saveDisabled={ticketWrite.status !== "idle"}
          notice={writeNotice("ticket")}
          onClose={() => {
            if (ticketWrite.status === "idle") discardTicketDraft();
            setTicketTypeDialogOpen(false);
          }}
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
          submitting={submitting || eventWrite.pending}
          saveDisabled={eventWrite.status !== "idle"}
          notice={writeNotice("event")}
          error={error}
          onClose={() => {
            if (eventWrite.status === "idle") discardEventDraft();
            setEventDialogOpen(false);
          }}
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

        {resetWriteConfirmation}
        {deleteConfirmation}
        <SnackbarAlert snackbar={snackbar} onClose={closeSnackbar} />
      </Box>
    );
  }

  return (
    <Box
      className="page-container"
      sx={{ backgroundColor: "background.default" }}
    >
      {refreshWarning}
      <EventListSurface
        sectionName={sectionName}
        onBack={onBack}
        error={error}
        onDismissError={() => setError(null)}
        onAddEvent={() => openEventDialog()}
        onSendAnnouncement={() =>
          routeControlled
            ? navigate(sectionManagementPath(sectionId, "announcements"))
            : setSendingAnnouncement(true)
        }
        loadingEvents={loadingEvents}
        errorEvents={errorEvents}
        events={events}
        deletingEventId={deletingEventId}
        onManageEventAdmin={setTicketTypesEventId}
        eventAdminHref={
          routeControlled
            ? (id) => eventManagementPath(sectionId, id)
            : undefined
        }
        addEventHref={routeControlled ? eventEditorPath(sectionId) : undefined}
        onDeleteEvent={(event) =>
          requestDeletion({ kind: "event", item: event })
        }
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
        submitting={submitting || eventWrite.pending}
        saveDisabled={eventWrite.status !== "idle"}
        notice={writeNotice("event")}
        error={error}
        onClose={() => {
          if (eventWrite.status === "idle") discardEventDraft();
          setEventDialogOpen(false);
        }}
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

      {resetWriteConfirmation}
      {deleteConfirmation}
      <SnackbarAlert snackbar={snackbar} onClose={closeSnackbar} />
    </Box>
  );
}
