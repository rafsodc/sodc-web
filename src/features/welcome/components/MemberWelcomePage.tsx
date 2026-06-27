import { useMemo } from "react";
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
import { Link as RouterLink } from "react-router-dom";
import type { GetSectionsForUserData } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import { getSectionTypeLabel } from "../../../shared/utils/sectionTypeLabels";
import { formatSectionEventWhen } from "../../../shared/utils/sectionEventDisplay";
import { ROUTES } from "../../../constants";
import { sectionDetailLocationState } from "../../../shared/navigation/sectionNavigationState";
import type { UserData } from "../../../types";
import { extractAccessibleSections } from "../../../shared/navigation/extractAccessibleSections";
import { getMemberDisplayName } from "../../../shared/utils/userDisplayName";
import { useUpcomingEventsForUser } from "../hooks/useUpcomingEventsForUser";

export interface MemberWelcomePageProps {
  userData: UserData | null;
  userEmail?: string | null;
  sectionsData?: GetSectionsForUserData;
}

export default function MemberWelcomePage({
  userData,
  userEmail,
  sectionsData,
}: MemberWelcomePageProps) {
  const displayName = getMemberDisplayName(userData, userEmail);
  const sections = useMemo(() => extractAccessibleSections(sectionsData), [sectionsData]);
  const { events, loading: loadingEvents, isError: errorEvents } = useUpcomingEventsForUser(sections);

  return (
    <Box sx={{ maxWidth: "900px", mx: "auto", px: { xs: 2, sm: 3 }, py: 2 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ color: colors.titlePrimary, fontWeight: 500, mb: 1 }}
      >
        Welcome, {displayName}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Good to see you. Here&apos;s what&apos;s coming up.
      </Typography>

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        Upcoming events
      </Typography>
      {loadingEvents ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : errorEvents ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load upcoming events. Please try again later.
        </Alert>
      ) : events.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Nothing in the diary yet — check back soon or browse your sections below.
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            mb: 4,
            display: "grid",
            gap: 2,
          }}
        >
          {events.map((event) => (
            <Box component="li" key={event.id}>
              <Card variant="outlined">
                <CardActionArea
                  component={RouterLink}
                  to={`/sections/${event.sectionId}`}
                  state={sectionDetailLocationState(ROUTES.HOME)}
                  sx={{ textAlign: "left" }}
                >
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {event.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatSectionEventWhen(event.startDateTime, event.endDateTime)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.sectionName}
                      {event.location ? ` · ${event.location}` : ""}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        Your sections
      </Typography>
      {sections.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sections will appear here once an administrator has set up your membership.
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          {sections.map((section) => (
            <Box component="li" key={section.id}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardActionArea
                  component={RouterLink}
                  to={`/sections/${section.id}`}
                  state={sectionDetailLocationState(ROUTES.HOME)}
                  sx={{ height: "100%", textAlign: "left" }}
                >
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      {getSectionTypeLabel(section.type)}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {section.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {section.description?.trim() || "No description."}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", gap: 2 }}>
        <Button component={RouterLink} to={ROUTES.SECTIONS} variant="outlined">
          Browse all sections
        </Button>
        <Button component={RouterLink} to={ROUTES.MY_PAYMENTS} variant="outlined">
          My payments
        </Button>
      </Box>
    </Box>
  );
}
