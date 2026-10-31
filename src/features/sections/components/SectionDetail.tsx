import { idsEqual } from "../../../shared/utils/uuid";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Alert,
  Button,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import { useGetUserAccessGroups, useGetSectionsForUser } from "../../../shared/query/authoritativeHooks";
import { useQueryClient } from "@tanstack/react-query";
import { dataConnect } from "../../../config/firebase";
import { executeDataConnectMutation } from "../../../shared/query/dataConnectExecution";
import PageHeader from "../../../shared/components/PageHeader";
import AnnouncementOptOutToggle from "./AnnouncementOptOutToggle";
import FailureState from "../../../shared/components/FailureState";
import { reportError } from "../../../shared/errors";
import {
  getMemberGroups,
  canUserSubscribe,
  isUserMember,
  isMembersSection,
  sortMembersBySurname,
} from "../utils/sectionHelpers";
import type { SectionMember } from "../utils/sectionHelpers";
import { auth } from "../../../config/firebase";
import { useNavigate, useLocation } from "react-router-dom";
import { memberEventPath, sectionPath } from "../../../shared/navigation/sectionRoutes";
import {
  getSectionMembersMerged,
  subscribeToUserGroup,
  getSectionForUser,
  getEventForUser,
} from "../../../shared/utils/firebaseFunctions";
import type {
  SectionForUserResponse,
  SectionEventsForUserResponse,
  EventForUserResponse,
} from "../../../shared/utils/firebaseFunctions";
import type { UUIDString } from "@dataconnect/generated";
import { MembershipStatus, SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import { ITEMS_PER_PAGE, ROUTES } from "../../../constants";
import "../../../shared/components/PageContainer.css";
import NavigationBreadcrumbs from "../../../shared/components/NavigationBreadcrumbs";
import { getSectionAdminDestination } from "../utils/sectionDetailAdminNavigation";
import {
  SectionDescriptionHeader,
  SectionEventDetailView,
  SectionEventsListView,
  SectionMembersView,
} from "./SectionDetailViews";
import { invalidateUserSectionAccess } from "../../../shared/query/invalidation";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";
import { loadSectionEventSummaries } from "../../../shared/query/sectionEventSummaries";
import {
  captureSectionEventSummaryRead, getFreshSectionEventSummaries, hasPendingSectionEventSummaries,
  rememberSectionEventSummaries, removeSectionEventSummaries,
} from "../../../shared/query/sectionEventSummaryCache";

interface SectionDetailProps {
  sectionId: string;
  onBack: () => void;
  eventId?: string;
}

type SectionContentScope = Pick<NonNullable<SectionForUserResponse["section"]>, "id" | "type">;

export default function SectionDetail({ sectionId, eventId, onBack }: SectionDetailProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [subscribing, setSubscribing] = useState(false);
  const [subscriptionRefreshFailure, setSubscriptionRefreshFailure] = useState<string | null>(null);
  const [refreshingSubscription, setRefreshingSubscription] = useState(false);
  const subscriptionRequestGuard = useLatestRequestGuard();
  useEffect(() => {
    setSubscribing(false);
    setRefreshingSubscription(false);
    setSubscriptionRefreshFailure(null);
    return () => subscriptionRequestGuard.invalidate();
  }, [sectionId, subscriptionRequestGuard]);
  const [sectionMembers, setSectionMembers] = useState<SectionMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [errorMembers, setErrorMembers] = useState(false);
  const selectedEventId = eventId ?? location.pathname.match(/\/events\/([^/]+)$/)?.[1] ?? null;
  // Keep the last verified descriptor through same-section revalidation. Clearing
  // rendered metadata must not retire a required post-save directory refresh.
  const [contentScope, setContentScope] = useState<SectionContentScope | null>(null);
  const verifiedContentScope = useRef<SectionContentScope | null>(null);
  const currentRoute = useRef({ sectionId, selectedEventId });
  currentRoute.current = { sectionId, selectedEventId };
  const bundledContent = useRef<{
    sectionId: string; eventId: string | null; content: SectionForUserResponse["content"];
    isCurrent: () => boolean;
  } | null>(null);
  const takeBundledContent = useCallback((kind: "MEMBERS" | "EVENTS" | "EVENT") => {
    const bundle = bundledContent.current;
    if (!bundle) return undefined;
    bundledContent.current = null;
    if (!bundle.isCurrent() || !idsEqual(bundle.sectionId, sectionId) || bundle.eventId !== currentRoute.current.selectedEventId || bundle.content?.kind !== kind) return undefined;
    return bundle.content;
  }, [sectionId]);
  const matchingScope = contentScope && idsEqual(contentScope.id, sectionId) ? contentScope : null;
  const needsMembers = matchingScope?.type === "MEMBERS" && !selectedEventId;
  const needsEvents = matchingScope?.type === "EVENTS" && !selectedEventId;
  const needsEventDetail = matchingScope?.type === "EVENTS" && Boolean(selectedEventId);

  const currentUser = auth.currentUser;

  // Get section details (for user group info and subscribability). GetSectionById itself is
  // admin-only in Data Connect (see #328) — this callable checks the caller's actual section
  // access server-side before returning anything.
  const [sectionData, setSectionData] = useState<{ section: SectionForUserResponse["section"] } | undefined>(undefined);
  const [loadingSection, setLoadingSection] = useState(true);
  const [errorSection, setErrorSection] = useState(false);
  const [serverCanModerate, setServerCanModerate] = useState(false);

  // Guards against a superseded call (effect re-run on a sectionId change, a remount, or a
  // manual refetchSection() from a retry/subscribe handler racing an in-flight one) overwriting
  // state with a stale response. Only the most recently started call may still be pending when
  // its own result arrives.
  const sectionRequestGuard = useLatestRequestGuard();
  const refetchSection = useCallback(async () => {
    if (!sectionId) return null;
    const requestToken = sectionRequestGuard.start();
    setLoadingSection(true);
    setSectionData(undefined);
    setServerCanModerate(false);
    setErrorSection(false);
    try {
      const summaryRead = captureSectionEventSummaryRead(queryClient, sectionId);
      const requestedEventId = currentRoute.current.selectedEventId;
      const options = requestedEventId ? { content: "EVENT" as const, eventId: requestedEventId }
        : getFreshSectionEventSummaries(queryClient, sectionId) || hasPendingSectionEventSummaries(queryClient, sectionId)
          ? undefined : { content: "SECTION" as const };
      const result = await getSectionForUser(sectionId, options);
      if (!sectionRequestGuard.isCurrent(requestToken)) return null;
      if (result.section && !idsEqual(result.section.id, sectionId)) {
        throw new Error("Section metadata does not match the requested section");
      }
      const section = result.hasAccess ? result.section : null;
      const scope = section ? { id: section.id, type: section.type } : null;
      // A late page bundle must not bypass the same save/access fence that
      // protects shared summaries. Fall back to a current targeted read.
      bundledContent.current = { sectionId, eventId: requestedEventId, content: section && summaryRead.isCurrent() ? result.content : undefined, isCurrent: summaryRead.isCurrent };
      if (!section) removeSectionEventSummaries(queryClient);
      else if (result.content?.kind === "EVENTS" && result.content.status === "ready") {
        rememberSectionEventSummaries(queryClient, { events: result.content.events }, summaryRead);
      }
      verifiedContentScope.current = scope;
      setContentScope(scope);
      setSectionData({ section });
      setServerCanModerate(Boolean(section && result.canModerate));
      return section;
    } catch (error) {
      if (!sectionRequestGuard.isCurrent(requestToken)) return null;
      reportError("sections.detail", error);
      bundledContent.current = null;
      verifiedContentScope.current = null;
      setContentScope(null);
      setSectionData(undefined);
      setErrorSection(true);
      return null;
    } finally {
      if (sectionRequestGuard.isCurrent(requestToken)) {
        setLoadingSection(false);
      }
    }
  }, [sectionId, sectionRequestGuard, queryClient]);

  useEffect(() => {
    void refetchSection();
    return () => sectionRequestGuard.invalidate();
  }, [refetchSection, sectionRequestGuard]);

  const membersRequestGuard = useLatestRequestGuard();
  // Share the completion outcome between the automatic load and a post-save
  // refresh waiting for it. This holds no roster payload; explicit refreshes
  // always replace it, and leaving the directory clears it.
  const membersRead = useRef<Promise<boolean> | null>(null);
  const fetchMembers = useCallback((force = false): Promise<boolean> => {
    const ownsDirectory = () => idsEqual(currentRoute.current.sectionId, sectionId) &&
      !currentRoute.current.selectedEventId &&
      idsEqual(verifiedContentScope.current?.id, sectionId) &&
      verifiedContentScope.current?.type === "MEMBERS";
    if (!ownsDirectory()) return Promise.resolve(true);
    if (!force && membersRead.current) return membersRead.current;
    const requestToken = membersRequestGuard.start();
    setLoadingMembers(true);
    setErrorMembers(false);
    const pending = Promise.resolve().then(async () => {
      if (!membersRequestGuard.isCurrent(requestToken) || !ownsDirectory()) return false;
      try {
        const bundle = !force ? takeBundledContent("MEMBERS") : undefined;
        if (bundle?.status === "error") throw new Error("The member directory could not be loaded");
        const res = bundle?.kind === "MEMBERS" && bundle.status === "ready" ? bundle : await getSectionMembersMerged(sectionId);
        if (!membersRequestGuard.isCurrent(requestToken) || !ownsDirectory()) return false;
        const members: SectionMember[] = (res.members || []).map((m) => ({
          userId: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          mobileNumber: m.mobileNumber,
          rank: m.rank,
          sharesContactInfo: m.sharesContactInfo,
          membershipStatus: m.membershipStatus as SectionMember["membershipStatus"],
        }));
        setSectionMembers(members);
        return true;
      } catch (err: unknown) {
        if (!membersRequestGuard.isCurrent(requestToken) || !ownsDirectory()) return false;
        reportError("sections.members", err);
        setErrorMembers(true);
        setSectionMembers([]);
        return false;
      } finally {
        if (membersRequestGuard.isCurrent(requestToken) && ownsDirectory()) {
          setLoadingMembers(false);
        }
      }
    });
    membersRead.current = pending;
    return pending;
  }, [sectionId, membersRequestGuard, takeBundledContent]);

  useEffect(() => {
    if (!needsMembers) {
      membersRequestGuard.invalidate();
      membersRead.current = null;
      setSectionMembers([]);
      setErrorMembers(false);
      setLoadingMembers(false);
      return;
    }
    void fetchMembers();
    return () => {
      membersRequestGuard.invalidate();
      membersRead.current = null;
    };
  }, [needsMembers, fetchMembers, membersRequestGuard]);

  useEffect(() => {
    if (!needsMembers) return;
    const refreshDirectory = () => { void fetchMembers(true); };
    window.addEventListener("member-profile-reviewed", refreshDirectory);
    return () => window.removeEventListener("member-profile-reviewed", refreshDirectory);
  }, [needsMembers, fetchMembers]);

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
  const [eventsReadFor, setEventsReadFor] = useState<string | null>(null);
  const eventsRequestMatches = idsEqual(eventsReadFor, sectionId);

  const eventsRequestGuard = useLatestRequestGuard();
  const refetchEvents = useCallback(async (force = false) => {
    const ownsEvents = () => idsEqual(currentRoute.current.sectionId, sectionId) &&
      !currentRoute.current.selectedEventId &&
      idsEqual(verifiedContentScope.current?.id, sectionId) &&
      verifiedContentScope.current?.type === "EVENTS";
    if (!ownsEvents()) return;
    const requestToken = eventsRequestGuard.start();
    setEventsReadFor(sectionId);
    setLoadingEvents(true);
    setErrorEvents(false);
    try {
      const bundle = !force ? takeBundledContent("EVENTS") : undefined;
      if (bundle?.status === "error") throw new Error("The events could not be loaded");
      const result = bundle?.kind === "EVENTS" && bundle.status === "ready" ? bundle : await loadSectionEventSummaries(queryClient, sectionId, { force });
      if (!eventsRequestGuard.isCurrent(requestToken) || !ownsEvents()) return;
      setEventsData({ section: { events: result.events } });
    } catch (error) {
      if (!eventsRequestGuard.isCurrent(requestToken) || !ownsEvents()) return;
      reportError("sections.events", error);
      setEventsData(undefined);
      setErrorEvents(true);
    } finally {
      if (eventsRequestGuard.isCurrent(requestToken) && ownsEvents()) {
        setLoadingEvents(false);
      }
    }
  }, [sectionId, eventsRequestGuard, takeBundledContent, queryClient]);

  useEffect(() => {
    setEventsData(undefined);
    setErrorEvents(false);
    setLoadingEvents(needsEvents);
    if (!needsEvents) setEventsReadFor(null);
    if (needsEvents) void refetchEvents();
    return () => eventsRequestGuard.invalidate();
  }, [needsEvents, refetchEvents, eventsRequestGuard]);

  // Get single event for detail view (only runs when selectedEventId is set). GetEventById is
  // admin-only in Data Connect (see #328); this callable checks access to the event's section.
  const [eventDetailData, setEventDetailData] = useState<{ event: EventForUserResponse["event"] } | undefined>(undefined);
  const [loadingEventDetail, setLoadingEventDetail] = useState(false);
  const [errorEventDetail, setErrorEventDetail] = useState(false);
  const [eventDetailReadFor, setEventDetailReadFor] = useState<{ sectionId: string; eventId: string } | null>(null);
  const eventDetailRequestMatches = idsEqual(eventDetailReadFor?.sectionId, sectionId) &&
    idsEqual(eventDetailReadFor?.eventId, selectedEventId);

  const eventDetailRequestGuard = useLatestRequestGuard();
  const refetchEventDetail = useCallback(async (force = false) => {
    const ownsEvent = () => idsEqual(currentRoute.current.sectionId, sectionId) &&
      idsEqual(currentRoute.current.selectedEventId, selectedEventId) &&
      idsEqual(verifiedContentScope.current?.id, sectionId) &&
      verifiedContentScope.current?.type === "EVENTS";
    if (!selectedEventId || !ownsEvent()) return;
    const requestToken = eventDetailRequestGuard.start();
    setEventDetailReadFor({ sectionId, eventId: selectedEventId });
    setLoadingEventDetail(true);
    setEventDetailData(undefined);
    setErrorEventDetail(false);
    try {
      const bundle = !force ? takeBundledContent("EVENT") : undefined;
      if (bundle?.status === "error") throw new Error("The event could not be loaded");
      const result = bundle?.kind === "EVENT" && bundle.status === "ready" ? bundle : await getEventForUser(selectedEventId);
      if (!eventDetailRequestGuard.isCurrent(requestToken) || !ownsEvent()) return;
      if (result.event && !idsEqual(result.event.section?.id,sectionId)) {
        setEventDetailData(undefined); setErrorEventDetail(true); return;
      }
      setEventDetailData({ event: result.event });
    } catch (error) {
      if (!eventDetailRequestGuard.isCurrent(requestToken) || !ownsEvent()) return;
      reportError("sections.event-detail", error);
      setEventDetailData(undefined);
      setErrorEventDetail(true);
    } finally {
      if (eventDetailRequestGuard.isCurrent(requestToken) && ownsEvent()) {
        setLoadingEventDetail(false);
      }
    }
  }, [selectedEventId, sectionId, eventDetailRequestGuard, takeBundledContent]);

  useEffect(() => {
    setEventDetailData(undefined);
    setErrorEventDetail(false);
    setLoadingEventDetail(needsEventDetail);
    if (!needsEventDetail) setEventDetailReadFor(null);
    if (needsEventDetail) void refetchEventDetail();
    return () => eventDetailRequestGuard.invalidate();
  }, [needsEventDetail, refetchEventDetail, eventDetailRequestGuard]);

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
        if (grantsAccess(pl.purposes) && idsEqual(pl.section?.id,sectionId)) return true;
      }
    }
    for (const ug of userSectionsData.allUserGroups ?? []) {
      if (!ug.membershipStatuses?.includes(userStatus as MembershipStatus)) continue;
      for (const pl of ug.purposeLinks ?? []) {
        if (grantsAccess(pl.purposes) && idsEqual(pl.section?.id,sectionId)) return true;
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

  const canModerateSection = serverCanModerate;

  const allMembers = sectionMembers;
  const refetchMembers = () => fetchMembers(true);

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
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => {
    setPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const refreshSubscriptionViews = async (successMessage: string, requestToken = subscriptionRequestGuard.start()) => {
    if (!subscriptionRequestGuard.isCurrent(requestToken)) return;
    setRefreshingSubscription(true);
    // A pre-write directory request cannot satisfy this refresh. The automatic
    // load and explicit wait below share only a read started after this fence.
    membersRequestGuard.invalidate();
    membersRead.current = null;
    if (verifiedContentScope.current?.type === "MEMBERS") setLoadingMembers(true);
    try {
      const [, sectionLoaded] = await Promise.all([
        invalidateUserSectionAccess(queryClient), refetchSection(),
      ]);
      if (!subscriptionRequestGuard.isCurrent(requestToken)) return;
      if (!sectionLoaded) throw new Error("Subscription view refresh incomplete");
      if (sectionLoaded.type === "MEMBERS" && !currentRoute.current.selectedEventId) {
        const membersLoaded = await fetchMembers();
        if (!subscriptionRequestGuard.isCurrent(requestToken)) return;
        if (!membersLoaded) throw new Error("Subscription view refresh incomplete");
      }
      setSubscriptionRefreshFailure(null);
      setSnackbar({ open: true, message: successMessage, severity: "success" });
    } catch (caught) {
      if (!subscriptionRequestGuard.isCurrent(requestToken)) return;
      reportError("sections.subscription-refresh", caught);
      setSubscriptionRefreshFailure(successMessage);
    } finally {
      if (subscriptionRequestGuard.isCurrent(requestToken)) setRefreshingSubscription(false);
    }
  };
  const subscriptionRefreshNotice = subscriptionRefreshFailure && (
    <Alert severity="warning" action={<Button disabled={refreshingSubscription} onClick={() => void refreshSubscriptionViews(subscriptionRefreshFailure)}>Retry refresh</Button>}>
      Your subscription change was saved, but the latest section data could not be loaded. Retry the refresh; do not repeat the subscription change.
    </Alert>
  );

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

    const requestToken = subscriptionRequestGuard.start();
    setSubscribing(true);
    try {
      await subscribeToUserGroup(subscribableGroup.id);

      if (!subscriptionRequestGuard.isCurrent(requestToken)) {
        await invalidateUserSectionAccess(queryClient);
        return;
      }
      await refreshSubscriptionViews("Successfully subscribed to this section.", requestToken);
    } catch (error) {
      if (!subscriptionRequestGuard.isCurrent(requestToken)) return;
      console.error("Error subscribing:", error);
      setSnackbar({
        open: true,
        message: "Failed to subscribe. Please try again.",
        severity: "error",
      });
    } finally {
      if (subscriptionRequestGuard.isCurrent(requestToken)) setSubscribing(false);
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

    const requestToken = subscriptionRequestGuard.start();
    setSubscribing(true);
    try {
      const { unsubscribeFromUserGroupRef } = await import("@dataconnect/generated");
      await executeDataConnectMutation(unsubscribeFromUserGroupRef(dataConnect, {
        userGroupId: userMemberGroup.id as UUIDString,
      }));

      if (!subscriptionRequestGuard.isCurrent(requestToken)) {
        await invalidateUserSectionAccess(queryClient);
        return;
      }
      await refreshSubscriptionViews("Successfully unsubscribed from this section.", requestToken);
    } catch (error) {
      if (!subscriptionRequestGuard.isCurrent(requestToken)) return;
      console.error("Error unsubscribing:", error);
      setSnackbar({
        open: true,
        message: "Failed to unsubscribe. Please try again.",
        severity: "error",
      });
    } finally {
      if (subscriptionRequestGuard.isCurrent(requestToken)) setSubscribing(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const loadedSection = sectionData?.section;
  const isMembersSectionType = loadedSection ? isMembersSection(loadedSection as any) : false;

  const handleSelectEvent = (eventId: string) => navigate(memberEventPath(sectionId,eventId));
  const handleBackToEvents = useCallback(() => { navigate(sectionPath(sectionId)); }, [navigate,sectionId]);

  const handleHeaderBack = useCallback(() => {
    if (selectedEventId) {
      handleBackToEvents();
      return;
    }
    onBack();
  }, [selectedEventId, handleBackToEvents, onBack]);

  const eventTitle = idsEqual(eventDetailData?.event?.id,selectedEventId) && idsEqual(eventDetailData?.event?.section?.id,sectionId) ? eventDetailData?.event?.title : undefined;
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
            { label: loadedSection.name, to: sectionPath(sectionId) },
            { label: eventTitle ?? "Event" },
          ]}
        />
      );
    }
    return <NavigationBreadcrumbs items={[...items, { label: loadedSection.name }]} />;
  }, [loadedSection, selectedEventId, eventTitle, sectionId]);

  if (loadingSection || loadingUserGroups || (sectionData?.section && !idsEqual(sectionData.section.id,sectionId))) {
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
        <PageHeader title="Section Details" onBack={onBack} />
        <Box className="loading-container">
          <CircularProgress aria-label="Loading section details" />
        </Box>
      </Box>
    );
  }

  if (errorSection || !sectionData?.section) {
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
        <PageHeader title="Section Details" onBack={onBack} />
        <Box sx={{ mt: 2 }}>
          {subscriptionRefreshNotice}
          <FailureState
            title="Section unavailable"
            message="We could not load this section. Please try again."
            onRetry={() => {
              void refetchSection();
            }}
          />
        </Box>
      </Box>
    );
  }

  const section = sectionData.section;
  if (selectedEventId && section.type !== "EVENTS") return <Box className="page-container"><Alert severity="error">Event unavailable in this section.</Alert><Button onClick={handleBackToEvents}>Back to section</Button></Box>;
  const isMembers = isMembersSectionType;
  const hasSubscribableMemberGroup = memberGroups.some((group) => group.subscribable === true);
  const eventRows = eventsData?.section?.events ?? [];
  const sectionAdminAction = {
    visible: Boolean(currentUser && canModerateSection),
    to: getSectionAdminDestination({ ...section, type: section.type ?? undefined }, isMembers, selectedEventId).to,
  };

  return (
    <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
      <PageHeader
        title={pageTitle}
        onBack={handleHeaderBack}
        adminAction={sectionAdminAction}
        breadcrumbs={headerBreadcrumbs}
        extraActions={
          !selectedEventId && currentUser && userHasSectionAccess ? (
            <AnnouncementOptOutToggle sectionId={sectionId} />
          ) : null
        }
      />

      {subscriptionRefreshNotice}
      {!selectedEventId && (
        <SectionDescriptionHeader
          section={section}
          isMembers={isMembers}
          hasCurrentUser={Boolean(currentUser)}
          canSubscribe={canSubscribe}
          userIsMember={userIsMember}
          hasSubscribableMemberGroup={hasSubscribableMemberGroup}
          subscribing={subscribing}
          subscriptionRefreshFailed={Boolean(subscriptionRefreshFailure)}
          onSubscribe={handleSubscribe}
          onUnsubscribe={handleUnsubscribe}
        />
      )}

      {isMembers ? (
        <SectionMembersView
          allMembersCount={allMembers.length}
          filteredMembers={filteredMembers}
          paginatedMembers={paginatedMembers}
          searchTerm={searchTerm}
          page={currentPage}
          totalPages={totalPages}
          loading={needsMembers && (loadingMembers || membersRead.current === null)}
          isError={membersRead.current !== null && errorMembers}
          onSearchTermChange={setSearchTerm}
          onRefresh={() => void refetchMembers()}
          onPageChange={setPage}
        />
      ) : selectedEventId ? (
        <SectionEventDetailView
          key={selectedEventId}
          section={section}
          event={idsEqual(eventDetailData?.event?.id,selectedEventId) && idsEqual(eventDetailData?.event?.section?.id,sectionId) ? eventDetailData?.event ?? null : null}
          loading={needsEventDetail && (!eventDetailRequestMatches || loadingEventDetail)}
          isError={eventDetailRequestMatches && errorEventDetail}
          hasCurrentUser={Boolean(currentUser)}
          onBackToEvents={handleBackToEvents}
          onRetry={() => refetchEventDetail(true)}
          onBookingComplete={() => {
            removeSectionEventSummaries(queryClient);
            void refetchEventDetail(true);
            void queryClient.invalidateQueries({ queryKey: ["eventAttendees", selectedEventId] });
          }}
        />
      ) : (
        <SectionEventsListView
          events={eventRows}
          loading={needsEvents && (!eventsRequestMatches || loadingEvents)}
          isError={eventsRequestMatches && errorEvents}
          onRetry={() => refetchEvents(true)}
          onSelectEvent={handleSelectEvent}
          eventHref={(id) => memberEventPath(sectionId,id)}
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
