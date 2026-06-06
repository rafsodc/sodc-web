import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { GetMyBookingsForEventData } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import { ROUTES } from "../../../constants/routes";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import {
  getEventBookingNextSteps,
  getEventBookingStatusHeading,
  summarizeEventBookingPayment,
  summarizeGuestTicketRequests,
  type EventBookingPaymentAdjustmentInput,
  type EventBookingPaymentOrderInput,
  type EventBookingPaymentSummary,
} from "../utils/eventBookingStatusSummary";

type TerminalBooking = NonNullable<GetMyBookingsForEventData["user"]>["bookings"][number];

export interface EventBookingStatusSummaryProps {
  booking: TerminalBooking;
  eventId: string;
  eventTitle: string;
  ticketOrders: EventBookingPaymentOrderInput[];
  paymentAdjustments: EventBookingPaymentAdjustmentInput[];
  onEditBooking: () => void;
  onPayNow?: (ticketTypeId: string) => void;
  payingTicketTypeId?: string | null;
}

function paymentChipColor(
  summary: EventBookingPaymentSummary
): "success" | "warning" | "error" | "info" | "default" {
  switch (summary.severity) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "error";
    case "info":
      return "info";
    default:
      return "default";
  }
}

function guestStatusLabel(summary: ReturnType<typeof summarizeGuestTicketRequests>): string {
  if (summary.pendingCount > 0) {
    return `${summary.pendingCount} pending review`;
  }
  if (summary.approvedCount > 0 && summary.rejectedCount > 0) {
    return `${summary.approvedCount} approved, ${summary.rejectedCount} declined`;
  }
  if (summary.approvedCount > 0) {
    return `${summary.approvedCount} approved`;
  }
  if (summary.rejectedCount > 0) {
    return `${summary.rejectedCount} declined`;
  }
  return "None";
}

export default function EventBookingStatusSummary({
  booking,
  eventId,
  eventTitle,
  ticketOrders,
  paymentAdjustments,
  onEditBooking,
  onPayNow,
  payingTicketTypeId,
}: EventBookingStatusSummaryProps) {
  const paymentSummary = summarizeEventBookingPayment({
    booking,
    eventId,
    ticketOrders,
    adjustments: paymentAdjustments,
  });
  const guestSummary = summarizeGuestTicketRequests(booking.guestTicketRequests);
  const nextSteps = getEventBookingNextSteps({
    bookingStatus: booking.status,
    paymentSummary,
    guestSummary,
  });
  const showPayNow =
    Boolean(onPayNow) &&
    paymentSummary.unpaidTicketTypeId != null &&
    paymentSummary.kind !== "paid" &&
    paymentSummary.kind !== "adjustment_refund";

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
        Your booking
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <Chip
          size="small"
          label={getBookingStatusLabel(booking.status)}
          color={booking.status === "CONFIRMED" ? "success" : "default"}
        />
        <Chip size="small" label={`Revision ${booking.revisionNumber}`} variant="outlined" />
        <Chip size="small" label={paymentSummary.label} color={paymentChipColor(paymentSummary)} />
        <Chip
          size="small"
          label={`Guest requests: ${guestStatusLabel(guestSummary)}`}
          color={guestSummary.hasPending ? "warning" : "default"}
          variant={guestSummary.hasPending ? "filled" : "outlined"}
        />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {getEventBookingStatusHeading(booking)} for <strong>{eventTitle}</strong>.
      </Typography>

      {(booking.lines ?? []).length > 0 ? (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Guest</TableCell>
              <TableCell>Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(booking.lines ?? []).map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.ticketType?.title ?? "—"}</TableCell>
                <TableCell>{line.guestDisplayName ?? "—"}</TableCell>
                <TableCell>{line.ticketType?.price != null ? String(line.ticketType.price) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <Alert
        severity={
          paymentSummary.kind === "failed"
            ? "error"
            : guestSummary.hasPending || paymentSummary.kind === "pending" || paymentSummary.kind === "not_started"
              ? "warning"
              : "info"
        }
        sx={{ mb: 2 }}
      >
        {nextSteps}
      </Alert>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {showPayNow ? (
          <Button
            variant="contained"
            disabled={payingTicketTypeId === paymentSummary.unpaidTicketTypeId}
            onClick={() => onPayNow?.(paymentSummary.unpaidTicketTypeId as string)}
            sx={{ backgroundColor: colors.callToAction }}
          >
            {payingTicketTypeId === paymentSummary.unpaidTicketTypeId ? "Starting checkout…" : "Pay now"}
          </Button>
        ) : null}
        <Button variant="outlined" onClick={onEditBooking}>
          Edit booking
        </Button>
        <Button component={RouterLink} to={ROUTES.MY_PAYMENTS} variant="text">
          View in My Bookings
        </Button>
      </Box>
    </Paper>
  );
}
