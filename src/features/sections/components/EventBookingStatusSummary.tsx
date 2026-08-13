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

export interface EventBookingStatusSummaryProps {
  booking: TerminalBooking;
  paymentBooking?: TerminalBooking | null;
  eventId: string;
  eventTitle: string;
  ticketOrders: EventBookingPaymentOrderInput[];
  paymentAdjustments: EventBookingPaymentAdjustmentInput[];
  onEditBooking: () => void;
  onPayNow?: (ticketTypeId: string) => void;
  payingTicketTypeId?: string | null;
}

function bookingStatusCard(
  booking: TerminalBooking,
  paymentSummary: EventBookingPaymentSummary,
  hasSeparatePaymentBooking: boolean
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
  if (isBookingPaymentComplete(paymentSummary) || booking.status === "CONFIRMED") {
    return {
      heading: "Confirmed",
      severity: "success" as const,
      message: "Your booking is confirmed. You can edit unpaid guest details while the booking window remains open.",
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
  const statusCard = bookingStatusCard(booking, paymentSummary, hasSeparatePaymentBooking);
  const showPayNow =
    Boolean(onPayNow) &&
    effectivePaymentBooking != null &&
    paymentSummary.unpaidTicketTypeId != null &&
    !isBookingPaymentComplete(paymentSummary) &&
    paymentSummary.kind !== "adjustment_refund";

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
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
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Current active booking
            </Typography>
          ) : null}
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
            {ticketRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.ticketTitle}
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
        </>
      ) : null}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
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
        <Button variant={booking.approvalStatus === "REJECTED" ? "contained" : "outlined"} onClick={onEditBooking}>
          Edit booking
        </Button>
        {booking.approvalStatus !== "REJECTED" ? (
          <Button component={RouterLink} to={ROUTES.MY_BOOKINGS} variant="text">
            View in My Bookings
          </Button>
        ) : null}
      </Box>
    </Paper>
  );
}
