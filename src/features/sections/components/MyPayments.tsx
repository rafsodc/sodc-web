import { Alert, Box, Chip, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useGetMyBookingPaymentAdjustments, useGetMyTicketOrders } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";

interface MyPaymentsProps {
  onBack: () => void;
}

function statusChipColor(status: string): "success" | "error" | "warning" | "default" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "error";
  if (status === "REFUNDED") return "warning";
  return "default";
}

export default function MyPayments({ onBack }: MyPaymentsProps) {
  const { data, isLoading, isError, error, refetch } = useGetMyTicketOrders(dataConnect);
  const { data: adjustmentsData } = useGetMyBookingPaymentAdjustments(dataConnect, { enabled: !isLoading });
  const orders = data?.user?.ticketOrders ?? [];
  const bookingAdjustments = (adjustmentsData?.user?.bookings ?? [])
    .map((booking) => {
      if (!booking.adjustment) {
        return null;
      }
      return {
        bookingId: booking.id,
        eventTitle: booking.event?.title ?? "—",
        revisionNumber: booking.revisionNumber,
        ...booking.adjustment,
      };
    })
    .filter((adjustment): adjustment is NonNullable<typeof adjustment> => adjustment !== null);

  return (
    <Box className="page-container">
      <PageHeader title="My Payments" onBack={onBack} />
      {isLoading ? (
        <CircularProgress size={24} />
      ) : isError ? (
        <Alert severity="error" action={<Chip label="Retry" onClick={() => refetch()} clickable size="small" />}>
          {error instanceof Error ? error.message : "Failed to load payment history."}
        </Alert>
      ) : orders.length === 0 ? (
        <Alert severity="info">No payment orders found yet.</Alert>
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Ticket</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Lifecycle detail</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Chip size="small" label={order.status} color={statusChipColor(order.status)} />
                    </TableCell>
                    <TableCell>{order.event?.title ?? "—"}</TableCell>
                    <TableCell>{order.ticketType?.title ?? "—"}</TableCell>
                    <TableCell align="right">{order.quantity}</TableCell>
                    <TableCell align="right">
                      {(order.totalAmountMinor / 100).toFixed(2)} {order.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {order.status === "FAILED"
                        ? "Payment attempt failed. You can try booking again."
                        : order.status === "REFUNDED"
                          ? `Refunded ${((order.refundedAmountMinor ?? 0) / 100).toFixed(2)} ${order.currency.toUpperCase()}`
                          : order.disputeStatus
                            ? `Dispute: ${order.disputeStatus}${order.disputeReason ? ` (${order.disputeReason})` : ""}`
                            : "Payment settled"}
                    </TableCell>
                    <TableCell>{new Date(order.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {bookingAdjustments.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Adjustment status</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell align="right">Delta</TableCell>
                    <TableCell>Booking revision</TableCell>
                    <TableCell>Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookingAdjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell>
                        <Chip size="small" label={adjustment.status.replaceAll("_", " ")} color="warning" />
                      </TableCell>
                      <TableCell>{adjustment.eventTitle}</TableCell>
                      <TableCell align="right">{(adjustment.deltaAmountMinor / 100).toFixed(2)} GBP</TableCell>
                      <TableCell>Rev {adjustment.revisionNumber}</TableCell>
                      <TableCell>{new Date(adjustment.updatedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
