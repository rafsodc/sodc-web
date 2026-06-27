import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { GetEventByIdData } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import { formatSectionEventWhen } from "../../../shared/utils/sectionEventDisplay";
import { formatGbpMajorAmount } from "../../../shared/utils/currencyDisplay";
import { formatEventGuestPolicy } from "../utils/eventGuestPolicy";

type EventDetail = NonNullable<GetEventByIdData["event"]>;

export interface EventDetailHeroProps {
  event: EventDetail;
  hasCurrentUser: boolean;
  showBookButton: boolean;
  onBookClick: () => void;
}

function formatBookingWindow(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `Bookings open ${s} – ${e}`;
}

export default function EventDetailHero({
  event,
  hasCurrentUser,
  showBookButton,
  onBookClick,
}: EventDetailHeroProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Typography variant="h5" component="h2" fontWeight={600}>
          {event.title}
        </Typography>
        {showBookButton && hasCurrentUser ? (
          <Button
            variant="contained"
            onClick={onBookClick}
            sx={{ ml: 2, flexShrink: 0, backgroundColor: colors.callToAction }}
          >
            Book
          </Button>
        ) : null}
      </Stack>

      <Stack spacing={0.75} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {formatSectionEventWhen(event.startDateTime, event.endDateTime)}
        </Typography>
        {event.location ? (
          <Typography variant="body2" color="text.secondary">
            {event.location}
          </Typography>
        ) : null}
        {event.guestOfHonour ? (
          <Typography variant="body2" fontWeight={500}>
            Guest of honour: {event.guestOfHonour}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {formatBookingWindow(event.bookingStartDateTime, event.bookingEndDateTime)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatEventGuestPolicy(event.maxGuestsWithoutModeratorApproval)}
        </Typography>
      </Stack>

      {(event.ticketTypes ?? []).length > 0 ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {(event.ticketTypes ?? []).map((ticketType) => (
            <Chip
              key={ticketType.id}
              size="small"
              variant="outlined"
              label={`${ticketType.title}${ticketType.price != null ? ` · ${formatGbpMajorAmount(ticketType.price)}` : ""}`}
            />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Ticket types will be published soon.
        </Typography>
      )}
    </Paper>
  );
}
