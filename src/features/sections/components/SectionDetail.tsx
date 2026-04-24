import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Snackbar,
} from "@mui/material";
import { useGetSectionById, useGetUserAccessGroups, useGetEventsForSection, useGetEventById } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { executeMutation } from "firebase/data-connect";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import {
  getMemberGroups,
  canUserSubscribe,
  isUserMember,
  isMembersSection,
} from "../utils/sectionHelpers";
import EventBookingWizard from "./EventBookingWizard";
import type { SectionMember } from "../utils/sectionHelpers";
import { auth } from "../../../config/firebase";
import { ROUTES } from "../../../constants";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { useNavigate } from "react-router-dom";
import { createTicketCheckoutSession, getSectionMembersMerged } from "../../../shared/utils/firebaseFunctions";
import type { GetSectionByIdData, UUIDString } from "@dataconnect/generated";
import { TicketAudience } from "@dataconnect/generated";
import { ITEMS_PER_PAGE } from "../../../constants";
import "../../../shared/components/PageContainer.css";

interface SectionDetailProps {
  sectionId: string;
  onBack: () => void;
}

export default function SectionDetail({ sectionId, onBack }: SectionDetailProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [subscribing, setSubscribing] = useState(false);
  const [sectionMembers, setSectionMembers] = useState<SectionMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [errorMembers, setErrorMembers] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [startingCheckoutId, setStartingCheckoutId] = useState<string | null>(null);

  const currentUser = auth.currentUser;
  const isAdmin = useAdminClaim(currentUser);

  // Get section details (for user group info and subscribability)
  const {
    data: sectionData,
    isLoading: loadingSection,
    isError: errorSection,
    refetch: refetchSection,
  } = useGetSectionById(dataConnect, { id: sectionId as UUIDString });

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    setErrorMembers(null);
    try {
      const res = await getSectionMembersMerged(sectionId);
      const members: SectionMember[] = (res.members || []).map((m) => ({
        userId: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        membershipStatus: m.membershipStatus as SectionMember["membershipStatus"],
      }));
      setSectionMembers(members);
    } catch (err: unknown) {
      const message = err && typeof (err as { message?: string }).message === "string"
        ? (err as { message: string }).message
        : "Failed to load section members";
      setErrorMembers(message);
      setSectionMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [sectionId]);

  useEffect(() => {
    if (!sectionId) return;
    fetchMembers();
  }, [sectionId, fetchMembers]);

  // Get current user's user groups to check subscription status
  const {
    data: userAccessGroupsData,
    isLoading: loadingUserGroups,
  } = useGetUserAccessGroups(dataConnect, {});

  // Get events for this section (used when section.type === EVENTS)
  const {
    data: eventsData,
    isLoading: loadingEvents,
    isError: errorEvents,
    refetch: refetchEvents,
  } = useGetEventsForSection(dataConnect, { sectionId: sectionId as UUIDString });

  // Get single event for detail view (only runs when selectedEventId is set)
  const {
    data: eventDetailData,
    isLoading: loadingEventDetail,
    isError: errorEventDetail,
    refetch: refetchEventDetail,
  } = useGetEventById(
    dataConnect,
    { id: (selectedEventId ?? "00000000-0000-0000-0000-000000000000") as UUIDString },
    { enabled: !!selectedEventId }
  );

  // Extract user's user group IDs
  const userUserGroupIds = useMemo(() => {
    if (!userAccessGroupsData?.user?.userGroups) {
      return [];
    }
    return userAccessGroupsData.user.userGroups.map((group) => group.userGroup.id);
  }, [userAccessGroupsData]);

  // Section user groups that grant seeing the section (ACCESS or MODERATOR purpose)
  const sectionPurposeLinks = useMemo(() => {
    return sectionData?.section?.purposeLinks ?? [];
  }, [sectionData]);

  // Get member groups for this section
  const memberGroups = useMemo(() => {
    if (!sectionData?.section) {
      return [];
    }
    return getMemberGroups(sectionData.section as any);
  }, [sectionData]);

  // Check if user is a member
  const userIsMember = useMemo(() => {
    return isUserMember(userUserGroupIds, memberGroups);
  }, [userUserGroupIds, memberGroups]);

  // Check if user can subscribe
  const canSubscribe = useMemo(() => {
    if (!sectionData?.section || !currentUser) {
      return false;
    }
    return canUserSubscribe(
      currentUser.uid,
      userUserGroupIds,
      sectionPurposeLinks,
      memberGroups,
      userUserGroupIds.filter((id) => memberGroups.some((g) => g.id === id))
    );
  }, [sectionData, currentUser, userUserGroupIds, sectionPurposeLinks, memberGroups]);

  const canModerateSection = useMemo(() => {
    return sectionPurposeLinks.some(
      (link) => link.purpose === "MODERATOR" && userUserGroupIds.includes(link.userGroup.id)
    );
  }, [sectionPurposeLinks, userUserGroupIds]);

  const allMembers = sectionMembers;
  const refetchMembers = fetchMembers;

  // Filter members by search term
  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) {
      return allMembers;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return allMembers.filter(
      (member) =>
        member.firstName.toLowerCase().includes(lowerSearch) ||
        member.lastName.toLowerCase().includes(lowerSearch) ||
        member.email.toLowerCase().includes(lowerSearch)
    );
  }, [allMembers, searchTerm]);

  // Reset page to 1 when search term changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSubscribe = async () => {
    if (!currentUser || memberGroups.length === 0) {
      return;
    }

    // Find the first subscribable member group
    const subscribableGroup = memberGroups.find((group) => group.subscribable === true);
    if (!subscribableGroup) {
      setSnackbar({
        open: true,
        message: "This section does not allow self-subscription.",
        severity: "error",
      });
      return;
    }

    setSubscribing(true);
    try {
      const { subscribeToUserGroupRef } = await import("@dataconnect/generated");
      await executeMutation(subscribeToUserGroupRef(dataConnect, {
        userGroupId: subscribableGroup.id as UUIDString,
      }));

      setSnackbar({
        open: true,
        message: "Successfully subscribed to this section.",
        severity: "success",
      });
      // Refetch to update UI
      refetchSection();
      refetchMembers();
      // The user's user groups will be refetched automatically by the hook
    } catch (error) {
      console.error("Error subscribing:", error);
      setSnackbar({
        open: true,
        message: "Failed to subscribe. Please try again.",
        severity: "error",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!currentUser || memberGroups.length === 0) {
      return;
    }

    // Find the subscribable member group the user is in
    const userMemberGroup = memberGroups.find(
      (group) => group.subscribable === true && userUserGroupIds.includes(group.id)
    );
    if (!userMemberGroup) {
      return;
    }

    setSubscribing(true);
    try {
      const { unsubscribeFromUserGroupRef } = await import("@dataconnect/generated");
      await executeMutation(unsubscribeFromUserGroupRef(dataConnect, {
        userGroupId: userMemberGroup.id as UUIDString,
      }));

      setSnackbar({
        open: true,
        message: "Successfully unsubscribed from this section.",
        severity: "success",
      });
      // Refetch to update UI
      refetchSection();
      refetchMembers();
    } catch (error) {
      console.error("Error unsubscribing:", error);
      setSnackbar({
        open: true,
        message: "Failed to unsubscribe. Please try again.",
        severity: "error",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleStartCheckout = async (ticketTypeId: string) => {
    setStartingCheckoutId(ticketTypeId);
    try {
      const { url } = await createTicketCheckoutSession({ ticketTypeId, quantity: 1 });
      window.location.assign(url);
    } catch (error: unknown) {
      const message =
        error && typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not start checkout. Please try again.";
      setSnackbar({ open: true, message, severity: "error" });
    } finally {
      setStartingCheckoutId(null);
    }
  };

  if (loadingSection || loadingMembers || loadingUserGroups) {
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Section Details" onBack={onBack} />
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (errorSection || errorMembers || !sectionData?.section) {
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Section Details" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMembers && !errorSection ? errorMembers : "Failed to load section details. Please try again."}
        </Alert>
        <Button
          variant="outlined"
          onClick={() => {
            refetchSection();
            refetchMembers();
          }}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  const section = sectionData.section;
  const isMembers = isMembersSection(section as any);
  const sectionAdminAction = {
    visible: Boolean(currentUser && (isAdmin || canModerateSection)),
    onClick: () => {
      if (isMembers) {
        navigate(ROUTES.MANAGE_SECTIONS, {
          state: { editSectionId: section.id },
        });
        return;
      }

      navigate(ROUTES.MANAGE_SECTIONS, {
        state: {
          managedSection: {
            id: section.id,
            name: section.name,
          },
          eventId: selectedEventId ?? undefined,
        },
      });
    },
  };

  return (
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
      <PageHeader title={section.name} onBack={onBack} adminAction={sectionAdminAction} />
      
      <Box sx={{ mt: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Section Information
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
          <Chip
            label={section.type}
            size="small"
            color={section.type === "MEMBERS" ? "primary" : "secondary"}
          />
          {section.description && (
            <Typography variant="body2" color="text.secondary">
              {section.description}
            </Typography>
          )}
        </Box>
        
        {/* Subscribe/Unsubscribe button */}
        {isMembers && currentUser && (
          <Box sx={{ mt: 2 }}>
            {canSubscribe && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubscribe}
                disabled={subscribing}
                sx={{ backgroundColor: colors.callToAction }}
              >
                {subscribing ? "Subscribing..." : "Subscribe"}
              </Button>
            )}
            {userIsMember && memberGroups.some((g) => g.subscribable === true) && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleUnsubscribe}
                disabled={subscribing}
                sx={{ ml: 2 }}
              >
                {subscribing ? "Unsubscribing..." : "Unsubscribe"}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {isMembers ? (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Members ({allMembers.length})
          </Typography>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onRefresh={() => refetchSection()}
            loading={loadingSection}
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
                          <Chip label={member.membershipStatus} size="small" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <PaginationDisplay
                page={page}
                totalPages={totalPages}
                onChange={(newPage) => setPage(newPage)}
              />
            </>
          )}
        </>
      ) : selectedEventId ? (
        <Box sx={{ mt: 2 }}>
          <Button size="small" onClick={() => setSelectedEventId(null)} sx={{ mb: 2 }}>
            Back to events
          </Button>
          {loadingEventDetail ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress />
            </Box>
          ) : errorEventDetail ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              Failed to load event.{" "}
              <Button size="small" onClick={() => refetchEventDetail()}>
                Retry
              </Button>
            </Alert>
          ) : !eventDetailData?.event ? (
            <Alert severity="info">Event not found.</Alert>
          ) : (
            <>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {eventDetailData.event.title}
              </Typography>
              <Box component="dl" sx={{ "& dd": { m: 0 }, "& dt": { fontWeight: 500, mt: 1 } }}>
                <Typography component="dt" variant="body2">Date / time</Typography>
                <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {new Date(eventDetailData.event.startDateTime).toLocaleString()} –{" "}
                  {new Date(eventDetailData.event.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Typography>
                <Typography component="dt" variant="body2">Location</Typography>
                <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {eventDetailData.event.location || "—"}
                </Typography>
                <Typography component="dt" variant="body2">Guest of honour</Typography>
                <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {eventDetailData.event.guestOfHonour || "—"}
                </Typography>
                <Typography component="dt" variant="body2">Booking window</Typography>
                <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {new Date(eventDetailData.event.bookingStartDateTime).toLocaleString()} –{" "}
                  {new Date(eventDetailData.event.bookingEndDateTime).toLocaleString()}
                </Typography>
                <Typography component="dt" variant="body2">Max guests without moderator approval</Typography>
                <Typography component="dd" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {eventDetailData.event.maxGuestsWithoutModeratorApproval != null
                    ? String(eventDetailData.event.maxGuestsWithoutModeratorApproval)
                    : "—"}
                </Typography>
              </Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Ticket types</Typography>
              {!eventDetailData.event.ticketTypes?.length ? (
                <Typography variant="body2" color="text.secondary">No ticket types.</Typography>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Audience</TableCell>
                        <TableCell>User group</TableCell>
                        <TableCell align="right">Purchase</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {eventDetailData.event.ticketTypes.map((tt) => (
                        <TableRow key={tt.id}>
                          <TableCell>{tt.title}</TableCell>
                          <TableCell>{tt.description ?? "—"}</TableCell>
                          <TableCell>{tt.price}</TableCell>
                          <TableCell>{tt.audience === TicketAudience.GUEST ? "Guest" : "Member"}</TableCell>
                          <TableCell>{tt.userGroup?.name ?? "—"}</TableCell>
                          <TableCell align="right">
                            {currentUser && tt.audience === TicketAudience.MEMBER ? (
                              <Button
                                size="small"
                                variant="contained"
                                disabled={startingCheckoutId === tt.id}
                                onClick={() => void handleStartCheckout(tt.id)}
                                sx={{ backgroundColor: colors.callToAction }}
                              >
                                {startingCheckoutId === tt.id ? "Starting..." : "Pay"}
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {currentUser && (
                <EventBookingWizard
                  section={section as NonNullable<GetSectionByIdData["section"]>}
                  event={eventDetailData.event}
                  onBookingComplete={() => {
                    void refetchEventDetail();
                  }}
                />
              )}
            </>
          )}
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Events
          </Typography>
          {loadingEvents ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress />
            </Box>
          ) : errorEvents ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              Failed to load events.{" "}
              <Button size="small" onClick={() => refetchEvents()}>
                Retry
              </Button>
            </Alert>
          ) : !eventsData?.section?.events?.length ? (
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
                  {eventsData.section.events.map((ev) => (
                    <TableRow
                      key={ev.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => setSelectedEventId(ev.id)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {ev.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(ev.startDateTime).toLocaleString()} –{" "}
                          {new Date(ev.endDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {ev.location || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {ev.guestOfHonour || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Button size="small" onClick={(e) => { e.stopPropagation(); setSelectedEventId(ev.id); }}>
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
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
