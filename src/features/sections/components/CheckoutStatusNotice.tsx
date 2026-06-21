import { useEffect, useMemo, useState } from "react";
import { Alert, AlertTitle, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { dataConnect } from "../../../config/firebase";
import { useGetMyTicketOrderById } from "@dataconnect/generated/react";
import { toCanonicalUuid } from "../../../shared/utils/uuid";
import { formatPaymentAmount } from "../../../shared/utils/currencyDisplay";

type CheckoutState = "success" | "cancel";

interface CheckoutStatusNoticeProps {
  checkoutState: CheckoutState;
  orderId: string | null;
  onDismiss: () => void;
}

const POLL_MS = 2500;
const MAX_POLLS = 8;

function formatMoney(amountMinor: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof amountMinor !== "number" || !currency) return null;
  return formatPaymentAmount(amountMinor, currency);
}

export default function CheckoutStatusNotice({ checkoutState, orderId, onDismiss }: CheckoutStatusNoticeProps) {
  const [pollCount, setPollCount] = useState(0);

  const canonicalOrderId = useMemo(() => {
    if (!orderId) return null;
    try {
      return toCanonicalUuid(orderId);
    } catch {
      return null;
    }
  }, [orderId]);

  const shouldQuery = checkoutState === "success" && Boolean(canonicalOrderId);
  const { data, isLoading, isError, refetch } = useGetMyTicketOrderById(
    dataConnect,
    { id: canonicalOrderId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: shouldQuery },
  );

  const order = data?.user?.ticketOrders?.[0];
  const status = order?.status;
  const shouldPoll = shouldQuery && status === "PENDING" && pollCount < MAX_POLLS;

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setTimeout(() => {
      setPollCount((prev) => prev + 1);
      void refetch();
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [refetch, shouldPoll, pollCount]);

  if (checkoutState === "cancel") {
    return (
      <Alert severity="warning" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Checkout cancelled</AlertTitle>
        No payment was taken. You can try checkout again when ready.
      </Alert>
    );
  }

  if (!orderId) {
    return (
      <Alert severity="error" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Unable to confirm payment</AlertTitle>
        We did not receive an order reference from checkout. Please contact support if your card was charged.
      </Alert>
    );
  }

  if (!canonicalOrderId) {
    return (
      <Alert severity="error" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Invalid payment reference</AlertTitle>
        The checkout response contained an invalid order id.
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Unable to load order status</AlertTitle>
        Please refresh the page in a moment, or contact support if this continues.
      </Alert>
    );
  }

  if (isLoading || status === "PENDING") {
    return (
      <Alert severity="info" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Payment processing</AlertTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">
            Your payment is being confirmed. This can take a few seconds.
          </Typography>
        </Stack>
      </Alert>
    );
  }

  if (!order) {
    return (
      <Alert severity="error" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Order not found</AlertTitle>
        We could not find this ticket order for your account.
      </Alert>
    );
  }

  if (status === "PAID") {
    const amountSummary = formatMoney(order.totalAmountMinor, order.currency);
    return (
      <Alert severity="success" onClose={onDismiss} sx={{ mb: 2 }}>
        <AlertTitle>Payment confirmed</AlertTitle>
        <Typography variant="body2" sx={{ mb: 0.75 }}>
          Your {order.ticketType?.title ?? "ticket"} purchase is complete.
        </Typography>
        <Typography variant="body2">Event: {order.event?.title ?? "Unknown event"}</Typography>
        <Typography variant="body2">Quantity: {order.quantity ?? 0}</Typography>
        <Typography variant="body2">Amount: {amountSummary ?? "Unknown amount"}</Typography>
        <Typography variant="body2">Reference: {order.id}</Typography>
      </Alert>
    );
  }

  return (
    <Alert severity="warning" onClose={onDismiss} sx={{ mb: 2 }}>
      <AlertTitle>Payment update required</AlertTitle>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Current order status: {status}.
        </Typography>
        <Button size="small" onClick={() => void refetch()}>
          Refresh status
        </Button>
      </Box>
    </Alert>
  );
}
