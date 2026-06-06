import {
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
import { Link as RouterLink } from "react-router-dom";
import { useGetMyBookings, useGetMyTicketOrders } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import PageHeader from "../../../shared/components/PageHeader";
import "../../../shared/components/PageContainer.css";
import { ROUTES } from "../../../constants/routes";
import { sectionDetailLocationState } from "../../../shared/navigation/sectionNavigationState";
import { getBookingStatusLabel } from "../../../shared/utils/paymentStatusLabels";
import {
  summarizeEventBookingPayment,
  summarizeGuestTicketRequests,
} from "../utils/eventBookingStatusSummary";
import {
  bookingStatusChipColor,
  formatBookingEventWhen,
  getMyBookingActionLabel,
} from "../utils/myBookingsDisplay";

interface MyBookingsProps {
  onBack: () => void;
}

function guestRequestsLabel(summary: ReturnType<typeof summarizeGuestTicketRequests>): string {
  if (summary.pendingCount > 0) {
    return `${summary.pendingCount} guest request${summary.pendingCount === 1 ? "" : "s"} pending`;
  }
  if (summary.approvedCount > 0) {
    return `${summary.approvedCount} guest request${summary.approvedCount === 1 ? "" : "s"} approved`;
  }
  if (summary.rejectedCount > 0) {
    return `${summary.rejectedCount} guest request${summary.rejectedCount === 1 ? "" : "s"} declined`;
  }
  return "No extra guest requests";
}

export default function MyBookings({ onBack }: MyBookingsProps) {
  const { data, isLoading, isError, error, refetch } = useGetMyBookings(dataConnect);
  const { data: ticketOrdersData } = useGetMyTicketOrders(dataConnect, { enabled: !isLoading });
  const bookings = data?.user?.bookings ?? [];
  const ticketOrders = ticketOrdersData?.user?.ticketOrders ?? [];

  return (
    <Box className="page-container">
      <PageHeader title="My Bookings" onBack={onBack} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your event bookings across all sections, with payment and guest-request status.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} aria-label="Loading bookings" />
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
          {error instanceof Error ? error.message : "We could not load your bookings. Please try again."}
        </Alert>
      ) : bookings.length === 0 ? (
        <Alert severity="info">
          You do not have any bookings yet. Open a section&apos;s events tab to book an upcoming event.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {bookings.map((booking) => {
            const paymentSummary = summarizeEventBookingPayment({
              booking,
              eventId: booking.event.id,
              ticketOrders,
              adjustments: [],
            });
            const guestSummary = summarizeGuestTicketRequests(booking.guestTicketRequests);
            const sectionId = booking.event.section.id;
            const eventId = booking.event.id;

            return (
              <Card key={booking.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                    <Chip
                      size="small"
                      label={getBookingStatusLabel(booking.status)}
                      color={bookingStatusChipColor(booking.status)}
                    />
                    <Chip size="small" label={`Revision ${booking.revisionNumber}`} variant="outlined" />
                    <Chip
                      size="small"
                      label={paymentSummary.label}
                      color={
                        paymentSummary.kind === "paid"
                          ? "success"
                          : paymentSummary.kind === "failed"
                            ? "error"
                            : paymentSummary.kind === "pending" ||
                                paymentSummary.kind === "not_started" ||
                                paymentSummary.kind === "partial"
                              ? "warning"
                              : "default"
                      }
                    />
                  </Stack>

                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {booking.event.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {booking.event.section.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {formatBookingEventWhen(booking.event.startDateTime, booking.event.endDateTime)}
                  </Typography>

                  {(booking.lines ?? []).length > 0 ? (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {(booking.lines ?? [])
                        .map((line) => line.ticketType?.title ?? "Ticket")
                        .join(" · ")}
                    </Typography>
                  ) : null}

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {guestRequestsLabel(guestSummary)}
                  </Typography>

                  <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                    <Button
                      component={RouterLink}
                      to={`/sections/${sectionId}`}
                      state={sectionDetailLocationState(ROUTES.HOME, { selectedEventId: eventId })}
                      variant="contained"
                      size="small"
                    >
                      {getMyBookingActionLabel(booking.status)}
                    </Button>
                    {paymentSummary.unpaidTicketTypeId ? (
                      <Button component={RouterLink} to={ROUTES.MY_PAYMENTS} variant="outlined" size="small">
                        View payments
                      </Button>
                    ) : null}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                    Updated {new Date(booking.updatedAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
