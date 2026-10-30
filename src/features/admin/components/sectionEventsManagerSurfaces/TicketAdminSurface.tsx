import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { Guest } from "../../../guests/api";
import { money } from "../../../guests/api";
import { getEventWorkspaceSummary, getSettledEventPayments } from "../../utils/eventWorkspaceSummary";
import { BookingApprovalStatus } from "@dataconnect/generated";
import PageHeader from "../../../../shared/components/PageHeader";
import { getTicketCategoryLabel, TICKET_CATEGORY_LABEL } from "../../../../shared/utils/ticketAudienceLabels";
import { getMembershipStatusLabel } from "../../../../shared/utils/membershipStatusLabels";
import type {
  EventBookingAdminRow,
  EventRow,
  BookingApprovalStatusFilter,
  BookingPaymentAdjustmentAdminRow,
  TicketOrderAdminRow,
  TicketTypeRow,
} from "../sectionEventsManagerTypes";
import SafeMarkdown from "../../../../shared/components/SafeMarkdown";
import type { EventAttendeeTicketRow, TicketOrdersById } from "../../utils/bookingApprovalsAdmin";
import {
  attendeePaymentState,
  currentActiveBookings,
  emptyEventAttendeeTicketFilters,
  eventTicketRowsCsv,
  filterEventAttendeeTicketRows,
  previousActiveBooking,
  uniqueEventAttendeeEmails,
} from "../../utils/bookingApprovalsAdmin";
import type { EventAttendeeTicketFilters } from "../../utils/bookingApprovalsAdmin";
import {
  DEFAULT_ATTENDEE_EMAIL_SEPARATOR,
  readAttendeeEmailSeparator,
  writeAttendeeEmailSeparator,
  type AttendeeEmailSeparator,
} from "../../utils/attendeeEmailSeparatorPreference";
import { useCookiePreferences } from "../../../../shared/cookies/CookiePreferencesContext";
import { AdminAccordion, AdminTable } from "./adminSurfacePrimitives";
import RemovedTicketsSection from "../RemovedTicketsSection";

import type { EventManagementTask } from "../../../../shared/navigation/sectionRoutes";

export type EventPaymentView = "required" | "all";

interface TicketAdminSurfaceProps {
  savedReviewDecisions?: Readonly<Record<string, number>>;
  organiserGuests?: Guest[];
  paymentDataUnavailable?: boolean;
  settledPaymentsUnavailable?: boolean;
  seatingPreferenceUserNamesById?: ReadonlyMap<string, string>;
  taskHref?: (task: EventManagementTask) => string;
  paymentView?: EventPaymentView;
  onPaymentViewChange?: (view: EventPaymentView) => void;
  onContactUnpaid?: () => void;
  selectedTask?: EventManagementTask;
  taskCollapsed?: boolean;
  onTaskSelect?: (task: EventManagementTask) => void;
  eventEditorHref?: string;
  ticketEditorHref?: (ticketId?: string) => string;
  event: EventRow | null;
  eventTitle: string;
  error: string | null;
  onDismissError: () => void;
  onBack: () => void;
  onEditEvent: (event: EventRow) => void;
  onAddTicketType: () => void;
  loadingEventDetail: boolean;
  ticketTypes: TicketTypeRow[];
  deletingTicketTypeId: string | null;
  onEditTicketType: (ticketType: TicketTypeRow) => void;
  onDeleteTicketType: (id: string) => void;
  approvalStatusFilter: BookingApprovalStatusFilter;
  onApprovalStatusFilterChange: (value: BookingApprovalStatusFilter) => void;
  approvalBookings: EventBookingAdminRow[];
  allEventBookings: EventBookingAdminRow[];
  ticketOrdersById: TicketOrdersById;
  attendeeTickets: EventAttendeeTicketRow[];
  removedTickets?: EventAttendeeTicketRow[];
  attendeeGuestsUnavailable?: boolean;
  onAnnounce?: (filters: EventAttendeeTicketFilters) => void;
  onManageTicket?: (row: EventAttendeeTicketRow, action: "edit" | "delete" | "restore") => void;
  onAddUserTicket?: () => void;
  moderatorNoteDraft: Record<string, string>;
  onModeratorNoteChange: (bookingId: string, value: string) => void;
  reviewingBookingId: string | null;
  onReviewBooking: (
    booking: EventBookingAdminRow,
    decision: BookingApprovalStatus.APPROVED | BookingApprovalStatus.REJECTED
  ) => void;
  loadingEventBookings: boolean;
  eventBookings: EventBookingAdminRow[];
  loadingTicketOrders: boolean;
  ticketOrders: TicketOrderAdminRow[];
  loadingPaymentAdjustments: boolean;
  bookingPaymentAdjustments: BookingPaymentAdjustmentAdminRow[];
}
export function TicketAdminSurface({
  selectedTask, taskCollapsed, onTaskSelect, eventEditorHref, ticketEditorHref,
  taskHref, paymentView, onPaymentViewChange, onContactUnpaid, organiserGuests = [], seatingPreferenceUserNamesById, paymentDataUnavailable = false, savedReviewDecisions, settledPaymentsUnavailable = false,
  event,
  eventTitle,
  error,
  onDismissError,
  onBack,
  onEditEvent,
  onAddTicketType,
  loadingEventDetail,
  ticketTypes,
  deletingTicketTypeId,
  onEditTicketType,
  onDeleteTicketType,
  approvalStatusFilter,
  onApprovalStatusFilterChange,
  approvalBookings,
  allEventBookings,
  ticketOrdersById,
  attendeeTickets,
  removedTickets = [],
  attendeeGuestsUnavailable,
  onManageTicket,
  onAnnounce,
  onAddUserTicket,
  moderatorNoteDraft,
  onModeratorNoteChange,
  reviewingBookingId,
  onReviewBooking,
  loadingEventBookings,
  eventBookings,
  loadingTicketOrders,
  ticketOrders,
  loadingPaymentAdjustments,
  bookingPaymentAdjustments,
}: TicketAdminSurfaceProps) {
  const ticketTypesPanel = <>
    <Button startIcon={<AddIcon />} variant="contained" {...(ticketEditorHref ? { component: RouterLink, to: ticketEditorHref() } : { onClick: onAddTicketType })} sx={{ mb: 2 }}>
      Add ticket type
    </Button>
    <TicketTypesTable editorHref={ticketEditorHref} loading={loadingEventDetail} ticketTypes={ticketTypes}
      deletingTicketTypeId={deletingTicketTypeId} onEdit={onEditTicketType} onDelete={onDeleteTicketType} />
  </>;
  const approvalsPanel = <BookingApprovalsSection filter={approvalStatusFilter} onFilterChange={onApprovalStatusFilterChange}
    loading={loadingEventBookings} bookings={approvalBookings} allBookings={allEventBookings} ticketOrdersById={ticketOrdersById}
    moderatorNoteDraft={moderatorNoteDraft} onModeratorNoteChange={onModeratorNoteChange} reviewingBookingId={reviewingBookingId}
    onReview={onReviewBooking} reviewDialog={Boolean(selectedTask)} error={error} seatingPreferenceUserNamesById={seatingPreferenceUserNamesById} savedReviewDecisions={savedReviewDecisions} />;
  const attendeesPanel = <>
    {onAddUserTicket && <Button startIcon={<AddIcon />} variant="contained" sx={{ mb: 2 }} onClick={onAddUserTicket}>Add ticket</Button>}
    {attendeeGuestsUnavailable
      ? <Alert severity="info">Waiting for organiser guests. The complete ticket report will be available once their list loads.</Alert>
      : <EventAttendeeTicketsSection eventTitle={eventTitle} loading={loadingEventBookings} rows={attendeeTickets} onManageTicket={onManageTicket} onAnnounce={onAnnounce} />}
  </>;
  const removedPanel = loadingEventBookings ? <CircularProgress size={22} /> : <>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Restore a ticket to return someone to the attendee list. Payment records stay unchanged.</Typography>
    {removedTickets.length === 0 ? <Alert severity="info">No removed tickets for this event.</Alert> : <Stack spacing={2}>
      {removedTickets.map((row) => <Box key={row.key} sx={recordCardSx}>
        <Typography fontWeight={600}>{row.attendeeName}</Typography>
        <Typography variant="body2" color="text.secondary">{row.ticketType}</Typography>
        {onManageTicket && <Button sx={{ mt: 1 }} onClick={() => onManageTicket(row, "restore")} aria-label={`Restore ticket for ${row.attendeeName}`}>Restore ticket</Button>}
      </Box>)}
    </Stack>}
  </>;
  const paymentsPanel = <PaymentActivitySection loading={loadingTicketOrders || loadingPaymentAdjustments || loadingEventBookings}
    ticketOrders={ticketOrders} bookingPaymentAdjustments={bookingPaymentAdjustments} bookings={allEventBookings}
    ticketOrdersById={ticketOrdersById} organiserGuests={organiserGuests} dataUnavailable={paymentDataUnavailable} settledPaymentsUnavailable={settledPaymentsUnavailable} taskHref={taskHref} view={paymentView ?? (!selectedTask ? "all" : undefined)} onViewChange={onPaymentViewChange} onContactUnpaid={onContactUnpaid} />;
  const detailsPanel = <EventDetailsSection event={event} loading={loadingEventDetail} onEditEvent={onEditEvent} editorHref={eventEditorHref} />;
  const activityPanel = <BookingAuditSection loading={loadingEventBookings} bookings={eventBookings} />;

  if (selectedTask) {
    const ticketTask = selectedTask === "tickets" || selectedTask === "attendees" || selectedTask === "removed";
    const panels = { details: detailsPanel, tickets: ticketTypesPanel, approvals: approvalsPanel, attendees: attendeesPanel,
      removed: removedPanel, activity: activityPanel, payments: paymentsPanel };
    const taskHeading = ticketTask ? "Tickets & attendees" : ({ details: "Details", approvals: "Approvals", payments: "Payments", activity: "Activity" } as const)[selectedTask as "details" | "approvals" | "payments" | "activity"];
    return <Box sx={{ minWidth: 0 }}>
      {taskHeading && <Typography component="h2" variant="h5" sx={{ mb: 2 }}>{taskHeading}</Typography>}
      {ticketTask && <Box sx={{ mb: 3 }}>
        <Tabs value={selectedTask} aria-label="Tickets and attendees" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {([{ value: "attendees", label: "Attendees" }, { value: "tickets", label: "Ticket types" }, { value: "removed", label: "Removed" }] as const).map(({ value, label }) =>
            <Tab key={value} value={value} label={label} {...(taskHref ? { component: RouterLink, to: taskHref(value) } : { onClick: () => onTaskSelect?.(value) })} />)}
        </Tabs>
        {(taskHref || onTaskSelect) && <Button size="small" sx={{ mt: 1 }} {...(taskHref ? { component: RouterLink, to: taskHref("guests") } : { onClick: () => onTaskSelect?.("guests") })}>Manage organiser guests</Button>}
      </Box>}
      {selectedTask in panels ? panels[selectedTask as keyof typeof panels] : null}
    </Box>;
  }
  return <>
    <PageHeader title={`Event admin: ${eventTitle}`} onBack={onBack} />
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={onDismissError}>{error}</Alert>}
    <AdminAccordion title="Event details" expanded={taskCollapsed ? false : undefined} onToggle={onTaskSelect ? () => onTaskSelect("details") : undefined}>{detailsPanel}</AdminAccordion>
    <AdminAccordion title="Ticket types" onToggle={onTaskSelect ? () => onTaskSelect("tickets") : undefined}>{ticketTypesPanel}</AdminAccordion>
    <AdminAccordion title="Booking approvals" onToggle={onTaskSelect ? () => onTaskSelect("approvals") : undefined}>{approvalsPanel}</AdminAccordion>
    <AdminAccordion title="Current attendee tickets" onToggle={onTaskSelect ? () => onTaskSelect("attendees") : undefined}>
      {attendeesPanel}
      {!loadingEventBookings && onManageTicket && <RemovedTicketsSection rows={removedTickets} onRestore={(row) => onManageTicket(row, "restore")} />}
    </AdminAccordion>
    <AdminAccordion title="Booking audit activity" onToggle={onTaskSelect ? () => onTaskSelect("activity") : undefined}>{activityPanel}</AdminAccordion>
    <AdminAccordion title="Payment status activity" onToggle={onTaskSelect ? () => onTaskSelect("payments") : undefined}>{paymentsPanel}</AdminAccordion>
  </>;
}

const recordCardSx = { p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, minWidth: 0, overflowWrap: "anywhere" } as const;

function RecordField({ label, children }: { label: string; children: ReactNode }) {
  return <Box sx={{ minWidth: 0 }}><Typography component="dt" variant="caption" color="text.secondary">{label}</Typography><Box component="dd" sx={{ m: 0, overflowWrap: "anywhere" }}>{children}</Box></Box>;
}

function EventDetailsSection({
  editorHref,
  event,
  loading,
  onEditEvent,
}: {
  editorHref?: string;
  event: EventRow | null;
  loading: boolean;
  onEditEvent: (event: EventRow) => void;
}) {
  if (loading && !event) {
    return <CircularProgress size={22} />;
  }

  if (!event) {
    return <Alert severity="info">Event details are not available.</Alert>;
  }
  const details = event.details?.trim();

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button size="small" startIcon={<EditIcon />} variant="outlined" {...(editorHref ? {component:RouterLink,to:editorHref} : {onClick:()=>onEditEvent(event)})}>
          Edit event details
        </Button>
      </Box>
      <Stack spacing={3}>
        <Box sx={recordCardSx}>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>Event information</Typography>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, m: 0 }}>
            <RecordField label="Title">{event.title}</RecordField>
            <RecordField label="Location">{event.location || "—"}</RecordField>
            <RecordField label="Date / time">{new Date(event.startDateTime).toLocaleString()} – {new Date(event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</RecordField>
            <RecordField label="Guest of honour">{event.guestOfHonour || "—"}</RecordField>
            <RecordField label="Sponsors"><Box sx={{ whiteSpace: "pre-line" }}>{event.sponsors?.trim() || "—"}</Box></RecordField>
          </Box>
        </Box>
        <Box sx={recordCardSx}>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>Booking settings</Typography>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, m: 0 }}>
            <RecordField label="Booking opens">{new Date(event.bookingStartDateTime).toLocaleString()}</RecordField>
            <RecordField label="Booking closes">{new Date(event.bookingEndDateTime).toLocaleString()}</RecordField>
            <RecordField label="Max guests without moderator approval">{event.maxGuestsWithoutModeratorApproval ?? "—"}</RecordField>
          </Box>
        </Box>
        <Box sx={recordCardSx}>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>Description</Typography>
          {details ? <SafeMarkdown>{details}</SafeMarkdown> : <Typography color="text.secondary">No event description.</Typography>}
        </Box>
      </Stack>
    </Box>
  );
}

export function TicketTypesTable({
  editorHref,
  loading,
  ticketTypes,
  deletingTicketTypeId,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  ticketTypes: TicketTypeRow[];
  deletingTicketTypeId: string | null;
  editorHref?: (ticketId: string) => string;
  onEdit: (ticketType: TicketTypeRow) => void;
  onDelete: (id: string) => void;
}) {
  const compact = useMediaQuery("(max-width: 899px)");
  if (loading) {
    return <CircularProgress />;
  }

  if (ticketTypes.length === 0) return <Alert severity="info">No ticket types yet. Add a ticket type to make it available for booking.</Alert>;
  if (compact) return <Stack spacing={2}>
    {ticketTypes.map((ticketType) => <Box key={ticketType.id} sx={recordCardSx}>
      <Typography component="h3" fontWeight={700}>{ticketType.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{ticketType.description || "No description"}</Typography>
      <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, m: 0 }}>
        <RecordField label="Price">{money(Math.round(ticketType.price * 100))}</RecordField>
        <RecordField label={TICKET_CATEGORY_LABEL}>{getTicketCategoryLabel(ticketType.audience)}</RecordField>
        <RecordField label="Dinner">{ticketType.includesDinner ? "Yes" : "No"}</RecordField>
        <RecordField label="Symposium">{ticketType.includesSymposium ? "Yes" : "No"}</RecordField>
        <RecordField label="Access group">{ticketType.userGroup?.name || "—"}</RecordField>
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
        <Button startIcon={<EditIcon />} aria-label={`Edit ${ticketType.title}`} {...(editorHref ? { component: RouterLink, to: editorHref(ticketType.id) } : { onClick: () => onEdit(ticketType) })}>Edit</Button>
        <Button color="error" startIcon={deletingTicketTypeId === ticketType.id ? <CircularProgress size={16} /> : <DeleteIcon />} aria-label={`Delete ${ticketType.title}`} disabled={deletingTicketTypeId === ticketType.id} onClick={() => onDelete(ticketType.id)}>Delete</Button>
      </Stack>
    </Box>)}
  </Stack>;

  return (
    <AdminTable>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>{TICKET_CATEGORY_LABEL}</TableCell>
            <TableCell>Dinner</TableCell>
            <TableCell>Symposium</TableCell>
            <TableCell>Access group</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ticketTypes.map((ticketType) => (
            <TableRow key={ticketType.id}>
              <TableCell>{ticketType.title}</TableCell>
              <TableCell>{ticketType.description ?? "—"}</TableCell>
              <TableCell>{ticketType.price}</TableCell>
              <TableCell>{getTicketCategoryLabel(ticketType.audience)}</TableCell>
              <TableCell>{ticketType.includesDinner ? "Yes" : "No"}</TableCell>
              <TableCell>{ticketType.includesSymposium ? "Yes" : "No"}</TableCell>
              <TableCell>
                {ticketType.userGroup ? (
                  <Chip label={ticketType.userGroup.name} size="small" variant="outlined" color="primary" />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  aria-label={`Edit ${ticketType.title}`}
                  {...(editorHref ? {component:RouterLink,to:editorHref(ticketType.id)} : {onClick:()=>onEdit(ticketType)})}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  aria-label={`Delete ${ticketType.title}`}
                  disabled={deletingTicketTypeId === ticketType.id}
                  onClick={() => onDelete(ticketType.id)}
                >
                  {deletingTicketTypeId === ticketType.id ? <CircularProgress size={16} /> : <DeleteIcon />}
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
    </AdminTable>
  );
}

const bookingApprovalActionsCellSx = {
  whiteSpace: "nowrap",
  verticalAlign: "top",
  minWidth: 168,
  width: 168,
} as const;

interface BookingApprovalsProps {
  filter: BookingApprovalStatusFilter;
  onFilterChange: (value: BookingApprovalStatusFilter) => void;
  loading: boolean;
  bookings: EventBookingAdminRow[];
  allBookings: EventBookingAdminRow[];
  ticketOrdersById: TicketOrdersById;
  moderatorNoteDraft: Record<string, string>;
  onModeratorNoteChange: (bookingId: string, value: string) => void;
  reviewingBookingId: string | null;
  onReview: (booking: EventBookingAdminRow, decision: BookingApprovalStatus.APPROVED | BookingApprovalStatus.REJECTED) => void;
  seatingPreferenceUserNamesById?: ReadonlyMap<string, string>;
  savedReviewDecisions?: Readonly<Record<string, number>>;
  reviewDialog?: boolean;
  error?: string | null;
}

function BookingRevisionSnapshot({ booking, ticketOrdersById, seatingPreferenceUserNamesById }: { booking: EventBookingAdminRow; ticketOrdersById: TicketOrdersById; seatingPreferenceUserNamesById?: ReadonlyMap<string, string> }) {
  return <Box sx={recordCardSx}>
    <Typography fontWeight={700}>Revision {booking.revisionNumber}</Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>{booking.booker.firstName} {booking.booker.lastName} · {booking.booker.email}</Typography>
    <Box component="ul" sx={{ pl: 2.5, my: 1 }}>
      {[...booking.lines].sort((left, right) => left.sortOrder - right.sortOrder).map((line) => <Box component="li" key={line.id} sx={{ mb: 1.5 }}>
        <Typography fontWeight={600}>{line.guestDisplayName || (line.guestUser ? `${line.guestUser.firstName} ${line.guestUser.lastName}` : line.ticketType.audience === "MEMBER" ? `${booking.booker.firstName} ${booking.booker.lastName}` : "Guest")}</Typography>
        <Typography variant="body2">{line.ticketType.title} · {money(Math.round(line.ticketType.price * 100))}</Typography>
        {line.bookingPlace?.attendanceRemoved && <Chip size="small" variant="outlined" label="Removed from attendance" sx={{ my: 0.5 }} />}
        <Typography variant="body2">Dinner: {line.ticketType.includesDinner ? "Yes" : "No"} · Symposium: {line.ticketType.includesSymposium ? "Yes" : "No"}</Typography>
        <Typography variant="body2">Dietary: {line.dietaryNote || "None recorded"}</Typography>
        <Typography variant="body2" color="text.secondary">Payment: {titleCaseStatus(attendeePaymentState(line, ticketOrdersById))}</Typography>
      </Box>)}
    </Box>
    <Typography variant="body2">Accommodation: {booking.accommodationRequested ? "Requested" : "Not requested"}{booking.accommodationNote ? ` · ${booking.accommodationNote}` : ""}</Typography>
    <Typography variant="body2">Seating preferences: {booking.sitNextToUserIds?.length ? seatingPreferenceUserNamesById ? booking.sitNextToUserIds.map((id) => seatingPreferenceUserNamesById.get(id) ?? "Unavailable member").join(", ") : `${booking.sitNextToUserIds.length} member preference${booking.sitNextToUserIds.length === 1 ? "" : "s"} recorded` : "None recorded"}</Typography>
  </Box>;
}

function RevisionFinancialPreview({ previous, proposed, ticketOrdersById }: { previous: EventBookingAdminRow | null; proposed: EventBookingAdminRow; ticketOrdersById: TicketOrdersById }) {
  const total = (booking: EventBookingAdminRow | null) => (booking?.lines ?? []).reduce((amount, line) => amount + Math.round(line.ticketType.price * 100), 0);
  const allocations = (previous?.lines ?? []).flatMap((line) => line.bookingPlace?.paymentAllocations ?? []);
  const includesRemovedPlaces = [...(previous?.lines ?? []), ...proposed.lines].some((line) => line.bookingPlace?.attendanceRemoved);
  const unknown = allocations.some((allocation) => !ticketOrdersById.has(allocation.ticketOrderId));
  const settled = allocations.reduce((amount, allocation) => {
    const status = ticketOrdersById.get(allocation.ticketOrderId)?.status;
    return amount + (status === "PAID" || status === "REFUNDED" ? Math.max(0, allocation.allocatedAmountMinor - allocation.refundedAmountMinor) : 0);
  }, 0);
  const outstanding = Math.max(0, total(proposed) - settled);
  const refundDue = Math.max(0, settled - total(proposed));
  return <Box sx={recordCardSx}>
    <Typography component="h3" variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Financial effect</Typography>
    <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, m: 0 }}>
      <RecordField label="Previous ticket total">{previous ? money(total(previous)) : "No previous booking"}</RecordField>
      <RecordField label="Proposed ticket total">{money(total(proposed))}</RecordField>
      <RecordField label="Net payment already settled">{unknown ? "Payment records incomplete" : money(settled)}</RecordField>
      <RecordField label={refundDue > 0 ? "Estimated refund due" : "Estimated booking balance after approval"}>{unknown ? "Unavailable until payment records load" : money(refundDue || outstanding)}</RecordField>
    </Box>
    {includesRemovedPlaces && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>This estimate includes the complete booking revision. Payments shows the places currently eligible for payment.</Typography>}
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Approval and payment are separate. The payment service checks the final balance and applies the existing payment or refund process.</Typography>
  </Box>;
}

function BookingApprovalsSection(props: BookingApprovalsProps) {
  const { filter, onFilterChange, loading, bookings, allBookings, ticketOrdersById, moderatorNoteDraft, onModeratorNoteChange, reviewingBookingId, onReview, reviewDialog, error, seatingPreferenceUserNamesById, savedReviewDecisions } = props;
  const compact = useMediaQuery("(max-width: 899px)");
  const [reviewed, setReviewed] = useState<EventBookingAdminRow | null>(null);
  if (!reviewDialog) return <LegacyBookingApprovalsSection {...props} />;
  const current = reviewed ? allBookings.find((booking) => booking.id === reviewed.id) : undefined;
  const completed = reviewed?.approvalStatus === BookingApprovalStatus.PENDING && current && current.approvalStatus !== BookingApprovalStatus.PENDING;
  const currentPending = Boolean(reviewed && current && current.revisionNumber === reviewed.revisionNumber && current.approvalStatus === BookingApprovalStatus.PENDING && (current.status === "SUBMITTED" || current.status === "CONFIRMED") && current.supersededAt == null && !allBookings.some((booking) => booking.revisionGroupId === reviewed.revisionGroupId && booking.revisionNumber > reviewed.revisionNumber && booking.supersededAt == null));
  const savedDecision = Boolean(reviewed && savedReviewDecisions?.[reviewed.id] === reviewed.revisionNumber);
  const previous = reviewed ? previousActiveBooking(reviewed, allBookings) : null;
  const filterControl = <FormControl size="small" sx={{ minWidth: 170 }}>
    <InputLabel id="booking-approval-filter-label">Status filter</InputLabel>
    <Select labelId="booking-approval-filter-label" label="Status filter" value={filter} onChange={(event) => onFilterChange(event.target.value as BookingApprovalStatusFilter)}>
      <MenuItem value="PENDING">Pending</MenuItem><MenuItem value="APPROVED">Approved</MenuItem><MenuItem value="REJECTED">Rejected</MenuItem><MenuItem value="ALL">All</MenuItem>
    </Select>
  </FormControl>;
  const reviewButton = (booking: EventBookingAdminRow) => <Button variant={booking.approvalStatus === BookingApprovalStatus.PENDING ? "contained" : "outlined"} size="small" disabled={Boolean(reviewingBookingId)} onClick={() => setReviewed(booking)}>{booking.approvalStatus === BookingApprovalStatus.PENDING ? "Review change" : "View revision"}</Button>;
  return <Box>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}>
      <Typography variant="body2" color="text.secondary">Review the complete booking and its financial effect before deciding on the exact revision.</Typography>
      {filterControl}
    </Stack>
    {loading ? <CircularProgress size={22} /> : bookings.length === 0 ? <Alert severity="info">No booking revisions for this filter.</Alert> : compact ? <Stack spacing={2}>
      {bookings.map((booking) => <Box key={booking.id} sx={recordCardSx}>
        <Typography component="h3" fontWeight={700}>{booking.booker.firstName} {booking.booker.lastName}</Typography>
        <Typography variant="body2" color="text.secondary">{booking.booker.email}</Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 1 }}><Chip size="small" label={`Revision ${booking.revisionNumber}`} /><Chip size="small" label={titleCaseStatus(booking.approvalStatus)} color={approvalStatusColor(booking.approvalStatus)} /></Stack>
        <Typography variant="body2" sx={{ mb: 1 }}>{booking.lines.length} ticket{booking.lines.length === 1 ? "" : "s"} · Submitted {new Date(booking.createdAt).toLocaleString()}</Typography>
        {reviewButton(booking)}
      </Box>)}
    </Stack> : <AdminTable minWidth={700}>
      <TableHead><TableRow><TableCell>Booker</TableCell><TableCell>Revision</TableCell><TableCell>Approval</TableCell><TableCell>Tickets</TableCell><TableCell>Submitted</TableCell><TableCell>Review</TableCell></TableRow></TableHead>
      <TableBody>{bookings.map((booking) => <TableRow key={booking.id}>
        <TableCell><Typography variant="body2">{booking.booker.firstName} {booking.booker.lastName}</Typography><Typography variant="caption" color="text.secondary">{booking.booker.email}</Typography></TableCell>
        <TableCell>Rev {booking.revisionNumber}</TableCell><TableCell><Chip size="small" label={titleCaseStatus(booking.approvalStatus)} color={approvalStatusColor(booking.approvalStatus)} /></TableCell>
        <TableCell>{booking.lines.length}</TableCell><TableCell>{new Date(booking.createdAt).toLocaleString()}</TableCell><TableCell>{reviewButton(booking)}</TableCell>
      </TableRow>)}</TableBody>
    </AdminTable>}
    <Dialog open={Boolean(reviewed) && !completed} onClose={() => { if (!reviewingBookingId || savedDecision) setReviewed(null); }} maxWidth="md" fullWidth fullScreen={compact} aria-labelledby="booking-revision-review-title">
      {reviewed && <>
        <DialogTitle id="booking-revision-review-title">{reviewed.approvalStatus === BookingApprovalStatus.PENDING ? "Review booking change" : "Booking revision"} · Revision {reviewed.revisionNumber}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {savedDecision && <Alert severity="info" sx={{ mb: 2 }}>Decision saved. Close this review and use Retry refresh to load the updated list.</Alert>}
          {reviewed.approvalStatus === BookingApprovalStatus.PENDING && !currentPending && <Alert severity="warning" sx={{ mb: 2 }}>This revision has changed or is no longer awaiting review. Close this review and reload the current list before deciding.</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2 }}>
            <Box><Typography component="h3" variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Previous active booking</Typography>{previous ? <BookingRevisionSnapshot booking={previous} ticketOrdersById={ticketOrdersById} seatingPreferenceUserNamesById={seatingPreferenceUserNamesById} /> : <Alert severity="info">No previous active booking.</Alert>}</Box>
            <Box><Typography component="h3" variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Proposed booking</Typography><BookingRevisionSnapshot booking={reviewed} ticketOrdersById={ticketOrdersById} seatingPreferenceUserNamesById={seatingPreferenceUserNamesById} /></Box>
          </Box>
          <RevisionFinancialPreview previous={previous} proposed={reviewed} ticketOrdersById={ticketOrdersById} />
          {reviewed.approvalStatus === BookingApprovalStatus.PENDING ? <TextField label="Moderator note" helperText="Include a reason when requesting changes. Your draft stays available while you move between event tasks." multiline minRows={3} fullWidth sx={{ mt: 2 }} value={moderatorNoteDraft[reviewed.id] ?? ""} onChange={(event) => onModeratorNoteChange(reviewed.id, event.target.value)} disabled={reviewingBookingId === reviewed.id || savedDecision} /> : <Box sx={{ mt: 2 }}><Typography fontWeight={700}>Moderator note</Typography><Typography>{reviewed.approvalNote || "No note recorded."}</Typography><Typography variant="caption">{reviewed.approvalReviewedAt ? `Reviewed ${new Date(reviewed.approvalReviewedAt).toLocaleString()}` : "Review date unavailable"}{reviewed.approvalReviewedBy ? ` by ${reviewed.approvalReviewedBy.firstName} ${reviewed.approvalReviewedBy.lastName}` : ""}</Typography></Box>}
        </DialogContent>
        <DialogActions sx={{ p: 2, flexWrap: "wrap", gap: 1 }}>
          <Button disabled={Boolean(reviewingBookingId) && !savedDecision} onClick={() => setReviewed(null)}>Close review</Button>
          {reviewed.approvalStatus === BookingApprovalStatus.PENDING && <>
            <Button color="error" variant="outlined" disabled={!currentPending || Boolean(reviewingBookingId) || savedDecision} onClick={() => onReview(reviewed, BookingApprovalStatus.REJECTED)}>Request changes</Button>
            <Button color="success" variant="contained" disabled={!currentPending || Boolean(reviewingBookingId) || savedDecision} onClick={() => onReview(reviewed, BookingApprovalStatus.APPROVED)}>{reviewingBookingId === reviewed.id ? "Saving decision…" : "Approve revision"}</Button>
          </>}
        </DialogActions>
      </>}
    </Dialog>
  </Box>;
}

function LegacyBookingApprovalsSection({
  filter,
  onFilterChange,
  loading,
  bookings,
  allBookings,
  ticketOrdersById,
  moderatorNoteDraft,
  onModeratorNoteChange,
  reviewingBookingId,
  onReview,
}: {
  filter: BookingApprovalStatusFilter;
  onFilterChange: (value: BookingApprovalStatusFilter) => void;
  loading: boolean;
  bookings: EventBookingAdminRow[];
  allBookings: EventBookingAdminRow[];
  ticketOrdersById: TicketOrdersById;
  moderatorNoteDraft: Record<string, string>;
  onModeratorNoteChange: (bookingId: string, value: string) => void;
  reviewingBookingId: string | null;
  onReview: (
    booking: EventBookingAdminRow,
    decision: BookingApprovalStatus.APPROVED | BookingApprovalStatus.REJECTED
  ) => void;
}) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Review one complete booking revision. Decisions are checked against the exact revision shown here.
        </Typography>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="booking-approval-filter-label">Status filter</InputLabel>
          <Select
            labelId="booking-approval-filter-label"
            label="Status filter"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as BookingApprovalStatusFilter)}
          >
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="REJECTED">Rejected</MenuItem>
            <MenuItem value="ALL">All</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {loading ? (
        <CircularProgress size={22} />
      ) : bookings.length === 0 ? (
        <Alert severity="info">No booking revisions for this filter.</Alert>
      ) : (
        <AdminTable minWidth={1180}>
            <TableHead>
              <TableRow>
                <TableCell sx={bookingApprovalActionsCellSx}>Actions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Booker</TableCell>
                <TableCell>Revision</TableCell>
                <TableCell sx={{ minWidth: 300 }}>Complete booking</TableCell>
                <TableCell>Previous active</TableCell>
                <TableCell sx={{ minWidth: 180, maxWidth: 220 }}>Moderator note</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Submitted</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Reviewed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bookings.map((booking) => {
                const previous = previousActiveBooking(booking, allBookings);
                return (
                <TableRow key={booking.id} sx={{ verticalAlign: "top" }}>
                  <TableCell sx={bookingApprovalActionsCellSx}>
                    {booking.approvalStatus === BookingApprovalStatus.PENDING ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "stretch" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          disabled={reviewingBookingId === booking.id}
                          onClick={() => onReview(booking, BookingApprovalStatus.APPROVED)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={reviewingBookingId === booking.id}
                          onClick={() => onReview(booking, BookingApprovalStatus.REJECTED)}
                        >
                          Request changes
                        </Button>
                      </Box>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={booking.approvalStatus.replaceAll("_", " ")} color={approvalStatusColor(booking.approvalStatus)} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Box>{`${booking.booker.firstName} ${booking.booker.lastName}`}</Box>
                    <Typography variant="caption" color="text.secondary">{booking.booker.email}</Typography>
                  </TableCell>
                  <TableCell>Rev {booking.revisionNumber}</TableCell>
                  <TableCell>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {[...booking.lines].sort((a, b) => a.sortOrder - b.sortOrder).map((line) => (
                        <Box component="li" key={line.id} sx={{ mb: 0.5 }}>
                          <strong>{line.guestDisplayName || (line.ticketType.audience === "MEMBER" ? "Member" : "Guest")}</strong>
                          {` — ${line.ticketType.title}`}
                          {line.dietaryNote ? ` · Dietary: ${line.dietaryNote}` : ""}
                          {` · Payment: ${attendeePaymentState(line, ticketOrdersById).replaceAll("_", " ").toLowerCase()}`}
                        </Box>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {previous ? (
                      <Box>
                        <Box>Rev {previous.revisionNumber}</Box>
                        <Typography variant="caption" color="text.secondary">
                          {previous.status} · {previous.lines.length} ticket{previous.lines.length === 1 ? "" : "s"}
                        </Typography>
                      </Box>
                    ) : "None"}
                  </TableCell>
                  <TableCell sx={{ minWidth: 180, maxWidth: 220, overflow: "hidden" }}>
                    {booking.approvalStatus === BookingApprovalStatus.PENDING ? (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Optional note"
                        value={moderatorNoteDraft[booking.id] ?? ""}
                        onChange={(event) => onModeratorNoteChange(booking.id, event.target.value)}
                      />
                    ) : (
                      booking.approvalNote ?? "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(booking.createdAt).toLocaleString()}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {booking.approvalReviewedAt ? (
                      <Box>
                        <Box>{new Date(booking.approvalReviewedAt).toLocaleString()}</Box>
                        <Typography variant="caption" color="text.secondary">
                          {booking.approvalReviewedBy
                            ? `${booking.approvalReviewedBy.firstName} ${booking.approvalReviewedBy.lastName}`
                            : "Reviewer unavailable"}
                        </Typography>
                      </Box>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
        </AdminTable>
      )}
    </Box>
  );
}

export function EventAttendeeTicketsSection({
  eventTitle,
  loading,
  rows,
  onManageTicket,
  onAnnounce,
}: {
  eventTitle: string;
  loading: boolean;
  rows: EventAttendeeTicketRow[];
  onAnnounce?: (filters: EventAttendeeTicketFilters) => void;
  onManageTicket?: (row: EventAttendeeTicketRow, action: "edit" | "delete") => void;
}) {
  const compact = useMediaQuery("(max-width: 1199px)");
  const { decision: cookieDecision, acceptPreferenceCookies } = useCookiePreferences();
  const emailSeparatorLabelId = useId();
  const filterControlsId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<EventAttendeeTicketFilters>(emptyEventAttendeeTicketFilters);
  const [emailSeparator, setEmailSeparator] = useState<AttendeeEmailSeparator>(() =>
    cookieDecision === "rejected"
      ? DEFAULT_ATTENDEE_EMAIL_SEPARATOR
      : readAttendeeEmailSeparator()
  );
  const [copyMessage, setCopyMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const filteredRows = useMemo(() => filterEventAttendeeTicketRows(rows, filters), [filters, rows]);
  const emails = useMemo(() => uniqueEventAttendeeEmails(filteredRows), [filteredRows]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    if (cookieDecision === "rejected") {
      setEmailSeparator(DEFAULT_ATTENDEE_EMAIL_SEPARATOR);
    }
  }, [cookieDecision]);

  const setFilter = (key: keyof EventAttendeeTicketFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCopyMessage(null);
  };

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(emailSeparator));
      setCopyMessage({
        severity: "success",
        text: `${emails.length} unique email address${emails.length === 1 ? "" : "es"} copied.`,
      });
    } catch {
      setCopyMessage({ severity: "error", text: "Email addresses could not be copied." });
    }
  };

  const changeEmailSeparator = (separator: AttendeeEmailSeparator) => {
    setEmailSeparator(separator);
    acceptPreferenceCookies();
    writeAttendeeEmailSeparator(separator);
  };

  const exportCsv = () => {
    const blob = new Blob([eventTicketRowsCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}-tickets.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <CircularProgress size={22} />;
  if (rows.length === 0) return <Box>
    <Alert severity="info">No active attendee tickets in this list.</Alert>
    {onAnnounce && <Button sx={{ mt: 2 }} variant="contained" onClick={() => onAnnounce({ ...filters })}>Send announcement to attendees</Button>}
  </Box>;
  return (
    <Box>
      {copyMessage ? (
        <Alert severity={copyMessage.severity} onClose={() => setCopyMessage(null)} sx={{ mb: 2 }}>
          {copyMessage.text}
        </Alert>
      ) : null}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredRows.length} of {rows.length} attendees
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {onAnnounce && <Button variant="contained" onClick={() => onAnnounce({ ...filters })}>Send announcement to attendees</Button>}
          <Button size="small" disabled={!hasActiveFilters} onClick={() => {
            setFilters(emptyEventAttendeeTicketFilters);
            setCopyMessage(null);
          }}>
            Clear filters
          </Button>
          <FormControl size="small" sx={{ minWidth: 175 }}>
            <InputLabel id={emailSeparatorLabelId}>Email separator</InputLabel>
            <Select
              labelId={emailSeparatorLabelId}
              label="Email separator"
              value={emailSeparator}
              onChange={(event) => changeEmailSeparator(event.target.value as AttendeeEmailSeparator)}
            >
              <MenuItem value=", ">Commas</MenuItem>
              <MenuItem value="; ">Semicolons (Outlook)</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            disabled={emails.length === 0}
            onClick={() => void copyEmails()}
          >
            Copy email addresses ({emails.length})
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.secondary">CSV includes all attendees</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Export full CSV</Button>
          </Box>
        </Box>
      </Box>
      {compact && <Button sx={{ mb: 2 }} variant="outlined" aria-expanded={filtersOpen} aria-controls={filterControlsId} onClick={() => setFiltersOpen((current) => !current)}>{filtersOpen ? "Hide filters" : "Show filters"}{activeFilterCount ? ` (${activeFilterCount} active)` : ""}</Button>}
      {(!compact || filtersOpen) &&       <Box id={filterControlsId} role="group" aria-label="Attendee filters" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
        <TextField size="small" fullWidth label="Filter attendee" value={filters.attendeeName} onChange={(event) => setFilter("attendeeName", event.target.value)} />
        <TextField size="small" fullWidth label="Filter rank" value={filters.rank} onChange={(event) => setFilter("rank", event.target.value)} />
        <CompactFilterSelect label="Membership" value={filters.membershipStatus} onChange={(value) => setFilter("membershipStatus", value)} options={uniqueOptions(rows, (row) => row.membershipStatus, getMembershipStatusLabel)} />
        <CompactFilterSelect label="Audience" value={filters.audience} onChange={(value) => setFilter("audience", value)} options={uniqueOptions(rows, (row) => row.audience, getTicketCategoryLabel)} />
        <TextField size="small" fullWidth label="Filter ticket" value={filters.ticketType} onChange={(event) => setFilter("ticketType", event.target.value)} />
        <YesNoFilter label="Dinner" value={filters.includesDinner} onChange={(value) => setFilter("includesDinner", value)} />
        <YesNoFilter label="Symposium" value={filters.includesSymposium} onChange={(value) => setFilter("includesSymposium", value)} />
        <YesNoFilter label="Accommodation" value={filters.accommodationRequested} onChange={(value) => setFilter("accommodationRequested", value)} />
        <CompactFilterSelect label="Approval" value={filters.approvalStatus} onChange={(value) => setFilter("approvalStatus", value)} options={uniqueOptions(rows, (row) => row.approvalStatus, titleCaseStatus)} />
        <CompactFilterSelect label="Payment" value={filters.paymentState} onChange={(value) => setFilter("paymentState", value)} options={uniqueOptions(rows, (row) => row.paymentState, titleCaseStatus)} />
      </Box>}
      {compact ? filteredRows.length === 0 ? <Alert severity="info">No attendees match the current filters.</Alert> : <Stack spacing={2}>
        {filteredRows.map((row) => <Box key={row.key} sx={recordCardSx}>
          <Typography component="h3" fontWeight={700} sx={{ mb: 2 }}>{row.attendeeName}</Typography>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, m: 0 }}>
            <RecordField label="Attendee email">{row.email || "—"}</RecordField>
            {row.bookingOwnerName && <RecordField label="Booked by">{row.bookingOwnerName}{row.bookingOwnerEmail && <Typography variant="caption" display="block">{row.bookingOwnerEmail}</Typography>}</RecordField>}
            <RecordField label="Rank">{row.rank || "—"}</RecordField>
            <RecordField label="Membership status">{row.membershipStatus ? getMembershipStatusLabel(row.membershipStatus) : "—"}</RecordField>
            <RecordField label="Audience">{getTicketCategoryLabel(row.audience)}</RecordField>
            <RecordField label="Ticket">{row.ticketType}</RecordField>
            <RecordField label="Dinner">{row.includesDinner ? "Yes" : "No"}</RecordField>
            <RecordField label="Symposium">{row.includesSymposium ? "Yes" : "No"}</RecordField>
            <RecordField label="Accommodation">{row.accommodationRequested ? "Yes" : "No"}{row.accommodationNote && <Typography variant="caption" display="block">{row.accommodationNote}</Typography>}</RecordField>
            <RecordField label="Seating preferences">{row.seatingPreferences.join(", ") || "—"}</RecordField>
            <RecordField label="Dietary requirements">{row.dietaryNote || "—"}</RecordField>
            <RecordField label="Approval"><Chip size="small" label={titleCaseStatus(row.approvalStatus)} color={approvalStatusColor(row.approvalStatus)} /></RecordField>
            <RecordField label="Payment"><Chip size="small" variant="outlined" label={titleCaseStatus(row.paymentState)} /></RecordField>
          </Box>
          {onManageTicket && row.ticketId && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => onManageTicket(row, "edit")} aria-label={`Edit ticket for ${row.attendeeName}`}>Edit ticket</Button>
            <Button color="error" onClick={() => onManageTicket(row, "delete")} aria-label={`Delete ticket for ${row.attendeeName}`}>Delete ticket</Button>
          </Stack>}
        </Box>)}
      </Stack> : (      <AdminTable minWidth={1640}>
        <TableHead>
          <TableRow>
            <TableCell>Attendee</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Rank</TableCell>
            <TableCell>Membership status</TableCell>
            <TableCell>Audience</TableCell>
            <TableCell>Ticket</TableCell>
            <TableCell>Dinner</TableCell>
            <TableCell>Symposium</TableCell>
            <TableCell>Accommodation</TableCell>
            <TableCell>Seating preferences</TableCell>
            <TableCell>Dietary requirements</TableCell>
            <TableCell>Approval</TableCell>
            <TableCell>Payment</TableCell>
            {onManageTicket && <TableCell>Actions</TableCell>}
          </TableRow>

        </TableHead>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow><TableCell colSpan={onManageTicket ? 14 : 13}><Alert severity="info">No attendees match the current filters.</Alert></TableCell></TableRow>
          ) : filteredRows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.attendeeName}{row.bookingOwnerName && <Typography variant="caption" display="block" color="text.secondary">Booked by: {row.bookingOwnerName}{row.bookingOwnerEmail ? ` · ${row.bookingOwnerEmail}` : ""}</Typography>}</TableCell>
              <TableCell>{row.email ?? "—"}</TableCell>
              <TableCell>{row.rank || "—"}</TableCell>
              <TableCell>{row.membershipStatus ? getMembershipStatusLabel(row.membershipStatus) : "—"}</TableCell>
              <TableCell>{getTicketCategoryLabel(row.audience)}</TableCell>
              <TableCell>{row.ticketType}</TableCell>
              <TableCell>{row.includesDinner ? "Yes" : "No"}</TableCell>
              <TableCell>{row.includesSymposium ? "Yes" : "No"}</TableCell>
              <TableCell>{row.accommodationRequested ? "Yes" : "No"}{row.accommodationNote && <Typography variant="caption" display="block">{row.accommodationNote}</Typography>}</TableCell>
              <TableCell>{row.seatingPreferences.join(", ") || "—"}</TableCell>
              <TableCell>{row.dietaryNote ?? "—"}</TableCell>
              <TableCell><Chip size="small" label={row.approvalStatus.replaceAll("_", " ")} color={approvalStatusColor(row.approvalStatus)} /></TableCell>
              <TableCell><Chip size="small" variant="outlined" label={row.paymentState.replaceAll("_", " ")} /></TableCell>
              {onManageTicket && <TableCell>{row.ticketId && <>
                <Button onClick={() => onManageTicket(row, "edit")} aria-label={`Edit ticket for ${row.attendeeName}`}>Edit</Button>
                <Button color="error" onClick={() => onManageTicket(row, "delete")} aria-label={`Delete ticket for ${row.attendeeName}`}>Delete</Button>
              </>}</TableCell>}

            </TableRow>
          ))}
        </TableBody>
      </AdminTable>)}
    </Box>
  );
}

function titleCaseStatus(value: string): string {
  return value.replaceAll("_", " ").toLocaleLowerCase().replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function uniqueOptions<T extends string>(
  rows: readonly EventAttendeeTicketRow[],
  valueFor: (row: EventAttendeeTicketRow) => T | null,
  labelFor: (value: T) => string
): Array<{ value: string; label: string }> {
  return Array.from(new Set(rows.map(valueFor).filter((value): value is T => Boolean(value))))
    .map((value) => ({ value, label: labelFor(value) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function CompactFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const labelId = useId();
  return (
    <FormControl size="small" fullWidth>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select labelId={labelId} label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <MenuItem value="">All</MenuItem>
        {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function YesNoFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <CompactFilterSelect label={label} value={value} onChange={onChange} options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }]} />;
}

function BookingAuditSection({ loading, bookings }: { loading: boolean; bookings: EventBookingAdminRow[] }) {
  return (
    <Box>
      {loading ? (
        <CircularProgress size={22} />
      ) : bookings.length === 0 ? (
        <Alert severity="info">No bookings found for this event.</Alert>
      ) : (
        <AdminTable>
            <TableHead>
              <TableRow>
                <TableCell>Booking</TableCell>
                <TableCell>Revision</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Approval</TableCell>
                <TableCell>Booker</TableCell>
                <TableCell align="right">Lines</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Created by</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Updated by</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{booking.id}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Chip size="small" variant="outlined" label={`Rev ${booking.revisionNumber}`} />
                      {booking.supersedesBooking?.revisionNumber != null ? (
                        <Box sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Supersedes rev {booking.supersedesBooking.revisionNumber}
                        </Box>
                      ) : null}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={booking.status} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Chip
                        size="small"
                        label={(booking.approvalStatus ?? BookingApprovalStatus.NOT_REQUIRED).replaceAll("_", " ")}
                        color={approvalStatusColor(booking.approvalStatus ?? BookingApprovalStatus.NOT_REQUIRED)}
                      />
                      {booking.approvalReviewedAt ? (
                        <Typography variant="caption" color="text.secondary">
                          {booking.approvalReviewedBy
                            ? `${booking.approvalReviewedBy.firstName} ${booking.approvalReviewedBy.lastName}`
                            : "Reviewed"}
                          {` · ${new Date(booking.approvalReviewedAt).toLocaleString()}`}
                        </Typography>
                      ) : null}
                    </Box>
                  </TableCell>
                  <TableCell>{booking.booker ? `${booking.booker.firstName} ${booking.booker.lastName}` : "—"}</TableCell>
                  <TableCell align="right">{booking.lines.length}</TableCell>
                  <TableCell>{new Date(booking.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{booking.createdBy ?? "—"}</TableCell>
                  <TableCell>{new Date(booking.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>{booking.updatedBy ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
        </AdminTable>
      )}
    </Box>
  );
}

function PaymentActivitySection({
  loading,
  ticketOrders,
  bookingPaymentAdjustments,
  bookings,
  ticketOrdersById,
  organiserGuests,
  dataUnavailable = false,
  settledPaymentsUnavailable = false,
  taskHref,
  view,
  onViewChange,
  onContactUnpaid,
}: {
  loading: boolean;
  ticketOrders: TicketOrderAdminRow[];
  bookingPaymentAdjustments: BookingPaymentAdjustmentAdminRow[];
  bookings: EventBookingAdminRow[];
  ticketOrdersById: TicketOrdersById;
  organiserGuests: Guest[];
  dataUnavailable?: boolean;
  settledPaymentsUnavailable?: boolean;
  taskHref?: (task: EventManagementTask) => string;
  view?: EventPaymentView;
  onViewChange?: (view: EventPaymentView) => void;
  onContactUnpaid?: () => void;
}) {
  const compact = useMediaQuery("(max-width: 899px)");
  const [localView, setLocalView] = useState<EventPaymentView>("required");
  const selectedView = view ?? localView;
  const summary = getEventWorkspaceSummary(bookings, ticketOrdersById, organiserGuests);
  const hasUnpaidBookers = currentActiveBookings(bookings).some((booking) => booking.lines.some((line) => !line.bookingPlace?.attendanceRemoved && attendeePaymentState(line, ticketOrdersById) === "UNPAID"));
  const settled = getSettledEventPayments(ticketOrders, organiserGuests);
  const adjustments = bookingPaymentAdjustments.flatMap((booking) => (booking.adjustments ?? []).map((adjustment) => ({ booking, adjustment })));
  const orderAmount = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  const refundLabel = (order: TicketOrderAdminRow) => order.refundedAmountMinor == null ? "No refund recorded" : `${orderAmount(order.refundedAmountMinor, order.currency)} · ${order.refundedAt ? new Date(order.refundedAt).toLocaleString() : "Time unknown"}`;
  const disputeLabel = (order: TicketOrderAdminRow) => order.stripeDisputeId ? `${titleCaseStatus(order.disputeStatus ?? "OPEN")} · ${order.disputeReason ?? "Reason not supplied"}` : "No dispute recorded";
  return <Box>
    <Tabs value={selectedView} aria-label="Payment views" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 2 }} onChange={(_, next: EventPaymentView) => { setLocalView(next); onViewChange?.(next); }}>
      <Tab value="required" label="Payment required" /><Tab value="all" label="All payment records" />
    </Tabs>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Booking approval and payment are tracked separately. Payment records do not change when an attendee ticket is edited or removed.</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 3 }}>
      <Box sx={recordCardSx}>
        <Typography component="h3" variant="subtitle1" fontWeight={700}>Net settled booking orders</Typography>
        {loading ? <Typography variant="body2">Loading settled booking payments…</Typography> : settledPaymentsUnavailable ? <Typography variant="body2" color="text.secondary">Unavailable until payment order records load.</Typography> : settled.bookingOrdersEvidenceIncomplete ? <Typography variant="body2" color="text.secondary">Unavailable until booking refund amounts are complete.</Typography> : settled.bookingOrdersByCurrency.length > 0 ? <Box component="dl" sx={{ display: "flex", flexWrap: "wrap", gap: 3, my: 1 }}>{settled.bookingOrdersByCurrency.map(({ currency, amountMinor }) => <RecordField key={currency} label={currency || "Currency unavailable"}>{(amountMinor / 100).toFixed(2)} {currency}</RecordField>)}</Box> : <Typography variant="body2">No settled booking order payments recorded.</Typography>}
        <Typography variant="caption" color="text.secondary">Paid and refunded booking orders, less recorded refunds. Currencies are shown separately.</Typography>
      </Box>
      <Box sx={recordCardSx}>
        <Typography component="h3" variant="subtitle1" fontWeight={700}>Net settled organiser guest payments (GBP)</Typography>
        {loading ? <Typography variant="body2">Loading settled organiser guest payments…</Typography> : dataUnavailable || settled.organiserGuestAmountPence === null ? <Typography variant="body2" color="text.secondary">Unavailable until organiser guest payment evidence is complete.</Typography> : <Typography sx={{ my: 1 }}>{money(settled.organiserGuestAmountPence)}</Typography>}
        <Typography variant="caption" color="text.secondary">Separate organiser guest payments, less completed refunds. Includes paid tickets that were later cancelled.</Typography>
      </Box>
    </Box>
    {loading ? <CircularProgress size={22} /> : selectedView === "required" ? dataUnavailable ? <Alert severity="warning">Payment summary unavailable. Current booking and organiser guest records are required to show an accurate balance. Reload the data before contacting anyone about payment.</Alert> : <>
      {summary.unknownPaymentTicketCount > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Payment records are incomplete for {summary.unknownPaymentTicketCount} ticket{summary.unknownPaymentTicketCount === 1 ? "" : "s"}. The known balance below excludes those tickets; reload before contacting anyone about payment.</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box><Typography variant="h6" component="h3">{summary.unknownPaymentTicketCount ? "Known outstanding balance" : "Outstanding balance"}: {money(summary.outstandingAmountPence)}</Typography><Typography variant="body2" color="text.secondary">{summary.outstandingTicketCount} ticket{summary.outstandingTicketCount === 1 ? "" : "s"} across {summary.requiredPayments.length} booking{summary.requiredPayments.length === 1 ? "" : "s"} or organiser guests. Payments in progress are included until settled.</Typography></Box>
        {onContactUnpaid && <Box><Button variant="outlined" disabled={!hasUnpaidBookers || summary.unknownPaymentTicketCount > 0} onClick={onContactUnpaid}>Contact unpaid bookers</Button><Typography variant="caption" display="block" color="text.secondary" sx={{ maxWidth: 360 }}>Booking owners of unpaid member or accompanying guest tickets only. Excludes organiser guests, partial payments and payments in progress. Review recipients before sending.</Typography></Box>}
      </Stack>
      {summary.requiredPayments.length === 0 ? <Alert severity="info">No outstanding payments in the current booking records.</Alert> : compact ? <Stack spacing={2}>
        {summary.requiredPayments.map((payment) => <Box key={payment.key} sx={recordCardSx}>
          <Typography component="h3" fontWeight={700}>{payment.ownerName}</Typography>
          <Typography variant="body2" color="text.secondary">{payment.ownerEmail || "No email recorded"}</Typography>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, my: 2 }}>
            <RecordField label="Outstanding">{money(payment.outstandingAmountPence)}</RecordField>
            <RecordField label="Tickets">{payment.ticketCount}</RecordField>
            <RecordField label="Payment">{payment.paymentPending ? "Payment in progress" : "Payment required"}</RecordField>
            <RecordField label="Booking">{payment.kind === "organiser-guest" ? "Organiser guest" : `Revision ${payment.revisionNumber}`}</RecordField>
          </Box>
          {taskHref && <Button size="small" component={RouterLink} to={taskHref(payment.kind === "organiser-guest" ? "guests" : "activity")}>{payment.kind === "organiser-guest" ? "Manage guest" : "View booking activity"}</Button>}
        </Box>)}
      </Stack> : <AdminTable minWidth={650}>
        <TableHead><TableRow><TableCell>Booker / payer</TableCell><TableCell>Booking</TableCell><TableCell>Tickets</TableCell><TableCell>Outstanding</TableCell><TableCell>Payment</TableCell>{taskHref && <TableCell>Actions</TableCell>}</TableRow></TableHead>
        <TableBody>{summary.requiredPayments.map((payment) => <TableRow key={payment.key}>
          <TableCell><Typography variant="body2">{payment.ownerName}</Typography><Typography variant="caption" color="text.secondary">{payment.ownerEmail || "No email recorded"}</Typography></TableCell>
          <TableCell>{payment.kind === "organiser-guest" ? "Organiser guest" : `Revision ${payment.revisionNumber}`}</TableCell><TableCell>{payment.ticketCount}</TableCell><TableCell>{money(payment.outstandingAmountPence)}</TableCell><TableCell><Chip size="small" variant="outlined" label={payment.paymentPending ? "In progress" : "Required"} color={payment.paymentPending ? "default" : "warning"} /></TableCell>
          {taskHref && <TableCell><Button size="small" component={RouterLink} to={taskHref(payment.kind === "organiser-guest" ? "guests" : "activity")}>{payment.kind === "organiser-guest" ? "Manage guest" : "View booking activity"}</Button></TableCell>}
        </TableRow>)}</TableBody>
      </AdminTable>}
    </> : <>
      {ticketOrders.length === 0 ? <Alert severity="info">No payment orders found for this event.</Alert> : compact ? <Stack spacing={2}>
        {ticketOrders.map((order) => <Box key={order.id} sx={recordCardSx}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}><Typography component="h3" fontWeight={700}>{order.user ? `${order.user.firstName} ${order.user.lastName}` : "Purchaser unavailable"}</Typography><Chip size="small" label={titleCaseStatus(order.status)} color={order.status === "PAID" ? "success" : "default"} /></Stack>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, m: 0 }}>
            <RecordField label="Ticket">{order.ticketType?.title || "—"}</RecordField><RecordField label="Quantity">{order.quantity}</RecordField><RecordField label="Amount">{orderAmount(order.totalAmountMinor, order.currency)}</RecordField><RecordField label="Updated">{new Date(order.updatedAt).toLocaleString()}</RecordField><RecordField label="Refund">{refundLabel(order)}</RecordField><RecordField label="Dispute">{disputeLabel(order)}</RecordField><RecordField label="Webhook event ID">{order.webhookEventId || "—"}</RecordField><RecordField label="Updated by">{order.updatedBy || "—"}</RecordField>
          </Box>
        </Box>)}
      </Stack> : <AdminTable minWidth={1000}>
        <TableHead><TableRow><TableCell>Status</TableCell><TableCell>Purchaser</TableCell><TableCell>Ticket</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Amount</TableCell><TableCell>Refund</TableCell><TableCell>Dispute</TableCell><TableCell>Webhook Event ID</TableCell><TableCell>Updated</TableCell><TableCell>Updated by</TableCell></TableRow></TableHead>
        <TableBody>{ticketOrders.map((order) => <TableRow key={order.id}>
          <TableCell><Chip size="small" label={order.status} color={order.status === "PAID" ? "success" : "default"} /></TableCell><TableCell>{order.user ? `${order.user.firstName} ${order.user.lastName}` : "—"}</TableCell><TableCell>{order.ticketType?.title || "—"}</TableCell><TableCell align="right">{order.quantity}</TableCell><TableCell align="right">{orderAmount(order.totalAmountMinor, order.currency)}</TableCell><TableCell>{refundLabel(order)}</TableCell><TableCell>{disputeLabel(order)}</TableCell><TableCell sx={{ maxWidth: 180, overflowWrap: "anywhere" }}>{order.webhookEventId || "—"}</TableCell><TableCell>{new Date(order.updatedAt).toLocaleString()}</TableCell><TableCell>{order.updatedBy || "—"}</TableCell>
        </TableRow>)}</TableBody>
      </AdminTable>}
      {organiserGuests.length > 0 && <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 2 }} /><Typography variant="h6" component="h3" sx={{ mb: 2 }}>Organiser guest payment records</Typography>
        {compact ? <Stack spacing={2}>{organiserGuests.map((guest) => <Box key={guest.id} sx={recordCardSx}>
          <Typography component="h4" fontWeight={700}>{guest.firstName} {guest.lastName}</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 1 }}><Chip size="small" label={titleCaseStatus(guest.paymentStatus)} />{guest.cancelled && <Chip size="small" label="Cancelled ticket" variant="outlined" />}</Stack>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, m: 0 }}><RecordField label="Ticket">{guest.ticketTitle}</RecordField><RecordField label="Price">{money(guest.priceMinor)}</RecordField><RecordField label="Refunded">{money(guest.refundedAmountMinor)}</RecordField><RecordField label="Contact">{guest.email || "No email recorded"}</RecordField></Box>
          {taskHref && <Button size="small" component={RouterLink} to={taskHref("guests")}>Manage guest</Button>}
        </Box>)}</Stack> : <AdminTable minWidth={650}><TableHead><TableRow><TableCell>Organiser guest</TableCell><TableCell>Ticket</TableCell><TableCell>Payment</TableCell><TableCell>Price</TableCell><TableCell>Refunded</TableCell><TableCell>Ticket status</TableCell>{taskHref && <TableCell>Actions</TableCell>}</TableRow></TableHead><TableBody>{organiserGuests.map((guest) => <TableRow key={guest.id}><TableCell>{guest.firstName} {guest.lastName}</TableCell><TableCell>{guest.ticketTitle}</TableCell><TableCell><Chip size="small" label={titleCaseStatus(guest.paymentStatus)} /></TableCell><TableCell>{money(guest.priceMinor)}</TableCell><TableCell>{money(guest.refundedAmountMinor)}</TableCell><TableCell>{guest.cancelled ? "Cancelled" : "Current"}</TableCell>{taskHref && <TableCell><Button size="small" component={RouterLink} to={taskHref("guests")}>Manage guest</Button></TableCell>}</TableRow>)}</TableBody></AdminTable>}
      </Box>}
      {adjustments.length > 0 && <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 2 }} /><Typography variant="h6" component="h3" sx={{ mb: 2 }}>Booking payment adjustments</Typography>
        {compact ? <Stack spacing={2}>{adjustments.map(({ booking, adjustment }) => <Box key={adjustment.id} sx={recordCardSx}>
          <Typography fontWeight={700}>{booking.booker ? `${booking.booker.firstName} ${booking.booker.lastName}` : "Booker unavailable"}</Typography><Chip size="small" color="warning" label={titleCaseStatus(adjustment.status)} sx={{ my: 1 }} />
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, m: 0 }}><RecordField label="Adjustment">{money(adjustment.deltaAmountMinor)}</RecordField><RecordField label="Revision">{booking.revisionNumber}</RecordField><RecordField label="Updated">{new Date(adjustment.updatedAt).toLocaleString()}</RecordField></Box>
        </Box>)}</Stack> : <AdminTable minWidth={650}>
          <TableHead><TableRow><TableCell>Adjustment</TableCell><TableCell>Booker</TableCell><TableCell align="right">Delta</TableCell><TableCell>Revision</TableCell><TableCell>Updated</TableCell></TableRow></TableHead>
          <TableBody>{adjustments.map(({ booking, adjustment }) => <TableRow key={adjustment.id}><TableCell><Chip size="small" color="warning" label={adjustment.status.replaceAll("_", " ")} /></TableCell><TableCell>{booking.booker ? `${booking.booker.firstName} ${booking.booker.lastName}` : "—"}</TableCell><TableCell align="right">{money(adjustment.deltaAmountMinor)}</TableCell><TableCell>Rev {booking.revisionNumber}</TableCell><TableCell>{new Date(adjustment.updatedAt).toLocaleString()}</TableCell></TableRow>)}</TableBody>
        </AdminTable>}
      </Box>}
    </>}
  </Box>;
}

function approvalStatusColor(status: string): "warning" | "success" | "error" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "default";
}
