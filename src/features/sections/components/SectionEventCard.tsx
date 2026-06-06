import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
} from "@mui/material";
import type { SectionEventListItem } from "../../../shared/utils/sectionEventDisplay";
import { formatSectionEventWhen } from "../../../shared/utils/sectionEventDisplay";

export interface SectionEventCardProps {
  event: SectionEventListItem;
  variant?: "upcoming" | "past";
  onSelect: (eventId: string) => void;
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
          <Typography variant="body2" color="text.secondary">
            {formatSectionEventWhen(event.startDateTime, event.endDateTime)}
          </Typography>
          {event.location ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {event.location}
            </Typography>
          ) : null}
          {event.guestOfHonour ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Guest of honour: {event.guestOfHonour}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
