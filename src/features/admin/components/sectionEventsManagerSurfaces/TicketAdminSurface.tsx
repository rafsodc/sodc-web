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
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { BookingApprovalStatus } from "@dataconnect/generated";
import PageHeader from "../../../../shared/components/PageHeader";
import { getTicketCategoryLabel, TICKET_CATEGORY_LABEL } from "../../../../shared/utils/ticketAudienceLabels";
import type {
  EventBookingAdminRow,
  EventRow,
  BookingApprovalStatusFilter,
  BookingPaymentAdjustmentAdminRow,
  TicketOrderAdminRow,
  TicketTypeRow,
} from "../sectionEventsManagerTypes";
import type { EventAttendeeTicketRow, TicketOrdersById } from "../../utils/bookingApprovalsAdmin";
import {
  attendeePaymentState,
  eventTicketRowsCsv,
  previousActiveBooking,
} from "../../utils/bookingApprovalsAdmin";
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
  approvalStatusFilter: BookingApprovalStatusFilter;
  onApprovalStatusFilterChange: (value: BookingApprovalStatusFilter) => void;
  approvalBookings: EventBookingAdminRow[];
  allEventBookings: EventBookingAdminRow[];
  ticketOrdersById: TicketOrdersById;
  attendeeTickets: EventAttendeeTicketRow[];
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
      <AdminAccordion title="Booking approvals">
        <BookingApprovalsSection
          filter={approvalStatusFilter}
          onFilterChange={onApprovalStatusFilterChange}
          loading={loadingEventBookings}
          bookings={approvalBookings}
          allBookings={allEventBookings}
          ticketOrdersById={ticketOrdersById}
          moderatorNoteDraft={moderatorNoteDraft}
          onModeratorNoteChange={onModeratorNoteChange}
          reviewingBookingId={reviewingBookingId}
          onReview={onReviewBooking}
        />
      </AdminAccordion>
      <AdminAccordion title="Current attendee tickets">
        <EventAttendeeTicketsSection eventTitle={eventTitle} loading={loadingEventBookings} rows={attendeeTickets} />
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

const bookingApprovalActionsCellSx = {
  whiteSpace: "nowrap",
  verticalAlign: "top",
  minWidth: 168,
  width: 168,
} as const;

function BookingApprovalsSection({
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

function EventAttendeeTicketsSection({
  eventTitle,
  loading,
  rows,
}: {
  eventTitle: string;
  loading: boolean;
  rows: EventAttendeeTicketRow[];
}) {
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
  if (rows.length === 0) return <Alert severity="info">No active attendee tickets for this event.</Alert>;
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Export CSV</Button>
      </Box>
      <AdminTable minWidth={880}>
        <TableHead>
          <TableRow>
            <TableCell>Attendee</TableCell>
            <TableCell>Audience</TableCell>
            <TableCell>Ticket</TableCell>
            <TableCell>Dietary requirements</TableCell>
            <TableCell>Approval</TableCell>
            <TableCell>Payment</TableCell>
            <TableCell>Revision</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.attendeeName}</TableCell>
              <TableCell>{getTicketCategoryLabel(row.audience)}</TableCell>
              <TableCell>{row.ticketType}</TableCell>
              <TableCell>{row.dietaryNote ?? "—"}</TableCell>
              <TableCell><Chip size="small" label={row.approvalStatus.replaceAll("_", " ")} color={approvalStatusColor(row.approvalStatus)} /></TableCell>
              <TableCell><Chip size="small" variant="outlined" label={row.paymentState.replaceAll("_", " ")} /></TableCell>
              <TableCell>Rev {row.revisionNumber}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </AdminTable>
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

function approvalStatusColor(status: string): "warning" | "success" | "error" | "default" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "default";
}
