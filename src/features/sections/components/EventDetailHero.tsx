import type { ReactNode } from "react";
import {
  AccessTimeOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  EventAvailableOutlined,
  GroupOutlined,
  LocationOnOutlined,
  PersonOutline,
} from "@mui/icons-material";
import { Box, Paper, Typography } from "@mui/material";
import type { GetEventByIdData } from "@dataconnect/generated";
import { formatEventGuestPolicy } from "../utils/eventGuestPolicy";

type EventDetail = NonNullable<GetEventByIdData["event"]>;

export interface EventDetailHeroProps {
  event: EventDetail;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function sameCalendarDay(start: Date, end: Date): boolean {
  return (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  );
}

function formatEventDate(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  return sameCalendarDay(start, end)
    ? dateFormatter.format(start)
    : `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

function formatEventTime(startDateTime: string, endDateTime: string): string {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  return sameCalendarDay(start, end)
    ? `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
    : `Starts ${timeFormatter.format(start)} · Ends ${timeFormatter.format(end)}`;
}

function formatBookingWindow(startDateTime: string, endDateTime: string): string {
  return `${shortDateFormatter.format(new Date(startDateTime))} to ${shortDateFormatter.format(new Date(endDateTime))}`;
}

function EventMetaItem({
  icon,
  label,
  children,
  fullWidth = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: "action.hover",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <Box sx={{ color: "primary.main", display: "flex", mt: 0.25 }} aria-hidden="true">
        {icon}
      </Box>
      <Box>
        <Typography
          variant="caption"
          component="div"
          color="text.secondary"
          fontWeight={700}
          sx={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
        >
          {label}
        </Typography>
        <Typography variant="body2" component="div" sx={{ mt: 0.25, whiteSpace: "pre-line" }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

export default function EventDetailHero({ event }: EventDetailHeroProps) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
      <Typography variant="h5" component="h2" fontWeight={600} sx={{ mb: 2 }}>
        {event.title}
      </Typography>

      <Box
        aria-label="Event information"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 1.25,
        }}
      >
        <EventMetaItem icon={<CalendarMonthOutlined fontSize="small" />} label="Date">
          {formatEventDate(event.startDateTime, event.endDateTime)}
        </EventMetaItem>
        <EventMetaItem icon={<AccessTimeOutlined fontSize="small" />} label="Time">
          {formatEventTime(event.startDateTime, event.endDateTime)}
        </EventMetaItem>
        {event.location?.trim() ? (
          <EventMetaItem icon={<LocationOnOutlined fontSize="small" />} label="Location">
            {event.location.trim()}
          </EventMetaItem>
        ) : null}
        {event.guestOfHonour?.trim() ? (
          <EventMetaItem icon={<PersonOutline fontSize="small" />} label="Guest of honour">
            {event.guestOfHonour.trim()}
          </EventMetaItem>
        ) : null}
        {event.sponsors?.trim() ? (
          <EventMetaItem icon={<BusinessOutlined fontSize="small" />} label="Sponsored by">
            {event.sponsors.trim()}
          </EventMetaItem>
        ) : null}
        <EventMetaItem icon={<EventAvailableOutlined fontSize="small" />} label="Booking window">
          {formatBookingWindow(event.bookingStartDateTime, event.bookingEndDateTime)}
        </EventMetaItem>
        <EventMetaItem icon={<GroupOutlined fontSize="small" />} label="Guest bookings" fullWidth>
          {formatEventGuestPolicy(event.maxGuestsWithoutModeratorApproval)}
        </EventMetaItem>
      </Box>
    </Paper>
  );
}
