import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { GetEventByIdData } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import { formatSectionEventWhen } from "../../../shared/utils/sectionEventDisplay";
import { formatEventGuestPolicy } from "../utils/eventGuestPolicy";

type EventDetail = NonNullable<GetEventByIdData["event"]>;

export interface EventDetailHeroProps {
  event: EventDetail;
  hasCurrentUser: boolean;
  showBookButton: boolean;
  onBookClick: () => void;
}

export default function EventDetailHero({
  event,
  hasCurrentUser,
  showBookButton,
  onBookClick,
}: EventDetailHeroProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="h5" component="h2" fontWeight={600} gutterBottom>
        {event.title}
      </Typography>

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {formatSectionEventWhen(event.startDateTime, event.endDateTime)}
        </Typography>
        {event.location ? (
          <Typography variant="body2" color="text.secondary">
            {event.location}
          </Typography>
        ) : null}
        {event.guestOfHonour ? (
          <Typography variant="body2" color="text.secondary">
            Guest of honour: {event.guestOfHonour}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          Booking window: {new Date(event.bookingStartDateTime).toLocaleString()} –{" "}
          {new Date(event.bookingEndDateTime).toLocaleString()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatEventGuestPolicy(event.maxGuestsWithoutModeratorApproval)}
        </Typography>
      </Stack>

      {(event.ticketTypes ?? []).length > 0 ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: showBookButton ? 2 : 0 }}>
          {(event.ticketTypes ?? []).map((ticketType) => (
            <Chip
              key={ticketType.id}
              size="small"
              variant="outlined"
              label={`${ticketType.title}${ticketType.price != null ? ` · ${String(ticketType.price)}` : ""}`}
            />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: showBookButton ? 2 : 0 }}>
          Ticket types will be published soon.
        </Typography>
      )}

      {showBookButton && hasCurrentUser ? (
        <Button variant="contained" onClick={onBookClick} sx={{ backgroundColor: colors.callToAction }}>
          Book this event
        </Button>
      ) : null}
    </Paper>
  );
}
