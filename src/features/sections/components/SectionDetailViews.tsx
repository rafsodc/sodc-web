import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { type GetEventByIdData, type GetEventsForSectionData, type GetSectionByIdData } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import SearchBar from "../../../shared/components/SearchBar";
import { getSectionTypeLabel, isMembersSectionType } from "../../../shared/utils/sectionTypeLabels";
import type { SectionMember } from "../utils/sectionHelpers";
import { partitionSectionEventsByTiming } from "../../../shared/utils/sectionEventDisplay";
import { eventDetailTabLabel, type EventDetailTab } from "../utils/sectionDetailTabs";
import AnnouncementOptOutToggle from "./AnnouncementOptOutToggle";
import EventBookingWizard from "./EventBookingWizard";
import EventDetailHero from "./EventDetailHero";
import SectionEventCard from "./SectionEventCard";
import SectionMemberCard from "./SectionMemberCard";

type SectionDetailSection = NonNullable<GetSectionByIdData["section"]>;
type SectionEventRow = NonNullable<NonNullable<GetEventsForSectionData["section"]>["events"]>[number];
type SectionEventDetail = NonNullable<GetEventByIdData["event"]>;

interface SectionDescriptionHeaderProps {
  section: SectionDetailSection;
  isMembers: boolean;
  hasCurrentUser: boolean;
  canSubscribe: boolean;
  userIsMember: boolean;
  userHasSectionAccess: boolean;
  hasSubscribableMemberGroup: boolean;
  subscribing: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  sectionId: string;
}

export function SectionDescriptionHeader({
  section,
  isMembers,
  hasCurrentUser,
  canSubscribe,
  userIsMember,
  userHasSectionAccess,
  hasSubscribableMemberGroup,
  subscribing,
  onSubscribe,
  onUnsubscribe,
  sectionId,
}: SectionDescriptionHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1 }}>
        <Chip
          label={getSectionTypeLabel(section.type)}
          size="small"
          color={isMembersSectionType(section.type) ? "primary" : "secondary"}
        />
      </Box>
      <Typography variant="body1" color="text.secondary">
        {section.description?.trim() || "No description provided for this section."}
      </Typography>

      {isMembers && hasCurrentUser && (
        <Box sx={{ mt: 2 }}>
          {canSubscribe && (
            <Button
              variant="contained"
              color="primary"
              onClick={onSubscribe}
              disabled={subscribing}
              sx={{ backgroundColor: colors.callToAction }}
            >
              {subscribing ? "Subscribing..." : "Subscribe"}
            </Button>
          )}
          {userIsMember && hasSubscribableMemberGroup && (
            <Button
              variant="outlined"
              color="error"
              onClick={onUnsubscribe}
              disabled={subscribing}
              sx={{ ml: 2 }}
            >
              {subscribing ? "Unsubscribing..." : "Unsubscribe"}
            </Button>
          )}
        </Box>
      )}
      {hasCurrentUser && userHasSectionAccess && (
        <Box sx={{ mt: 2 }}>
          <AnnouncementOptOutToggle sectionId={sectionId} />
        </Box>
      )}
    </Box>
  );
}

// Keep old export name for backward-compat with existing tests/imports
export const SectionInformationView = SectionDescriptionHeader;

interface SectionMembersViewProps {
  allMembersCount: number;
  filteredMembers: SectionMember[];
  paginatedMembers: SectionMember[];
  searchTerm: string;
  page: number;
  totalPages: number;
  loading: boolean;
  onSearchTermChange: (value: string) => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}

export function SectionMembersView({
  allMembersCount,
  filteredMembers,
  paginatedMembers,
  searchTerm,
  page,
  totalPages,
  loading,
  onSearchTermChange,
  onRefresh,
  onPageChange,
}: SectionMembersViewProps) {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Members ({allMembersCount})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Names and membership type are shown by default. Email addresses stay hidden until you choose to show them for a member.
      </Typography>
      <SearchBar
        value={searchTerm}
        onChange={onSearchTermChange}
        onRefresh={onRefresh}
        loading={loading}
        label="Search members"
        placeholder="Search by name or email..."
      />
      {filteredMembers.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {searchTerm ? "No members match your search." : "No members in this section."}
        </Alert>
      ) : (
        <>
          <Typography variant="body2" sx={{ mt: 2, mb: 2, color: colors.titleSecondary }}>
            Showing {paginatedMembers.length} of {filteredMembers.length} {searchTerm ? "filtered " : ""}members
            {totalPages > 1 && ` (page ${page} of ${totalPages})`}
          </Typography>
          <Box
            component="ul"
            sx={{
              listStyle: "none",
              m: 0,
              p: 0,
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
            }}
          >
            {paginatedMembers.map((member) => (
              <SectionMemberCard key={member.userId} member={member} />
            ))}
          </Box>
          <PaginationDisplay page={page} totalPages={totalPages} onChange={onPageChange} />
        </>
      )}
    </Box>
  );
}

interface SectionEventsListViewProps {
  events: SectionEventRow[];
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectEvent: (eventId: string) => void;
}

type SectionEventsListMode = "upcoming" | "past";

export function SectionEventsListView({
  events,
  loading,
  isError,
  onRetry,
  onSelectEvent,
}: SectionEventsListViewProps) {
  const [listMode, setListMode] = useState<SectionEventsListMode>("upcoming");
  const { upcoming, past } = useMemo(() => partitionSectionEventsByTiming(events), [events]);
  const visibleEvents = listMode === "upcoming" ? upcoming : past;

  return (
    <Box sx={{ mt: 1 }}>
      {!loading && !isError && (upcoming.length > 0 || past.length > 0) ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            mb: 2,
          }}
        >
          <Typography variant="subtitle1" component="h2" fontWeight={600}>
            {listMode === "upcoming" ? "Upcoming events" : "Past events"}
          </Typography>
          {listMode === "upcoming" && past.length > 0 ? (
            <Button size="small" onClick={() => setListMode("past")}>
              View past events
            </Button>
          ) : null}
          {listMode === "past" ? (
            <Button size="small" onClick={() => setListMode("upcoming")}>
              Back to upcoming events
            </Button>
          ) : null}
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load events.{" "}
          <Button size="small" onClick={onRetry}>
            Retry
          </Button>
        </Alert>
      ) : listMode === "upcoming" && upcoming.length === 0 ? (
        <Alert severity="info">
          {past.length > 0
            ? "No upcoming events right now. View past events to see what has already happened."
            : "No upcoming events yet. Check back when new events are published."}
        </Alert>
      ) : listMode === "past" && past.length === 0 ? (
        <Alert severity="info">No past events yet.</Alert>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          {visibleEvents.map((event) => (
            <Box component="li" key={event.id} sx={{ minWidth: 0 }}>
              <SectionEventCard
                event={event}
                variant={listMode}
                onSelect={onSelectEvent}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

interface SectionEventDetailViewProps {
  section: SectionDetailSection;
  event: SectionEventDetail | null;
  loading: boolean;
  isError: boolean;
  hasCurrentUser: boolean;
  onBackToEvents: () => void;
  onRetry: () => void;
  onBookingComplete: () => void;
}

export function SectionEventDetailView({
  section,
  event,
  loading,
  isError,
  hasCurrentUser,
  onBackToEvents,
  onRetry,
  onBookingComplete,
}: SectionEventDetailViewProps) {
  const [activeTab, setActiveTab] = useState<EventDetailTab>("about");
  const [hasExistingBooking, setHasExistingBooking] = useState(false);

  const handleGoToBook = () => setActiveTab("book");

  return (
    <Box sx={{ mt: 2 }}>
      <Button size="small" onClick={onBackToEvents} sx={{ mb: 2 }}>
        Back to events
      </Button>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load event.{" "}
          <Button size="small" onClick={onRetry}>
            Retry
          </Button>
        </Alert>
      ) : !event ? (
        <Alert severity="info">Event not found.</Alert>
      ) : (
        <>
          {hasCurrentUser ? (
            <Tabs
              value={activeTab}
              onChange={(_, v: EventDetailTab) => setActiveTab(v)}
              sx={{
                mb: 2,
                borderBottom: 1,
                borderColor: "divider",
                "& .MuiTab-root": {
                  "&:focus": { outline: "none" },
                  "&:focus-visible": { outline: "none" },
                },
              }}
            >
              <Tab label={eventDetailTabLabel("about")} value="about" />
              <Tab label={eventDetailTabLabel("book")} value="book" />
            </Tabs>
          ) : null}

          {activeTab === "about" || !hasCurrentUser ? (
            <>
              <EventDetailHero event={event} />
              {hasCurrentUser ? (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleGoToBook}
                    sx={{ backgroundColor: colors.callToAction }}
                  >
                    {hasExistingBooking ? "View my booking" : "Book this event"}
                  </Button>
                </Box>
              ) : null}
            </>
          ) : null}

          {activeTab === "book" && hasCurrentUser ? (
            <EventBookingWizard
              section={section}
              event={event}
              wizardOpen={!hasExistingBooking}
              onWizardOpenChange={(open) => {
                if (!open) setActiveTab("about");
              }}
              onHasExistingBookingChange={setHasExistingBooking}
              onBookingComplete={onBookingComplete}
            />
          ) : null}
        </>
      )}
    </Box>
  );
}
