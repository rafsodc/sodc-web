import { Alert, Box, Button, Chip, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useEffect, useState } from "react";
import { useGetMyBookingPaymentAdjustments, useGetMyTicketOrders } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";
import { getMyTicketOrderStripeArtifactsBatch } from "../../../shared/utils/firebaseFunctions";

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
  const [loadingStripeLinks, setLoadingStripeLinks] = useState(false);
  const [stripeArtifactsByOrderId, setStripeArtifactsByOrderId] = useState<
    Record<string, { receiptUrl: string | null; hostedInvoiceUrl: string | null; invoicePdfUrl: string | null }>
  >({});
  const [stripeArtifactError, setStripeArtifactError] = useState<string | null>(null);
  const orders = data?.user?.ticketOrders ?? [];
  const bookingAdjustments = (adjustmentsData?.user?.bookings ?? []).flatMap((booking) =>
    (booking.adjustments ?? []).map((adjustment) => ({
      bookingId: booking.id,
      eventTitle: booking.event?.title ?? "—",
      revisionNumber: booking.revisionNumber,
      ...adjustment,
    }))
  );

  useEffect(() => {
    if (isLoading || orders.length === 0) {
      return;
    }
    const orderIds = orders.map((order) => order.id);
    const missingOrderIds = orderIds.filter((id) => !stripeArtifactsByOrderId[id]);
    if (missingOrderIds.length === 0) {
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoadingStripeLinks(true);
      setStripeArtifactError(null);
      try {
        const artifacts = await getMyTicketOrderStripeArtifactsBatch({ orderIds: missingOrderIds });
        if (!cancelled) {
          setStripeArtifactsByOrderId((prev) => ({ ...prev, ...artifacts.artifactsByOrderId }));
        }
      } catch (error) {
        if (!cancelled) {
          setStripeArtifactError(error instanceof Error ? error.message : "Failed to load Stripe links.");
        }
      } finally {
        if (!cancelled) {
          setLoadingStripeLinks(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoading, orders, stripeArtifactsByOrderId]);

  return (
    <Box className="page-container">
      <PageHeader title="My Payments" onBack={onBack} />
      {stripeArtifactError ? <Alert severity="error">{stripeArtifactError}</Alert> : null}
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
                  <TableCell>Stripe artifacts</TableCell>
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
                    <TableCell>
                      {stripeArtifactsByOrderId[order.id]?.receiptUrl ? (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => window.open(stripeArtifactsByOrderId[order.id].receiptUrl as string, "_blank")}
                        >
                          View receipt
                        </Button>
                      ) : null}
                      {stripeArtifactsByOrderId[order.id]?.hostedInvoiceUrl ? (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() =>
                            window.open(stripeArtifactsByOrderId[order.id].hostedInvoiceUrl as string, "_blank")
                          }
                        >
                          View hosted invoice
                        </Button>
                      ) : null}
                      {stripeArtifactsByOrderId[order.id]?.invoicePdfUrl ? (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => window.open(stripeArtifactsByOrderId[order.id].invoicePdfUrl as string, "_blank")}
                        >
                          View invoice PDF
                        </Button>
                      ) : null}
                      {!stripeArtifactsByOrderId[order.id] && loadingStripeLinks ? (
                        <Chip size="small" label="Loading links..." />
                      ) : null}
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
