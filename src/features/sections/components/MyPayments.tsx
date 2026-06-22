import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGetMyBookingPaymentAdjustments, useGetMyTicketOrders } from "@dataconnect/generated/react";
import { TicketOrderStatus } from "@dataconnect/generated";
import { dataConnect } from "../../../config/firebase";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";
import {
  getBookingPaymentAdjustmentStatusLabel,
  getTicketOrderStatusLabel,
} from "../../../shared/utils/paymentStatusLabels";
import { getMyTicketOrderStripeArtifactsBatch, reconcileMyCheckoutSessionOrders } from "../../../shared/utils/firebaseFunctions";
import { toCanonicalUuid, uuidsEqual } from "../../../shared/utils/uuid";
import {
  formatPaymentAmount,
  getBookingAdjustmentSummary,
  getTicketOrderOutcomeMessage,
  groupTicketOrdersForDisplay,
  ticketOrderStatusChipColor,
} from "../utils/myPaymentsDisplay";

interface MyPaymentsProps {
  onBack: () => void;
}

function artifactKey(orderId: string): string {
  try {
    return toCanonicalUuid(orderId);
  } catch {
    return String(orderId).trim().toLowerCase();
  }
}

export default function MyPayments({ onBack }: MyPaymentsProps) {
  const { data, isLoading, isError, error, refetch } = useGetMyTicketOrders(dataConnect);
  const { data: adjustmentsData } = useGetMyBookingPaymentAdjustments(dataConnect, { enabled: !isLoading });
  const [stripeArtifactsByOrderId, setStripeArtifactsByOrderId] = useState<
    Record<string, { receiptUrl: string | null }>
  >({});
  const attemptedStripeArtifactOrderIds = useRef<Set<string>>(new Set());
  const attemptedReconcileSessions = useRef<Set<string>>(new Set());
  const orders = useMemo(() => data?.user?.ticketOrders ?? [], [data?.user?.ticketOrders]);
  const paymentGroups = useMemo(() => groupTicketOrdersForDisplay(orders), [orders]);
  const bookingAdjustments = (adjustmentsData?.user?.bookings ?? []).flatMap((booking) =>
    (booking.adjustments ?? []).map((adjustment) => ({
      bookingId: booking.id,
      eventTitle: booking.event?.title ?? "Event",
      revisionNumber: booking.revisionNumber,
      ...adjustment,
    }))
  );

  useEffect(() => {
    if (isLoading || paymentGroups.length === 0) {
      return;
    }
    const pendingOrderIds = paymentGroups
      .map((group) => group.receiptOrderId)
      .filter((orderId) => !attemptedStripeArtifactOrderIds.current.has(artifactKey(orderId)));
    if (pendingOrderIds.length === 0) {
      return;
    }
    for (const orderId of pendingOrderIds) {
      attemptedStripeArtifactOrderIds.current.add(artifactKey(orderId));
    }
    const load = async (): Promise<void> => {
      try {
        const artifacts = await getMyTicketOrderStripeArtifactsBatch({ orderIds: pendingOrderIds });
        const normalizedArtifacts = Object.fromEntries(
          Object.entries(artifacts.artifactsByOrderId).map(([orderId, value]) => [artifactKey(orderId), value])
        );
        setStripeArtifactsByOrderId((prev) => ({ ...prev, ...normalizedArtifacts }));
      } catch {
        // Receipt links are optional; fail silently on the member UI.
      }
    };
    void load();
  }, [isLoading, paymentGroups]);

  useEffect(() => {
    if (isLoading || orders.length === 0) {
      return;
    }
    const reconcileAnchor = orders.find(
      (order) =>
        order.status === TicketOrderStatus.PAID &&
        (order.stripeCheckoutSessionId || order.stripePaymentIntentId) &&
        orders.some(
          (candidate) =>
            candidate.id !== order.id &&
            uuidsEqual(candidate.event?.id, order.event?.id) &&
            candidate.status !== TicketOrderStatus.PAID
        )
    );
    if (!reconcileAnchor) {
      return;
    }
    const sessionKey =
      reconcileAnchor.stripeCheckoutSessionId ?? reconcileAnchor.stripePaymentIntentId ?? reconcileAnchor.id;
    if (attemptedReconcileSessions.current.has(sessionKey)) {
      return;
    }
    attemptedReconcileSessions.current.add(sessionKey);
    void reconcileMyCheckoutSessionOrders({ orderId: reconcileAnchor.id })
      .then(() => refetch())
      .catch(() => {
        attemptedReconcileSessions.current.delete(sessionKey);
      });
  }, [isLoading, orders, refetch]);

  return (
    <Box className="page-container">
      <PageHeader title="My Payments" onBack={onBack} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your ticket payments and receipts across events.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} aria-label="Loading payments" />
        </Box>
      ) : isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error instanceof Error ? error.message : "We could not load your payment history. Please try again."}
        </Alert>
      ) : paymentGroups.length === 0 ? (
        <Alert severity="info">
          You have not made any ticket payments yet. After you pay for an event, your receipts will appear here.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {paymentGroups.map((group) => {
            const receiptUrl = stripeArtifactsByOrderId[artifactKey(group.receiptOrderId)]?.receiptUrl ?? null;
            const eventWhen = group.eventWhen
              ? new Date(group.eventWhen).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : null;
            const outcomeMessage = getTicketOrderOutcomeMessage(group.orders[0]);

            return (
              <Card key={group.key} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 1 }}>
                    <Chip
                      size="small"
                      label={getTicketOrderStatusLabel(group.status)}
                      color={ticketOrderStatusChipColor(group.status)}
                    />
                    {receiptUrl ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => window.open(receiptUrl, "_blank", "noopener,noreferrer")}
                      >
                        View receipt
                      </Button>
                    ) : null}
                  </Stack>

                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {group.eventTitle}
                  </Typography>

                  {eventWhen ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Event: {eventWhen}
                    </Typography>
                  ) : null}

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {group.ticketSummary}
                    {" · "}
                    {formatPaymentAmount(group.totalAmountMinor, group.currency)}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {outcomeMessage}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Last updated {new Date(group.orders[0].updatedAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}

          {bookingAdjustments.length > 0 ? (
            <Accordion variant="outlined" disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Booking changes ({bookingAdjustments.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  {bookingAdjustments.map((adjustment) => (
                    <Box key={adjustment.id}>
                      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Chip
                          size="small"
                          label={getBookingPaymentAdjustmentStatusLabel(adjustment.status)}
                          color="warning"
                          variant="outlined"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(adjustment.updatedAt).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2">
                        {getBookingAdjustmentSummary({
                          eventTitle: adjustment.eventTitle,
                          revisionNumber: adjustment.revisionNumber,
                          deltaAmountMinor: adjustment.deltaAmountMinor,
                          status: adjustment.status,
                        })}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
