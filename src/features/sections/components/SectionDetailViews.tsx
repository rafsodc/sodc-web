import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { TicketAudience, type GetEventByIdData, type GetEventsForSectionData, type GetSectionByIdData } from "@dataconnect/generated";
import { colors } from "../../../config/colors";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import SearchBar from "../../../shared/components/SearchBar";
import { getMembershipStatusLabel } from "../../../shared/utils/membershipStatusLabels";
import {
  ACCESS_GROUP_COLUMN_LABEL,
  GUEST_LIMIT_BEFORE_REVIEW_LABEL,
} from "../../../shared/utils/sectionDisplayLabels";
import { getSectionTypeLabel, isMembersSectionType } from "../../../shared/utils/sectionTypeLabels";
import { getTicketCategoryLabel, TICKET_CATEGORY_LABEL } from "../../../shared/utils/ticketAudienceLabels";
import type { SectionMember } from "../utils/sectionHelpers";
import EventBookingWizard from "./EventBookingWizard";

type SectionDetailSection = NonNullable<GetSectionByIdData["section"]>;
type SectionEventRow = NonNullable<NonNullable<GetEventsForSectionData["section"]>["events"]>[number];
type SectionEventDetail = NonNullable<GetEventByIdData["event"]>;

interface SectionInformationViewProps {
  section: SectionDetailSection;
  isMembers: boolean;
  hasCurrentUser: boolean;
  canSubscribe: boolean;
  userIsMember: boolean;
  hasSubscribableMemberGroup: boolean;
  subscribing: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}

export function SectionInformationView({
  section,
  isMembers,
  hasCurrentUser,
  canSubscribe,
  userIsMember,
  hasSubscribableMemberGroup,
  subscribing,
  onSubscribe,
  onUnsubscribe,
}: SectionInformationViewProps) {
  return (
    <Box sx={{ mt: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Section Information
      </Typography>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <Chip
          label={getSectionTypeLabel(section.type)}
          size="small"
          color={isMembersSectionType(section.type) ? "primary" : "secondary"}
        />
        {section.description && (
          <Typography variant="body2" color="text.secondary">
            {section.description}
          </Typography>
        )}
      </Box>

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
    </Box>
  );
}

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
    <>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Members ({allMembersCount})
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
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Membership Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedMembers.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <Typography variant="body1">
                        {member.firstName} {member.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {member.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={getMembershipStatusLabel(member.membershipStatus)} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationDisplay page={page} totalPages={totalPages} onChange={onPageChange} />
        </>
      )}
    </>
  );
}

interface SectionEventsListViewProps {
  events: SectionEventRow[];
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectEvent: (eventId: string) => void;
}

export function SectionEventsListView({
  events,
  loading,
  isError,
  onRetry,
  onSelectEvent,
}: SectionEventsListViewProps) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Events
      </Typography>
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
      ) : !events.length ? (
        <Alert severity="info">No events yet.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Date / time</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Guest of honour</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow
                  key={event.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => onSelectEvent(event.id)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {event.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(event.startDateTime).toLocaleString()} -{" "}
                      {new Date(event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {event.location || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {event.guestOfHonour || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectEvent(event.id);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
  startingCheckoutId: string | null;
  onBackToEvents: () => void;
  onRetry: () => void;
  onStartCheckout: (ticketTypeId: string) => void;
  onBookingComplete: () => void;
}

export function SectionEventDetailView({
  section,
  event,
  loading,
  isError,
  hasCurrentUser,
  startingCheckoutId,
  onBackToEvents,
  onRetry,
  onStartCheckout,
  onBookingComplete,
}: SectionEventDetailViewProps) {
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
          <Typography variant="h6" sx={{ mb: 2 }}>
            {event.title}
          </Typography>
          <Box component="dl" sx={{ "& dd": { m: 0 }, "& dt": { fontWeight: 500, mt: 1 } }}>
            <Typography component="dt" variant="body2">
              Date / time
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {new Date(event.startDateTime).toLocaleString()} -{" "}
              {new Date(event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Typography>
            <Typography component="dt" variant="body2">
              Location
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {event.location || "-"}
            </Typography>
            <Typography component="dt" variant="body2">
              Guest of honour
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {event.guestOfHonour || "-"}
            </Typography>
            <Typography component="dt" variant="body2">
              Booking window
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {new Date(event.bookingStartDateTime).toLocaleString()} -{" "}
              {new Date(event.bookingEndDateTime).toLocaleString()}
            </Typography>
            <Typography component="dt" variant="body2">
              {GUEST_LIMIT_BEFORE_REVIEW_LABEL}
            </Typography>
            <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {event.maxGuestsWithoutModeratorApproval != null
                ? String(event.maxGuestsWithoutModeratorApproval)
                : "-"}
            </Typography>
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Ticket types
          </Typography>
          {!event.ticketTypes?.length ? (
            <Typography variant="body2" color="text.secondary">
              No ticket types.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>{TICKET_CATEGORY_LABEL}</TableCell>
                    <TableCell>{ACCESS_GROUP_COLUMN_LABEL}</TableCell>
                    <TableCell align="right">Purchase</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {event.ticketTypes.map((ticketType) => (
                    <TableRow key={ticketType.id}>
                      <TableCell>{ticketType.title}</TableCell>
                      <TableCell>{ticketType.description ?? "-"}</TableCell>
                      <TableCell>{ticketType.price}</TableCell>
                      <TableCell>{getTicketCategoryLabel(ticketType.audience)}</TableCell>
                      <TableCell>{ticketType.userGroup?.name ?? "-"}</TableCell>
                      <TableCell align="right">
                        {hasCurrentUser && ticketType.audience === TicketAudience.MEMBER ? (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={startingCheckoutId === ticketType.id}
                            onClick={() => onStartCheckout(ticketType.id)}
                            sx={{ backgroundColor: colors.callToAction }}
                          >
                            {startingCheckoutId === ticketType.id ? "Starting..." : "Pay"}
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {hasCurrentUser && (
            <EventBookingWizard
              section={section}
              event={event}
              onBookingComplete={onBookingComplete}
            />
          )}
        </>
      )}
    </Box>
  );
}

