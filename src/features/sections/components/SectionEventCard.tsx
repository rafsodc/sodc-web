import type { ReactNode } from "react";
import {
  AccessTimeOutlined,
  CalendarMonthOutlined,
  LocationOnOutlined,
} from "@mui/icons-material";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
} from "@mui/material";
import type { SectionEventListItem } from "../../../shared/utils/sectionEventDisplay";
import {
  formatSectionEventDate,
  formatSectionEventTime,
} from "../../../shared/utils/sectionEventDisplay";

export interface SectionEventCardProps {
  event: SectionEventListItem;
  variant?: "upcoming" | "past";
  onSelect: (eventId: string) => void;
}

function EventCardMeta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
      <Box sx={{ color: "primary.main", display: "flex", mt: 0.25 }} aria-hidden="true">
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          component="div"
          color="text.secondary"
          fontWeight={700}
          sx={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
        >
          {label}
        </Typography>
        <Typography variant="body2" component="div" sx={{ mt: 0.125 }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

export default function SectionEventCard({
  event,
  variant = "upcoming",
  onSelect,
}: SectionEventCardProps) {
  const isPast = variant === "past";

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        opacity: isPast ? 0.92 : 1,
        bgcolor: isPast ? "action.hover" : "background.paper",
      }}
    >
      <CardActionArea
        onClick={() => onSelect(event.id)}
        sx={{
          height: "100%",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {event.imageUrl ? (
          <CardMedia
            component="img"
            height={140}
            image={event.imageUrl}
            alt=""
            sx={{ objectFit: "cover" }}
          />
        ) : null}
        <CardContent sx={{ flexGrow: 1, width: "100%" }}>
          <Typography variant="subtitle1" component="h3" fontWeight={600} gutterBottom>
            {event.title}
          </Typography>
          <Box aria-label="Event information" sx={{ display: "grid", gap: 1.25, mt: 1.5 }}>
            <EventCardMeta icon={<CalendarMonthOutlined fontSize="small" />} label="Date">
              {formatSectionEventDate(event.startDateTime, event.endDateTime)}
            </EventCardMeta>
            <EventCardMeta icon={<AccessTimeOutlined fontSize="small" />} label="Time">
              {formatSectionEventTime(event.startDateTime, event.endDateTime)}
            </EventCardMeta>
            {event.location?.trim() ? (
              <EventCardMeta icon={<LocationOnOutlined fontSize="small" />} label="Location">
                {event.location.trim()}
              </EventCardMeta>
            ) : null}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
