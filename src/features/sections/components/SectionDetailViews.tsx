import { useId, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { memberEventPath, readMemberEventTab, sectionPath } from "../../../shared/navigation/sectionRoutes";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { ViewList as ViewListIcon, ViewModule as ViewModuleIcon } from "@mui/icons-material";
import { type GetEventByIdData, type GetEventsForSectionData, type GetSectionByIdData } from "@dataconnect/generated";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import SearchBar from "../../../shared/components/SearchBar";
import type { SectionMember } from "../utils/sectionHelpers";
import { partitionSectionEventsByTiming } from "../../../shared/utils/sectionEventDisplay";
import { eventDetailTabLabel, type EventDetailTab } from "../utils/sectionDetailTabs";
import ContactDetailsDialog from "./ContactDetailsDialog";
import EventBookingWizard from "./EventBookingWizard";
import EventDetailHero from "./EventDetailHero";
import EventDetailsContent from "./EventDetailsContent";
import EventAttendees from "./EventAttendees";
import SectionEventCard from "./SectionEventCard";
import SectionMemberCard from "./SectionMemberCard";
import SectionMemberListItem from "./SectionMemberListItem";
import FailureState from "../../../shared/components/FailureState";

type MemberViewMode = "card" | "list";

type SectionDetailSection = NonNullable<GetSectionByIdData["section"]>;
type SectionEventRow = NonNullable<NonNullable<GetEventsForSectionData["section"]>["events"]>[number];
type SectionEventDetail = NonNullable<GetEventByIdData["event"]>;

interface SectionDescriptionHeaderProps {
  section: SectionDetailSection;
  isMembers: boolean;
  hasCurrentUser: boolean;
  canSubscribe: boolean;
  userIsMember: boolean;
  hasSubscribableMemberGroup: boolean;
  subscribing: boolean;
  subscriptionRefreshFailed?: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}

export function SectionDescriptionHeader({
  section,
  isMembers,
  hasCurrentUser,
  canSubscribe,
  userIsMember,
  hasSubscribableMemberGroup,
  subscribing,
  subscriptionRefreshFailed = false,
  onSubscribe,
  onUnsubscribe,
}: SectionDescriptionHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
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
              disabled={subscribing || subscriptionRefreshFailed}
              sx={{ backgroundColor: "secondary.main", color: "secondary.contrastText" }}
            >
              {subscribing ? "Subscribing..." : "Subscribe"}
            </Button>
          )}
          {userIsMember && hasSubscribableMemberGroup && (
            <Button
              variant="outlined"
              color="error"
              onClick={onUnsubscribe}
              disabled={subscribing || subscriptionRefreshFailed}
              sx={{ ml: 2 }}
            >
              {subscribing ? "Unsubscribing..." : "Unsubscribe"}
            </Button>
          )}
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
  isError?: boolean;
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
  isError = false,
  onSearchTermChange,
  onRefresh,
  onPageChange,
}: SectionMembersViewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = filteredMembers.find((member) => member.userId === selectedMemberId && member.sharesContactInfo) ?? null;
  const selectMember = (member: SectionMember) => setSelectedMemberId(member.userId);
  const [viewMode, setViewMode] = useState<MemberViewMode>("card");

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Members ({allMembersCount})
        </Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value: MemberViewMode | null) => value && setViewMode(value)}
          size="small"
          aria-label="Member display style"
        >
          <ToggleButton value="card" aria-label="Card view">
            <ViewModuleIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tap a member to see their contact details. Members who've chosen not to share theirs are marked "Private".
      </Typography>
      <SearchBar
        value={searchTerm}
        onChange={onSearchTermChange}
        onRefresh={onRefresh}
        loading={loading}
        label="Search members"
        placeholder="Search by name or email..."
      />
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress aria-label="Loading members" />
        </Box>
      ) : isError ? (
        <FailureState
          title="Member directory unavailable"
          message="We could not load the member directory. Please try again."
          onRetry={onRefresh}
        />
      ) : filteredMembers.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {searchTerm ? "No members match your search." : "No members in this section."}
        </Alert>
      ) : (
        <>
          <Typography variant="body2" sx={{ mt: 2, mb: 2, color: "text.secondary" }}>
            Showing {paginatedMembers.length} of {filteredMembers.length} {searchTerm ? "filtered " : ""}members
            {totalPages > 1 && ` (page ${page} of ${totalPages})`}
          </Typography>
          {viewMode === "card" ? (
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
                <SectionMemberCard key={member.userId} member={member} onSelect={selectMember} />
              ))}
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Rank</TableCell>
                    <TableCell>Membership</TableCell>
                    <TableCell align="center">Privacy</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedMembers.map((member) => (
                    <SectionMemberListItem key={member.userId} member={member} onSelect={selectMember} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationDisplay page={page} totalPages={totalPages} onChange={onPageChange} />
        </>
      )}
      <ContactDetailsDialog member={selectedMember} onClose={() => setSelectedMemberId(null)} />
    </Box>
  );
}

interface SectionEventsListViewProps {
  events: SectionEventRow[];
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectEvent: (eventId: string) => void;
  eventHref?: (eventId: string) => string;
}

type SectionEventsListMode = "upcoming" | "past";

export function SectionEventsListView({
  events,
  loading,
  isError,
  onRetry,
  onSelectEvent,
  eventHref,
}: SectionEventsListViewProps) {
  const location = useLocation();
  const listMode: SectionEventsListMode = new URLSearchParams(location.search).get("view") === "past" ? "past" : "upcoming";
  const listPath = (mode: SectionEventsListMode) => `${location.pathname}${mode === "past" ? "?view=past" : ""}`;
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
            <Button size="small" component={RouterLink} to={listPath("past")}>
              View past events
            </Button>
          ) : null}
          {listMode === "past" ? (
            <Button size="small" component={RouterLink} to={listPath("upcoming")}>
              Back to upcoming events
            </Button>
          ) : null}
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress aria-label="Loading events" />
        </Box>
      ) : isError ? (
        <FailureState
          title="Events are unavailable"
          message="We could not load the events for this section. Please try again."
          onRetry={onRetry}
        />
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
                href={eventHref?.(event.id)}
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
  onRetry,
  onBookingComplete,
}: SectionEventDetailViewProps) {
  const tabId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = readMemberEventTab(location.search);
  const setActiveTab = (tab: EventDetailTab) => { if (event) navigate(memberEventPath(section.id,event.id,tab)); };
  const [hasExistingBooking, setHasExistingBooking] = useState(false);
  const [bookingVisited, setBookingVisited] = useState(activeTab === "book");
  if (activeTab === "book" && !bookingVisited) setBookingVisited(true);


  return (
    <Box sx={{ mt: 2 }}>
      <Button size="small" component={RouterLink} to={sectionPath(section.id)} sx={{ mb: 2 }}>
        Back to events
      </Button>
      {loading && !event ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress aria-label="Loading event" />
        </Box>
      ) : isError && !event ? (
        <FailureState
          title="Event unavailable"
          message="We could not load this event. Please try again."
          onRetry={onRetry}
        />
      ) : !event ? (
        <Alert severity="info">Event not found.</Alert>
      ) : (
        <>
          {hasCurrentUser ? (
            <Tabs
              aria-label="Event information"
              value={activeTab}
              sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
            >
              {(["about", "book", "attendees"] as const).map((tab) => (
                <Tab component={RouterLink} to={memberEventPath(section.id,event.id,tab)} key={tab} label={eventDetailTabLabel(tab)} value={tab} id={`${tabId}-${tab}-tab`} aria-controls={`${tabId}-${tab}-panel`} />
              ))}
            </Tabs>
          ) : null}

          {activeTab === "about" || !hasCurrentUser ? (
            <Box role={hasCurrentUser ? "tabpanel" : undefined} id={`${tabId}-about-panel`} aria-labelledby={hasCurrentUser ? `${tabId}-about-tab` : undefined}>
              <EventDetailHero event={event} />
              <EventDetailsContent details={event.details} />
              {hasCurrentUser ? (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    component={RouterLink}
                    to={memberEventPath(section.id,event.id,"book")}
                    sx={{ backgroundColor: "secondary.main", color: "secondary.contrastText" }}
                  >
                    {hasExistingBooking ? "View my booking" : "Book this event"}
                  </Button>
                </Box>
              ) : null}
            </Box>
          ) : null}

          {activeTab === "attendees" && hasCurrentUser ? (
            <Box role="tabpanel" id={`${tabId}-attendees-panel`} aria-labelledby={`${tabId}-attendees-tab`}>
              <EventAttendees key={event.id} eventId={event.id} ticketTypes={event.ticketTypes ?? []} />
            </Box>
          ) : null}

          {hasCurrentUser && bookingVisited ? (
            <Box hidden={activeTab !== "book"} role="tabpanel" id={`${tabId}-book-panel`} aria-labelledby={`${tabId}-book-tab`}>
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
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
