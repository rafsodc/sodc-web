import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from "@mui/material";
import type { SectionType } from "@dataconnect/generated";
import { getSectionTypeLabel } from "../../../shared/utils/sectionTypeLabels";

export interface SectionListCardSection {
  id: string;
  name: string;
  type: SectionType;
  description?: string | null;
}

export interface SectionListCardProps {
  section: SectionListCardSection;
  onSelect: (sectionId: string) => void;
}

export default function SectionListCard({ section, onSelect }: SectionListCardProps) {
  const description = section.description?.trim() || "No description.";

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea
        onClick={() => onSelect(section.id)}
        sx={{ height: "100%", textAlign: "left" }}
      >
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {getSectionTypeLabel(section.type)}
          </Typography>
          <Typography variant="subtitle1" fontWeight={600} component="h2">
            {section.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
