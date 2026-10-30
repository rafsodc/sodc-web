import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
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
import { Campaign, Event, Folder } from "@mui/icons-material";
import PageHeader from "../../../shared/components/PageHeader";
import { useCanModerateSection } from "../../sections/hooks/useCanModerateSection";
import {
  eventManagementPath,
  sectionManagementPath,
  sectionPath,
} from "../../../shared/navigation/sectionRoutes";
import SendAnnouncementPage from "./SendAnnouncementPage";
import ManageSectionFiles from "./ManageSectionFiles";
import SectionEventsManager from "./SectionEventsManager";
import "../../../shared/components/PageContainer.css";

function ActionCard({
  icon,
  title,
  description,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea component={RouterLink} to={to} sx={{ height: "100%" }}>
        <CardContent
          sx={{ display: "flex", flexDirection: "column", gap: 1, p: 3 }}
        >
          <Box sx={{ color: "primary.light" }}>{icon}</Box>
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function SectionAdminPage() {
  const { sectionId, "*": path = "" } = useParams<{
    sectionId: string;
    "*": string;
  }>();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { isResolved, canModerateSection, section, failed } =
    useCanModerateSection(sectionId);
  if (!sectionId) return null;
  if (!isResolved)
    return (
      <Box className="page-container">
        <CircularProgress aria-label="Loading section management" />
      </Box>
    );
  if (failed || !section)
    return (
      <Box className="page-container">
        <Alert severity="error">
          Section unavailable. It may have been removed or you may no longer
          have access.
        </Alert>
        <Button component={RouterLink} to="/sections">
          Your sections
        </Button>
      </Box>
    );
  if (!canModerateSection)
    return (
      <Box className="page-container">
        <Alert severity="error">
          Access denied. You must be an admin or a moderator of this section.
        </Alert>
        <Button component={RouterLink} to={sectionPath(sectionId)}>
          Back to section
        </Button>
      </Box>
    );
  const home = sectionManagementPath(sectionId);
  const parts = path.split("/").filter(Boolean);
  const view = parts[0] ?? "";
  const eventId = parts[1];
  if (
    (view === "events" && (parts.length > 2 || section.type !== "EVENTS")) ||
    !["", "files", "announcements", "events"].includes(view) ||
    (view !== "events" && parts.length > 1)
  )
    return (
      <Box className="page-container">
        <Alert severity="warning">
          This section management page does not exist.
        </Alert>
        <Button component={RouterLink} to={home}>
          Section management
        </Button>
      </Box>
    );
  const navigation = (
    <Box
      component="nav"
      aria-label="Section management"
      sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}
    >
      <Button component={RouterLink} to={sectionPath(sectionId)}>
        View section
      </Button>
      <Button component={RouterLink} to={home}>
        Section management
      </Button>
      <Button
        component={RouterLink}
        to={sectionManagementPath(sectionId, "files")}
      >
        Files
      </Button>
      <Button
        component={RouterLink}
        to={sectionManagementPath(sectionId, "announcements")}
      >
        Announcements
      </Button>
      {section.type === "EVENTS" && (
        <Button
          component={RouterLink}
          to={sectionManagementPath(sectionId, "events")}
        >
          Events
        </Button>
      )}
    </Box>
  );
  if (view === "events")
    return (
      <>
        {navigation}
        <SectionEventsManager
          key={`${sectionId}:${eventId ?? "list"}`}
          sectionId={sectionId}
          sectionName={section.name}
          initialEventId={eventId ?? null}
          routeControlled
          onBack={() => navigate(home)}
        />
      </>
    );
  if (view === "files")
    return (
      <>
        {navigation}
        <ManageSectionFiles
          key={sectionId}
          sectionId={sectionId}
          sectionName={section.name}
          onBack={() => navigate(home)}
        />
      </>
    );
  if (view === "announcements")
    return (
      <>
        {navigation}
        <SendAnnouncementPage
          key={sectionId}
          sectionId={sectionId}
          sectionName={section.name}
          onBack={() => navigate(home)}
        />
      </>
    );
  // Older guests links converge on the existing event workspace, with a URL-owned event selection.
  if (new URLSearchParams(search).has("eventId"))
    return (
      <Navigate
        replace
        to={eventManagementPath(
          sectionId,
          new URLSearchParams(search).get("eventId")!,
          "guests",
        )}
      />
    );
  return (
    <Box className="page-container">
      {navigation}
      <PageHeader title={`Administer — ${section.name}`} />
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Choose an action for this section.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" },
        }}
      >
        <ActionCard
          icon={<Folder />}
          title="Manage Files"
          description="Upload, replace, rename, delete, and copy stable member links."
          to={sectionManagementPath(sectionId, "files")}
        />
        <ActionCard
          icon={<Campaign />}
          title="Send Announcement"
          description="Email the eligible members of this section."
          to={sectionManagementPath(sectionId, "announcements")}
        />
        {section.type === "EVENTS" && (
          <ActionCard
            icon={<Event />}
            title="Manage Events"
            description="Events, ticket types, attendees, guests and booking approvals."
            to={sectionManagementPath(sectionId, "events")}
          />
        )}
      </Box>
    </Box>
  );
}
