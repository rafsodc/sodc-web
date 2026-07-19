import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Alert,
  CircularProgress,
  Button,
  Snackbar,
} from "@mui/material";
import { useGetUserAccessGroups, useGetSectionsForUser } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { executeMutation } from "firebase/data-connect";
import PageHeader from "../../../shared/components/PageHeader";
import {
  getMemberGroups,
  canUserSubscribe,
  isUserMember,
  isMembersSection,
  sortMembersBySurname,
} from "../utils/sectionHelpers";
import type { SectionMember } from "../utils/sectionHelpers";
import { auth } from "../../../config/firebase";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getSectionMembersMerged,
  subscribeToUserGroup,
  getSectionForUser,
  getSectionEventsForUser,
  getEventForUser,
} from "../../../shared/utils/firebaseFunctions";
import type {
  SectionForUserResponse,
  SectionEventsForUserResponse,
  EventForUserResponse,
} from "../../../shared/utils/firebaseFunctions";
import type { SectionUserGroupPurpose, UUIDString } from "@dataconnect/generated";
import { MembershipStatus, SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import { ITEMS_PER_PAGE, ROUTES } from "../../../constants";
import "../../../shared/components/PageContainer.css";
import NavigationBreadcrumbs from "../../../shared/components/NavigationBreadcrumbs";
import type { SectionDetailLocationState } from "../../../shared/navigation/sectionNavigationState";
import { getSectionAdminDestination } from "../utils/sectionDetailAdminNavigation";
import {
  SectionDescriptionHeader,
  SectionEventDetailView,
  SectionEventsListView,
  SectionMembersView,
} from "./SectionDetailViews";

interface SectionDetailProps {
  sectionId: string;
  onBack: () => void;
}

export default function SectionDetail({ sectionId, onBack }: SectionDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as SectionDetailLocationState | null;
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

  const currentUser = auth.currentUser;
  const isAdmin = useAdminClaim(currentUser);

  // Get section details (for user group info and subscribability). GetSectionById itself is
  // admin-only in Data Connect (see #328) — this callable checks the caller's actual section
  // access server-side before returning anything.
  const [sectionData, setSectionData] = useState<{ section: SectionForUserResponse["section"] } | undefined>(undefined);
  const [loadingSection, setLoadingSection] = useState(true);
  const [errorSection, setErrorSection] = useState(false);

  // Guards against a superseded call (effect re-run on a sectionId change, a remount, or a
  // manual refetchSection() from a retry/subscribe handler racing an in-flight one) overwriting
  // state with a stale response. Only the most recently started call may still be pending when
  // its own result arrives.
  const sectionRequestIdRef = useRef(0);
  const refetchSection = useCallback(async () => {
    if (!sectionId) return;
    const requestId = ++sectionRequestIdRef.current;
    setLoadingSection(true);
    setErrorSection(false);
    try {
      const result = await getSectionForUser(sectionId);
      if (sectionRequestIdRef.current !== requestId) return;
      setSectionData({ section: result.section });
    } catch {
      if (sectionRequestIdRef.current !== requestId) return;
      setSectionData(undefined);
      setErrorSection(true);
    } finally {
      if (sectionRequestIdRef.current === requestId) {
        setLoadingSection(false);
      }
    }
  }, [sectionId]);

  useEffect(() => {
    void refetchSection();
  }, [refetchSection]);

  const membersRequestIdRef = useRef(0);
  const fetchMembers = useCallback(async () => {
    const requestId = ++membersRequestIdRef.current;
    setLoadingMembers(true);
    setErrorMembers(null);
    try {
      const res = await getSectionMembersMerged(sectionId);
      if (membersRequestIdRef.current !== requestId) return;
      const members: SectionMember[] = (res.members || []).map((m) => ({
        userId: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        rank: m.rank,
        sharesContactInfo: m.sharesContactInfo,
        membershipStatus: m.membershipStatus as SectionMember["membershipStatus"],
      }));
      setSectionMembers(members);
    } catch (err: unknown) {
      if (membersRequestIdRef.current !== requestId) return;
      const message = err && typeof (err as { message?: string }).message === "string"
        ? (err as { message: string }).message
        : "Failed to load section members";
      setErrorMembers(message);
      setSectionMembers([]);
    } finally {
      if (membersRequestIdRef.current === requestId) {
        setLoadingMembers(false);
      }
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

  // Used to check access including status-based group memberships (result is cached from App.tsx)
  const { data: userSectionsData } = useGetSectionsForUser(dataConnect, {});

  // Get events for this section (used when section.type === EVENTS). GetEventsForSection is
  // admin-only in Data Connect (see #328); this callable is access-checked the same way as
  // getSectionForUser above.
  const [eventsData, setEventsData] = useState<{ section: { events: SectionEventsForUserResponse["events"] } } | undefined>(undefined);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorEvents, setErrorEvents] = useState(false);

  const eventsRequestIdRef = useRef(0);
  const refetchEvents = useCallback(async () => {
    if (!sectionId) return;
    const requestId = ++eventsRequestIdRef.current;
    setLoadingEvents(true);
    setErrorEvents(false);
    try {
      const result = await getSectionEventsForUser(sectionId);
      if (eventsRequestIdRef.current !== requestId) return;
      setEventsData({ section: { events: result.events } });
    } catch {
      if (eventsRequestIdRef.current !== requestId) return;
      setEventsData(undefined);
      setErrorEvents(true);
    } finally {
      if (eventsRequestIdRef.current === requestId) {
        setLoadingEvents(false);
      }
    }
  }, [sectionId]);

  useEffect(() => {
    void refetchEvents();
  }, [refetchEvents]);

  // Get single event for detail view (only runs when selectedEventId is set). GetEventById is
  // admin-only in Data Connect (see #328); this callable checks access to the event's section.
  const [eventDetailData, setEventDetailData] = useState<{ event: EventForUserResponse["event"] } | undefined>(undefined);
  const [loadingEventDetail, setLoadingEventDetail] = useState(false);
  const [errorEventDetail, setErrorEventDetail] = useState(false);

  const refetchEventDetail = useCallback(async () => {
    if (!selectedEventId) return;
    setLoadingEventDetail(true);
    setErrorEventDetail(false);
    try {
      const result = await getEventForUser(selectedEventId);
      setEventDetailData({ event: result.event });
    } catch {
      setEventDetailData(undefined);
      setErrorEventDetail(true);
    } finally {
      setLoadingEventDetail(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) {
      setEventDetailData(undefined);
      return;
    }
    void refetchEventDetail();
  }, [selectedEventId, refetchEventDetail]);

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

  // Check if user has access to this section (explicit or status-based group membership)
  const userHasSectionAccess = useMemo(() => {
    if (!userSectionsData?.user) return false;
    const userStatus = userSectionsData.user.membershipStatus;
    const grantsAccess = (purposes?: string[] | null) =>
      purposes?.includes(SectionPurpose.ACCESS) || purposes?.includes(SectionPurpose.MODERATOR);
    for (const ug of userSectionsData.user.userGroups ?? []) {
      for (const pl of ug.userGroup.purposeLinks ?? []) {
        if (grantsAccess(pl.purposes) && pl.section?.id === sectionId) return true;
      }
    }
    for (const ug of userSectionsData.allUserGroups ?? []) {
      if (!ug.membershipStatuses?.includes(userStatus as MembershipStatus)) continue;
      for (const pl of ug.purposeLinks ?? []) {
        if (grantsAccess(pl.purposes) && pl.section?.id === sectionId) return true;
      }
    }
    return false;
  }, [userSectionsData, sectionId]);

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
      (link) =>
        (link.purposes?.includes(SectionPurpose.MODERATOR as SectionUserGroupPurpose) ?? false) &&
        userUserGroupIds.includes(link.userGroup.id)
    );
  }, [sectionPurposeLinks, userUserGroupIds]);

  const allMembers = sectionMembers;
  const refetchMembers = fetchMembers;

  // Filter members by search term, then sort by surname
  const filteredMembers = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    const matching = lowerSearch
      ? allMembers.filter(
          (member) =>
            member.firstName.toLowerCase().includes(lowerSearch) ||
            member.lastName.toLowerCase().includes(lowerSearch) ||
            (member.email?.toLowerCase().includes(lowerSearch) ?? false)
        )
      : allMembers;
    return sortMembersBySurname(matching);
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
      await subscribeToUserGroup(subscribableGroup.id);

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

  const loadedSection = sectionData?.section;
  const isMembersSectionType = loadedSection ? isMembersSection(loadedSection as any) : false;

  useEffect(() => {
    if (!loadedSection) {
      return;
    }
    const pendingEventId = locationState?.selectedEventId;
    if (pendingEventId) {
      setSelectedEventId(pendingEventId);
      return;
    }
    setSelectedEventId(null);
  }, [sectionId, loadedSection, locationState?.selectedEventId]);

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleBackToEvents = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  const handleHeaderBack = useCallback(() => {
    if (selectedEventId) {
      handleBackToEvents();
      return;
    }
    onBack();
  }, [selectedEventId, handleBackToEvents, onBack]);

  const eventTitle = eventDetailData?.event?.title;
  const pageTitle =
    selectedEventId && eventTitle ? eventTitle : loadedSection?.name ?? "Section Details";
  const headerBreadcrumbs = useMemo(() => {
    if (!loadedSection) {
      return null;
    }
    const items = [{ label: "Home", to: ROUTES.HOME }];
    if (selectedEventId) {
      return (
        <NavigationBreadcrumbs
          items={[
            ...items,
            { label: loadedSection.name, onClick: handleBackToEvents },
            { label: eventTitle ?? "Event" },
          ]}
        />
      );
    }
    return <NavigationBreadcrumbs items={[...items, { label: loadedSection.name }]} />;
  }, [loadedSection, selectedEventId, eventTitle, handleBackToEvents]);

  if (loadingSection || loadingMembers || loadingUserGroups) {
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default", minHeight: "100vh" }}>
        <PageHeader title="Section Details" onBack={onBack} />
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (errorSection || errorMembers || !sectionData?.section) {
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default", minHeight: "100vh" }}>
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
  const isMembers = isMembersSectionType;
  const hasSubscribableMemberGroup = memberGroups.some((group) => group.subscribable === true);
  const eventRows = eventsData?.section?.events ?? [];
  const sectionAdminAction = {
    visible: Boolean(currentUser && (isAdmin || canModerateSection)),
    onClick: () => {
      const destination = getSectionAdminDestination(
        { ...section, type: section.type ?? undefined },
        isMembers,
        selectedEventId
      );
      navigate(destination.to, { state: destination.state });
    },
  };

  return (
    <Box className="page-container" sx={{ backgroundColor: "background.default", minHeight: "100vh" }}>
      <PageHeader
        title={pageTitle}
        onBack={handleHeaderBack}
        adminAction={sectionAdminAction}
        breadcrumbs={headerBreadcrumbs}
      />

      {!selectedEventId && (
        <SectionDescriptionHeader
          section={section}
          isMembers={isMembers}
          hasCurrentUser={Boolean(currentUser)}
          canSubscribe={canSubscribe}
          userIsMember={userIsMember}
          userHasSectionAccess={userHasSectionAccess}
          hasSubscribableMemberGroup={hasSubscribableMemberGroup}
          subscribing={subscribing}
          onSubscribe={handleSubscribe}
          onUnsubscribe={handleUnsubscribe}
          sectionId={sectionId}
        />
      )}

      {isMembers ? (
        <SectionMembersView
          allMembersCount={allMembers.length}
          filteredMembers={filteredMembers}
          paginatedMembers={paginatedMembers}
          searchTerm={searchTerm}
          page={page}
          totalPages={totalPages}
          loading={loadingSection}
          onSearchTermChange={setSearchTerm}
          onRefresh={() => refetchSection()}
          onPageChange={setPage}
        />
      ) : selectedEventId ? (
        <SectionEventDetailView
          section={section}
          event={eventDetailData?.event ?? null}
          loading={loadingEventDetail}
          isError={errorEventDetail}
          hasCurrentUser={Boolean(currentUser)}
          onBackToEvents={handleBackToEvents}
          onRetry={() => refetchEventDetail()}
          onBookingComplete={() => {
            void refetchEventDetail();
          }}
        />
      ) : (
        <SectionEventsListView
          events={eventRows}
          loading={loadingEvents}
          isError={errorEvents}
          onRetry={() => refetchEvents()}
          onSelectEvent={handleSelectEvent}
        />
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
