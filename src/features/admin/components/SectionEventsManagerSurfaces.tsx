import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import type { ReactNode } from "react";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { GuestTicketRequestStatus, TicketAudience } from "@dataconnect/generated";
import PageHeader from "../../../shared/components/PageHeader";
import { getTicketCategoryLabel, TICKET_CATEGORY_LABEL } from "../../../shared/utils/ticketAudienceLabels";
import type {
  EventBookingAdminRow,
  EventRow,
  GuestRequestStatusFilter,
  GuestTicketRequestWithBooking,
  BookingPaymentAdjustmentAdminRow,
  TicketOrderAdminRow,
  TicketTypeRow,
} from "./sectionEventsManagerTypes";

interface EventListSurfaceProps {
  sectionName: string;
  onBack: () => void;
  error: string | null;
  onDismissError: () => void;
  onAddEvent: () => void;
  loadingEvents: boolean;
  errorEvents: boolean;
  events: EventRow[];
  deletingEventId: string | null;
  onManageEventAdmin: (eventId: string) => void;
  onDeleteEvent: (event: EventRow) => void;
}

export function EventListSurface({
  sectionName,
  onBack,
  error,
  onDismissError,
  onAddEvent,
  loadingEvents,
  errorEvents,
  events,
  deletingEventId,
  onManageEventAdmin,
  onDeleteEvent,
}: EventListSurfaceProps) {
  return (
    <>
      <PageHeader title={`Events: ${sectionName}`} onBack={onBack} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onDismissError}>
          {error}
        </Alert>
      )}
      <Button startIcon={<AddIcon />} variant="contained" onClick={onAddEvent} sx={{ mb: 2 }}>
        Add event
      </Button>
      {loadingEvents ? (
        <CircularProgress />
      ) : errorEvents ? (
        <Alert severity="error">Failed to load events.</Alert>
      ) : events.length === 0 ? (
        <Alert severity="info">No events yet. Add one to get started.</Alert>
      ) : (
        <AdminTable>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Date / time</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Guest of honour</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.title}</TableCell>
                  <TableCell>
                    {new Date(event.startDateTime).toLocaleString()} –{" "}
                    {new Date(event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{event.location ?? "—"}</TableCell>
                  <TableCell>{event.guestOfHonour ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onManageEventAdmin(event.id)}
                      sx={{ mr: 1 }}
                    >
                      Event admin
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={deletingEventId === event.id}
                      onClick={() => onDeleteEvent(event)}
                    >
                      {deletingEventId === event.id ? <CircularProgress size={16} /> : <DeleteIcon />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </AdminTable>
      )}
    </>
  );
}

interface EventDialogSurfaceProps {
  open: boolean;
  editingEvent: EventRow | null;
  title: string;
  location: string;
  guestOfHonour: string;
  startDateTime: string;
  endDateTime: string;
  bookingStartDateTime: string;
  bookingEndDateTime: string;
  maxGuestsStr: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onGuestOfHonourChange: (value: string) => void;
  onStartDateTimeChange: (value: string) => void;
  onEndDateTimeChange: (value: string) => void;
  onBookingStartDateTimeChange: (value: string) => void;
  onBookingEndDateTimeChange: (value: string) => void;
  onMaxGuestsChange: (value: string) => void;
}

export function EventDialogSurface({
  open,
  editingEvent,
  title,
  location,
  guestOfHonour,
  startDateTime,
  endDateTime,
  bookingStartDateTime,
  bookingEndDateTime,
  maxGuestsStr,
  submitting,
  onClose,
  onSubmit,
  onTitleChange,
  onLocationChange,
  onGuestOfHonourChange,
  onStartDateTimeChange,
  onEndDateTimeChange,
  onBookingStartDateTimeChange,
  onBookingEndDateTimeChange,
  onMaxGuestsChange,
}: EventDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingEvent ? "Edit event" : "Add event"}</DialogTitle>
      <DialogContent>
        <TextField label="Title" fullWidth value={title} onChange={(event) => onTitleChange(event.target.value)} margin="dense" required />
        <TextField label="Location" fullWidth value={location} onChange={(event) => onLocationChange(event.target.value)} margin="dense" />
        <TextField
          label="Guest of honour"
          fullWidth
          value={guestOfHonour}
          onChange={(event) => onGuestOfHonourChange(event.target.value)}
          margin="dense"
        />
        <TextField
          label="Start date/time"
          type="datetime-local"
          fullWidth
          value={startDateTime}
          onChange={(event) => onStartDateTimeChange(event.target.value)}
          margin="dense"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End date/time"
          type="datetime-local"
          fullWidth
          value={endDateTime}
          onChange={(event) => onEndDateTimeChange(event.target.value)}
          margin="dense"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Booking window start"
          type="datetime-local"
          fullWidth
          value={bookingStartDateTime}
          onChange={(event) => onBookingStartDateTimeChange(event.target.value)}
          margin="dense"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Booking window end"
          type="datetime-local"
          fullWidth
          value={bookingEndDateTime}
          onChange={(event) => onBookingEndDateTimeChange(event.target.value)}
          margin="dense"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Max guests without moderator approval"
          type="number"
          fullWidth
          value={maxGuestsStr}
          onChange={(event) => onMaxGuestsChange(event.target.value)}
          margin="dense"
          inputProps={{ min: 0 }}
          helperText="Leave blank if unset. Total guest headcount allowed before extra approval."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting || !title.trim()}>
          {submitting ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface TicketAdminSurfaceProps {
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
  requestStatusFilter: GuestRequestStatusFilter;
  onRequestStatusFilterChange: (value: GuestRequestStatusFilter) => void;
  loadingGuestRequests: boolean;
  guestRequests: GuestTicketRequestWithBooking[];
  moderatorNoteDraft: Record<string, string>;
  onModeratorNoteChange: (requestId: string, value: string) => void;
  reviewingRequestId: string | null;
  onReviewRequest: (
    request: GuestTicketRequestWithBooking,
    status: GuestTicketRequestStatus.APPROVED | GuestTicketRequestStatus.REJECTED
  ) => void;
  loadingEventBookings: boolean;
  eventBookings: EventBookingAdminRow[];
  loadingTicketOrders: boolean;
  ticketOrders: TicketOrderAdminRow[];
  loadingPaymentAdjustments: boolean;
  bookingPaymentAdjustments: BookingPaymentAdjustmentAdminRow[];
}

export function TicketAdminSurface({
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
  requestStatusFilter,
  onRequestStatusFilterChange,
  loadingGuestRequests,
  guestRequests,
  moderatorNoteDraft,
  onModeratorNoteChange,
  reviewingRequestId,
  onReviewRequest,
  loadingEventBookings,
  eventBookings,
  loadingTicketOrders,
  ticketOrders,
  loadingPaymentAdjustments,
  bookingPaymentAdjustments,
}: TicketAdminSurfaceProps) {
  return (
    <>
      <PageHeader title={`Event admin: ${eventTitle}`} onBack={onBack} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onDismissError}>
          {error}
        </Alert>
      )}
      <AdminAccordion title="Event details">
        <EventDetailsSection event={event} loading={loadingEventDetail} onEditEvent={onEditEvent} />
      </AdminAccordion>
      <AdminAccordion title="Ticket types">
        <Button startIcon={<AddIcon />} variant="contained" onClick={onAddTicketType} sx={{ mb: 2 }}>
          Add ticket type
        </Button>
        <TicketTypesTable
          loading={loadingEventDetail}
          ticketTypes={ticketTypes}
          deletingTicketTypeId={deletingTicketTypeId}
          onEdit={onEditTicketType}
          onDelete={onDeleteTicketType}
        />
      </AdminAccordion>
      <AdminAccordion title="Guest ticket requests">
        <GuestTicketRequestsSection
          filter={requestStatusFilter}
          onFilterChange={onRequestStatusFilterChange}
          loading={loadingGuestRequests}
          requests={guestRequests}
          moderatorNoteDraft={moderatorNoteDraft}
          onModeratorNoteChange={onModeratorNoteChange}
          reviewingRequestId={reviewingRequestId}
          onReview={onReviewRequest}
        />
      </AdminAccordion>
      <AdminAccordion title="Booking audit activity">
        <BookingAuditSection loading={loadingEventBookings} bookings={eventBookings} />
      </AdminAccordion>
      <AdminAccordion title="Payment status activity">
        <PaymentActivitySection
          loading={loadingTicketOrders || loadingPaymentAdjustments}
          ticketOrders={ticketOrders}
          bookingPaymentAdjustments={bookingPaymentAdjustments}
        />
      </AdminAccordion>
    </>
  );
}

function AdminAccordion({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      sx={{
        mb: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "12px !important",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
        "&:before": {
          display: "none",
        },
        "&:focus, &:focus-visible, &:focus-within": {
          outline: "none",
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
        },
      }}
    >
      <AccordionSummary
        disableRipple
        expandIcon={<ExpandMoreIcon />}
        sx={{
          bgcolor: "background.paper",
          minHeight: 58,
          px: 2.5,
          transition: "background-color 150ms ease",
          outline: "none",
          boxShadow: "none",
          "&:hover": {
            bgcolor: "grey.50",
          },
          "&:focus, &:focus-visible, &:active": {
            outline: "none",
            boxShadow: "none",
          },
          "&.Mui-focusVisible": {
            bgcolor: "background.paper",
            outline: "none",
            boxShadow: "none",
          },
          "& .MuiTouchRipple-root": {
            display: "none",
          },
          "&.Mui-expanded": {
            borderBottom: "1px solid",
            borderColor: "divider",
            minHeight: 58,
          },
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            my: 1.5,
          },
          "& .MuiAccordionSummary-expandIconWrapper": {
            color: "text.secondary",
          },
        }}
      >
        <Box sx={{ fontWeight: 700, color: "text.primary", letterSpacing: "0.01em" }}>{title}</Box>
      </AccordionSummary>
      <AccordionDetails sx={{ bgcolor: "grey.50", p: 2.5 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function AdminTable({ children, minWidth = 650 }: { children: ReactNode; minWidth?: number }) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        borderColor: "divider",
        borderRadius: 2,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
      }}
    >
      <Table
        size="small"
        sx={{
          minWidth,
          "& .MuiTableCell-head": {
            bgcolor: "grey.50",
            color: "text.secondary",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          },
          "& .MuiTableCell-body": {
            borderBottomColor: "divider",
            py: 1.25,
          },
          "& .MuiTableBody-root .MuiTableRow-root:hover": {
            bgcolor: "action.hover",
          },
          "& .MuiTableRow-root:last-of-type .MuiTableCell-body": {
            borderBottom: 0,
          },
        }}
      >
        {children}
      </Table>
    </TableContainer>
  );
}

function EventDetailsSection({
  event,
  loading,
  onEditEvent,
}: {
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

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={() => onEditEvent(event)}>
          Edit event details
        </Button>
      </Box>
      <AdminTable minWidth={360}>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: 220 }}>Title</TableCell>
              <TableCell>{event.title}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Date / time</TableCell>
              <TableCell>
                {new Date(event.startDateTime).toLocaleString()} –{" "}
                {new Date(event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
              <TableCell>{event.location ?? "—"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Guest of honour</TableCell>
              <TableCell>{event.guestOfHonour ?? "—"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Booking window</TableCell>
              <TableCell>
                {new Date(event.bookingStartDateTime).toLocaleString()} –{" "}
                {new Date(event.bookingEndDateTime).toLocaleString()}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Max guests without moderator approval</TableCell>
              <TableCell>
                {event.maxGuestsWithoutModeratorApproval != null
                  ? String(event.maxGuestsWithoutModeratorApproval)
                  : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
      </AdminTable>
    </Box>
  );
}

function TicketTypesTable({
  loading,
  ticketTypes,
  deletingTicketTypeId,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  ticketTypes: TicketTypeRow[];
  deletingTicketTypeId: string | null;
  onEdit: (ticketType: TicketTypeRow) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return <CircularProgress />;
  }

  return (
    <AdminTable>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>{TICKET_CATEGORY_LABEL}</TableCell>
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
              <TableCell>
                {ticketType.userGroup ? (
                  <Chip label={ticketType.userGroup.name} size="small" variant="outlined" color="primary" />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEdit(ticketType)}>
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
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

function GuestTicketRequestsSection({
  filter,
  onFilterChange,
  loading,
  requests,
  moderatorNoteDraft,
  onModeratorNoteChange,
  reviewingRequestId,
  onReview,
}: {
  filter: GuestRequestStatusFilter;
  onFilterChange: (value: GuestRequestStatusFilter) => void;
  loading: boolean;
  requests: GuestTicketRequestWithBooking[];
  moderatorNoteDraft: Record<string, string>;
  onModeratorNoteChange: (requestId: string, value: string) => void;
  reviewingRequestId: string | null;
  onReview: (
    request: GuestTicketRequestWithBooking,
    status: GuestTicketRequestStatus.APPROVED | GuestTicketRequestStatus.REJECTED
  ) => void;
}) {
  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Box sx={{ fontWeight: 600 }}>Additional guest ticket requests</Box>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="guest-request-filter-label">Status filter</InputLabel>
          <Select
            labelId="guest-request-filter-label"
            label="Status filter"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as GuestRequestStatusFilter)}
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
      ) : requests.length === 0 ? (
        <Alert severity="info">No guest ticket requests for this filter.</Alert>
      ) : (
        <AdminTable>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Booker</TableCell>
                <TableCell>Guest</TableCell>
                <TableCell>Ticket</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Dietary</TableCell>
                <TableCell>Moderator note</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Reviewed</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Chip size="small" label={request.status} color={requestStatusColor(request.status)} />
                  </TableCell>
                  <TableCell>
                    {request.booker ? `${request.booker.firstName} ${request.booker.lastName}` : "—"}
                  </TableCell>
                  <TableCell>{request.guestDisplayName ?? "—"}</TableCell>
                  <TableCell>{request.guestTicketType?.title ?? "—"}</TableCell>
                  <TableCell align="right">{request.requestedGuestCount}</TableCell>
                  <TableCell>{request.dietaryNote ?? "—"}</TableCell>
                  <TableCell sx={{ minWidth: 240 }}>
                    {request.status === "PENDING" ? (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Optional note"
                        value={moderatorNoteDraft[request.id] ?? ""}
                        onChange={(event) => onModeratorNoteChange(request.id, event.target.value)}
                      />
                    ) : (
                      request.moderatorNote ?? "—"
                    )}
                  </TableCell>
                  <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}</TableCell>
                  <TableCell align="right">
                    {request.status === "PENDING" ? (
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          disabled={reviewingRequestId === request.id}
                          onClick={() => onReview(request, GuestTicketRequestStatus.APPROVED)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={reviewingRequestId === request.id}
                          onClick={() => onReview(request, GuestTicketRequestStatus.REJECTED)}
                        >
                          Reject
                        </Button>
                      </Box>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </AdminTable>
      )}
    </Box>
  );
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
                <TableCell>Status</TableCell>
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
                    <Chip size="small" label={booking.status} />
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
}: {
  loading: boolean;
  ticketOrders: TicketOrderAdminRow[];
  bookingPaymentAdjustments: BookingPaymentAdjustmentAdminRow[];
}) {
  return (
    <Box>
      {loading ? (
        <CircularProgress size={22} />
      ) : ticketOrders.length === 0 ? (
        <Alert severity="info">No payment orders found for this event.</Alert>
      ) : (
        <AdminTable>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Purchaser</TableCell>
                <TableCell>Ticket</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Refund</TableCell>
                <TableCell>Dispute</TableCell>
                <TableCell>Webhook Event ID</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Updated by</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ticketOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Chip size="small" label={order.status} color={order.status === "PAID" ? "success" : "default"} />
                  </TableCell>
                  <TableCell>{order.user ? `${order.user.firstName} ${order.user.lastName}` : "—"}</TableCell>
                  <TableCell>{order.ticketType?.title ?? "—"}</TableCell>
                  <TableCell align="right">{order.quantity}</TableCell>
                  <TableCell align="right">
                    {(order.totalAmountMinor / 100).toFixed(2)} {order.currency.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    {order.refundedAmountMinor != null ? (
                      <Box>
                        <Box>
                          {(order.refundedAmountMinor / 100).toFixed(2)} {order.currency.toUpperCase()}
                        </Box>
                        <Box sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          {order.refundedAt ? new Date(order.refundedAt).toLocaleString() : "time unknown"}
                        </Box>
                      </Box>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {order.stripeDisputeId ? (
                      <Box>
                        <Chip size="small" label={order.disputeStatus ?? "OPEN"} color="warning" />
                        <Box sx={{ color: "text.secondary", fontSize: "0.75rem", mt: 0.5 }}>
                          {order.disputeReason ?? "Reason not supplied"}
                        </Box>
                      </Box>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {order.webhookEventId ?? "—"}
                  </TableCell>
                  <TableCell>{new Date(order.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>{order.updatedBy ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
        </AdminTable>
      )}
      {bookingPaymentAdjustments.length > 0 ? (
        <Box sx={{ mt: 2 }}>
          <AdminTable>
            <TableHead>
              <TableRow>
                <TableCell>Adjustment</TableCell>
                <TableCell>Booker</TableCell>
                <TableCell align="right">Delta</TableCell>
                <TableCell>Revision</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bookingPaymentAdjustments
                .filter((booking): booking is BookingPaymentAdjustmentAdminRow & { adjustment: NonNullable<BookingPaymentAdjustmentAdminRow["adjustment"]> } => booking.adjustment != null)
                .map((booking) => (
                  <TableRow key={booking.adjustment.id}>
                    <TableCell>
                      <Chip size="small" color="warning" label={booking.adjustment.status.replaceAll("_", " ")} />
                    </TableCell>
                    <TableCell>{booking.booker ? `${booking.booker.firstName} ${booking.booker.lastName}` : "—"}</TableCell>
                    <TableCell align="right">{(booking.adjustment.deltaAmountMinor / 100).toFixed(2)} GBP</TableCell>
                    <TableCell>Rev {booking.revisionNumber}</TableCell>
                    <TableCell>{new Date(booking.adjustment.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </AdminTable>
        </Box>
      ) : null}
    </Box>
  );
}

interface TicketTypeDialogSurfaceProps {
  open: boolean;
  editingTicketType: TicketTypeRow | null;
  title: string;
  description: string;
  price: string;
  sortOrder: string;
  audience: TicketAudience;
  accessGroup: { id: string; name: string } | null;
  userGroups: Array<{ id: string; name: string }>;
  loadingUserGroups: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
  onAudienceChange: (value: TicketAudience) => void;
  onAccessGroupChange: (value: { id: string; name: string } | null) => void;
}

export function TicketTypeDialogSurface({
  open,
  editingTicketType,
  title,
  description,
  price,
  sortOrder,
  audience,
  accessGroup,
  userGroups,
  loadingUserGroups,
  submitting,
  onClose,
  onSubmit,
  onTitleChange,
  onDescriptionChange,
  onPriceChange,
  onSortOrderChange,
  onAudienceChange,
  onAccessGroupChange,
}: TicketTypeDialogSurfaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingTicketType ? "Edit ticket type" : "Add ticket type"}</DialogTitle>
      <DialogContent>
        <TextField label="Title" fullWidth value={title} onChange={(event) => onTitleChange(event.target.value)} margin="dense" required />
        <TextField
          label="Description"
          fullWidth
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          margin="dense"
          multiline
        />
        <TextField
          label="Price"
          type="number"
          fullWidth
          value={price}
          onChange={(event) => onPriceChange(event.target.value)}
          margin="dense"
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          label="Sort order"
          type="number"
          fullWidth
          value={sortOrder}
          onChange={(event) => onSortOrderChange(event.target.value)}
          margin="dense"
        />
        <FormControl fullWidth margin="dense" sx={{ mt: 1 }}>
          <InputLabel id="ticket-audience-label">{TICKET_CATEGORY_LABEL}</InputLabel>
          <Select
            labelId="ticket-audience-label"
            label={TICKET_CATEGORY_LABEL}
            value={audience}
            onChange={(event) => onAudienceChange(event.target.value as TicketAudience)}
          >
            <MenuItem value={TicketAudience.MEMBER}>{getTicketCategoryLabel(TicketAudience.MEMBER)}</MenuItem>
            <MenuItem value={TicketAudience.GUEST}>{getTicketCategoryLabel(TicketAudience.GUEST)}</MenuItem>
          </Select>
        </FormControl>
        <Autocomplete
          options={userGroups}
          getOptionLabel={(option) => option.name}
          value={accessGroup}
          onChange={(_, value) => onAccessGroupChange(value)}
          loading={loadingUserGroups}
          renderInput={(params) => <TextField {...params} label="Access group" required margin="dense" />}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting || !title.trim() || !accessGroup}>
          {submitting ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function requestStatusColor(status: string): "warning" | "success" | "error" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "default";
}
