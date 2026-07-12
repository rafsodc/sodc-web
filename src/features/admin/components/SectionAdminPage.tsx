import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Typography,
} from "@mui/material";
import { Campaign, Event, Settings } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import { ROUTES } from "../../../constants";
import { useCanModerateSection } from "../../sections/hooks/useCanModerateSection";
import SendAnnouncementPage from "./SendAnnouncementPage";
import "../../../shared/components/PageContainer.css";

interface SectionAdminLocationState {
  sectionName?: string;
  sectionType?: string;
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function ActionCard({ icon, title, description, onClick }: ActionCardProps) {
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 3 }}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function SectionAdminPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isResolved, isAdmin, canModerateSection } = useCanModerateSection(sectionId);
  const state = location.state as SectionAdminLocationState | null;
  const sectionName = state?.sectionName ?? "Section";
  const sectionType = state?.sectionType ?? "MEMBERS";
  const isEvents = sectionType === "EVENTS";

  const [view, setView] = useState<"hub" | "announcement">("hub");

  const handleBack = () => {
    if (view !== "hub") {
      setView("hub");
      return;
    }
    navigate(-1);
  };

  if (!sectionId) return null;

  if (!isResolved) {
    return (
      <Box className="page-container" sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin && !canModerateSection) {
    return (
      <Box className="page-container">
        <PageHeader title={`Administer — ${sectionName}`} onBack={() => navigate(-1)} />
        <Alert severity="error" sx={{ mb: 2 }}>
          Access denied. You must be an admin or a moderator of this section.
        </Alert>
        <Button variant="outlined" onClick={() => navigate(ROUTES.HOME)}>
          Back to Home
        </Button>
      </Box>
    );
  }

  if (view === "announcement") {
    return (
      <SendAnnouncementPage
        sectionId={sectionId}
        sectionName={sectionName}
        onBack={() => setView("hub")}
      />
    );
  }

  return (
    <Box className="page-container">
      <PageHeader title={`Administer — ${sectionName}`} onBack={handleBack} />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose an action to perform for this section.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ flex: "1 1 280px" }}>
          <ActionCard
            icon={<Campaign fontSize="large" />}
            title="Send Announcement"
            description="Email all active members of this section using a GOV Notify template."
            onClick={() => setView("announcement")}
          />
        </Box>

        {isEvents && (
          <Box sx={{ flex: "1 1 280px" }}>
            <ActionCard
              icon={<Event fontSize="large" />}
              title="Manage Events"
              description="Create, edit, and manage events and ticket types for this section."
              onClick={() =>
                navigate(ROUTES.MANAGE_SECTIONS, {
                  state: { managedSection: { id: sectionId, name: sectionName } },
                })
              }
            />
          </Box>
        )}

        {isAdmin && (
          <Box sx={{ flex: "1 1 280px" }}>
            <ActionCard
              icon={<Settings fontSize="large" />}
              title="Edit Section"
              description="Change the section name, description, and user group assignments."
              onClick={() =>
                navigate(ROUTES.MANAGE_SECTIONS, {
                  state: { editSectionId: sectionId },
                })
              }
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
