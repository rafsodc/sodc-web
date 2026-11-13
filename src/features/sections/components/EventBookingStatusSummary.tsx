import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { GetMyBookingsForEventData } from "@dataconnect/generated";
import { ROUTES } from "../../../constants/routes";
import { formatGbpMajorAmount } from "../../../shared/utils/currencyDisplay";
import {
  buildBookingTicketRowsWithPaymentStatus,
  bookingTicketPaymentChipColor,
  isBookingPaymentComplete,
  summarizeEventBookingPayment,
  type EventBookingPaymentAdjustmentInput,
  type EventBookingPaymentOrderInput,
  type EventBookingPaymentSummary,
} from "../utils/eventBookingStatusSummary";

type TerminalBooking = NonNullable<GetMyBookingsForEventData["user"]>["bookings"][number];
type TicketRow = ReturnType<typeof buildBookingTicketRowsWithPaymentStatus>[number];

function TicketPaymentStatus({ row }: { row: TicketRow }) {
  return (
    <Chip
      size="small"
      label={row.paymentStatusLabel}
      color={bookingTicketPaymentChipColor(row.paymentStatus)}
      variant={row.paymentStatus === "awaiting_approval" ? "outlined" : "filled"}
      sx={{ maxWidth: "100%", height: "auto", minHeight: 24, "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.5 } }}
    />
  );
}

export interface EventBookingStatusSummaryProps {
  booking: TerminalBooking;
  paymentBooking?: TerminalBooking | null;
  eventId: string;
  eventTitle: string;
  ticketOrders: EventBookingPaymentOrderInput[];
  paymentAdjustments: EventBookingPaymentAdjustmentInput[];
  onEditBooking?: () => void;
  onPayNow?: (ticketTypeId: string) => void;
  payingTicketTypeId?: string | null;
}

function bookingStatusCard(
  booking: TerminalBooking,
  paymentSummary: EventBookingPaymentSummary,
  hasSeparatePaymentBooking: boolean,
  canEdit: boolean,
  allTicketsRemoved: boolean
) {
  if (booking.approvalStatus === "PENDING") {
    return {
      heading: "Awaiting approval",
      severity: "warning" as const,
      message: hasSeparatePaymentBooking
        ? "Your changes are with the organiser for approval. Your current approved booking remains active and can still be paid while you wait."
        : "Your complete booking is with the organiser for approval. Payment will become available when it is approved.",
    };
  }
  if (booking.approvalStatus === "REJECTED") {
    return {
      heading: "Changes requested",
      severity: "error" as const,
      message: booking.approvalNote?.trim() || "The organiser has asked you to update your booking.",
    };
  }
  if (paymentSummary.kind === "pending" || paymentSummary.kind === "adjustment_refund") {
    return {
      heading: "Payment processing",
      severity: "info" as const,
      message: paymentSummary.kind === "adjustment_refund"
        ? "Your booking change is saved and the refund is being processed."
        : "Your payment is being processed. This page will update when it completes.",
    };
  }
  if (allTicketsRemoved) {
    return {
      heading: "No active tickets",
      severity: "info" as const,
      message: "All tickets in this booking have been removed. Contact an organiser if you expected to attend or need help with payment.",
    };
  }
  if (isBookingPaymentComplete(paymentSummary) || booking.status === "CONFIRMED") {
    return {
      heading: "Confirmed",
      severity: "success" as const,
      message: canEdit
        ? "Your booking is confirmed. You can edit unpaid guest details while the booking window remains open."
        : "Your booking is confirmed.",
    };
  }
  if (paymentSummary.kind === "failed") {
    return {
      heading: "Payment required",
      severity: "error" as const,
      message: "The last payment attempt did not complete. Try payment again to confirm the booking.",
    };
  }
  return {
    heading: "Payment required",
    severity: "warning" as const,
    message: "Your booking is approved. Pay for all tickets to confirm it.",
  };
}

export default function EventBookingStatusSummary({
  booking,
  paymentBooking,
  eventId,
  eventTitle,
  ticketOrders,
  paymentAdjustments,
  onEditBooking,
  onPayNow,
  payingTicketTypeId,
}: EventBookingStatusSummaryProps) {
  const theme = useTheme();
  const compactLayout = useMediaQuery(theme.breakpoints.down("sm"));
  const effectivePaymentBooking = paymentBooking ?? (
    booking.approvalStatus === "NOT_REQUIRED" || booking.approvalStatus === "APPROVED"
      ? booking
      : null
  );
  const paymentDisplayBooking = effectivePaymentBooking ?? booking;
  const hasSeparatePaymentBooking =
    effectivePaymentBooking != null && effectivePaymentBooking.id !== booking.id;
  const paymentSummary = summarizeEventBookingPayment({
    booking: paymentDisplayBooking,
    eventId,
    ticketOrders,
    adjustments: paymentAdjustments,
  });
  const ticketRows = buildBookingTicketRowsWithPaymentStatus({
    booking: paymentDisplayBooking,
    eventId,
    ticketOrders,
  });
  const allTicketsRemoved = (paymentDisplayBooking.lines?.length ?? 0) > 0 &&
    paymentDisplayBooking.lines.every((line) => line.bookingPlace?.attendanceRemoved === true);
  const statusCard = bookingStatusCard(
    booking, paymentSummary, hasSeparatePaymentBooking, Boolean(onEditBooking), allTicketsRemoved
  );
  const showPayNow =
    Boolean(onPayNow) &&
    effectivePaymentBooking != null &&
    paymentSummary.unpaidTicketTypeId != null &&
    !isBookingPaymentComplete(paymentSummary) &&
    paymentSummary.kind !== "adjustment_refund";

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mt: 3, minWidth: 0, overflowWrap: "anywhere" }}>
      <Typography component="h3" variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
        {statusCard.heading}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your booking for <strong>{eventTitle}</strong>
      </Typography>

      <Alert severity={statusCard.severity} sx={{ mb: 2 }}>
        {statusCard.message}
      </Alert>

      {ticketRows.length > 0 ? (
        <>
          {hasSeparatePaymentBooking ? (
            <Typography component="p" variant="subtitle2" sx={{ mb: 1 }}>
              Current active booking
            </Typography>
          ) : null}
          {compactLayout ? (
            <Box component="ul" role="list" aria-label="Booking tickets" sx={{ listStyle: "none", p: 0, m: 0, mb: 2, display: "grid", gap: 1.25 }}>
              {ticketRows.map((row) => (
                <Box component="li" key={row.id} sx={{ minWidth: 0, border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                  <Typography component="h4" variant="subtitle2" sx={{ mb: 1 }}>{row.ticketTitle}</Typography>
                  <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 0.75, alignItems: "start", "& dt": { fontWeight: 600 }, "& dd": { m: 0, minWidth: 0 } }}>
                    <Typography component="dt" variant="body2">Guest</Typography>
                    <Typography component="dd" variant="body2">{row.guestName ?? "—"}</Typography>
                    <Typography component="dt" variant="body2">Price</Typography>
                    <Typography component="dd" variant="body2">{formatGbpMajorAmount(row.price)}</Typography>
                    <Typography component="dt" variant="body2">Payment</Typography>
                    <Box component="dd"><TicketPaymentStatus row={row} /></Box>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
          <Table size="small" sx={{ mb: 2, tableLayout: "fixed", width: "100%", "& th, & td": { px: { sm: 1, md: 2 }, overflowWrap: "anywhere", verticalAlign: "top" } }}>
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Guest</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Payment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ticketRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.ticketTitle}
                </TableCell>
                <TableCell>{row.guestName ?? "—"}</TableCell>
                <TableCell>{formatGbpMajorAmount(row.price)}</TableCell>
                <TableCell>
                  <TicketPaymentStatus row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
          )}
        </>
      ) : null}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, flexWrap: "wrap", gap: 1, "& .MuiButton-root": { minHeight: { xs: 44, sm: 36 } } }}>
        {showPayNow ? (
          <Button
            variant="contained"
            disabled={payingTicketTypeId === paymentSummary.unpaidTicketTypeId}
            onClick={() => onPayNow?.(paymentSummary.unpaidTicketTypeId as string)}
            sx={{ backgroundColor: "secondary.main", color: "secondary.contrastText" }}
          >
            {payingTicketTypeId === paymentSummary.unpaidTicketTypeId ? "Starting checkout…" : "Pay for all tickets"}
          </Button>
        ) : null}
        {onEditBooking ? (
          <Button variant={booking.approvalStatus === "REJECTED" ? "contained" : "outlined"} onClick={onEditBooking}>
            Edit booking
          </Button>
        ) : null}
        {booking.approvalStatus !== "REJECTED" ? (
          <Button component={RouterLink} to={ROUTES.MY_BOOKINGS} variant="text">
            View in My Bookings
          </Button>
        ) : null}
      </Box>
    </Paper>
  );
}
