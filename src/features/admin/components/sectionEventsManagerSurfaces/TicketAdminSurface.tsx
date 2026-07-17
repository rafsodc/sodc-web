import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { GuestTicketRequestStatus } from "@dataconnect/generated";
import PageHeader from "../../../../shared/components/PageHeader";
import { getTicketCategoryLabel, TICKET_CATEGORY_LABEL } from "../../../../shared/utils/ticketAudienceLabels";
import type {
  EventBookingAdminRow,
  EventRow,
  GuestRequestStatusFilter,
  GuestTicketRequestWithBooking,
  BookingPaymentAdjustmentAdminRow,
  TicketOrderAdminRow,
  TicketTypeRow,
} from "../sectionEventsManagerTypes";
import { AdminAccordion, AdminTable } from "./adminSurfacePrimitives";

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

const guestRequestActionsCellSx = {
  whiteSpace: "nowrap",
  verticalAlign: "top",
  minWidth: 168,
  width: 168,
} as const;

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
        <AdminTable minWidth={1040}>
            <TableHead>
              <TableRow>
                <TableCell sx={guestRequestActionsCellSx}>Actions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Booker</TableCell>
                <TableCell>Guest</TableCell>
                <TableCell>Ticket</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell sx={{ minWidth: 120, maxWidth: 180 }}>Dietary</TableCell>
                <TableCell sx={{ minWidth: 180, maxWidth: 220 }}>Moderator note</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Created</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Reviewed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id} sx={{ verticalAlign: "top" }}>
                  <TableCell sx={guestRequestActionsCellSx}>
                    {request.status === "PENDING" ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "stretch" }}>
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
                  <TableCell>
                    <Chip size="small" label={request.status} color={requestStatusColor(request.status)} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {request.booker ? `${request.booker.firstName} ${request.booker.lastName}` : "—"}
                  </TableCell>
                  <TableCell>{request.guestDisplayName ?? "—"}</TableCell>
                  <TableCell>{request.guestTicketType?.title ?? "—"}</TableCell>
                  <TableCell align="right">{request.requestedGuestCount}</TableCell>
                  <TableCell sx={{ minWidth: 120, maxWidth: 180 }}>{request.dietaryNote ?? "—"}</TableCell>
                  <TableCell sx={{ minWidth: 180, maxWidth: 220, overflow: "hidden" }}>
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
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(request.createdAt).toLocaleString()}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}
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
                <TableCell>Revision</TableCell>
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
              {bookingPaymentAdjustments.flatMap((booking) =>
                (booking.adjustments ?? []).map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>
                      <Chip size="small" color="warning" label={adjustment.status.replaceAll("_", " ")} />
                    </TableCell>
                    <TableCell>{booking.booker ? `${booking.booker.firstName} ${booking.booker.lastName}` : "—"}</TableCell>
                    <TableCell align="right">{(adjustment.deltaAmountMinor / 100).toFixed(2)} GBP</TableCell>
                    <TableCell>Rev {booking.revisionNumber}</TableCell>
                    <TableCell>{new Date(adjustment.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </AdminTable>
        </Box>
      ) : null}
    </Box>
  );
}

function requestStatusColor(status: string): "warning" | "success" | "error" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "default";
}
