import { Alert, Box, Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { colors } from "../../../../config/colors";
import { formatGbpMajorAmount } from "../../../../shared/utils/currencyDisplay";
import {
  bookingTicketPaymentChipColor,
  type BookingTicketDisplayRowWithPayment,
} from "../../utils/eventBookingStatusSummary";

interface PaymentStepProps {
  paymentTicketRows: BookingTicketDisplayRowWithPayment[];
  canProceedToConfirmation: boolean;
  pendingGuestTicketsAwaitingApproval: boolean;
  payingAllTickets: boolean;
  onPayAllTickets: () => void;
}

export default function PaymentStep({
  paymentTicketRows,
  canProceedToConfirmation,
  pendingGuestTicketsAwaitingApproval,
  payingAllTickets,
  onPayAllTickets,
}: PaymentStepProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pay now to secure your place. If you'd rather come back to it, you'll find the payment link
        in your booking summary.
      </Typography>

      {paymentTicketRows.length > 0 ? (
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
            {paymentTicketRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.ticketTitle}
                  {row.source === "approved_guest_request" ? (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                      (approved extra guest)
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{row.guestName ?? "—"}</TableCell>
                <TableCell>{formatGbpMajorAmount(row.price ?? 0)}</TableCell>
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
      ) : null}

      {!canProceedToConfirmation ? (
        <Button
          variant="contained"
          disabled={payingAllTickets}
          onClick={onPayAllTickets}
          sx={{ mt: 1, backgroundColor: colors.callToAction }}
        >
          {payingAllTickets ? "Starting checkout…" : "Pay for all tickets"}
        </Button>
      ) : pendingGuestTicketsAwaitingApproval ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          All tickets due now are paid. When your additional guest request is approved, return here to
          pay for their ticket.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mt: 1 }}>
          Payment complete. Continue to confirmation when you are ready.
        </Alert>
      )}
    </Box>
  );
}
