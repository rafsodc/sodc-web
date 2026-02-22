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
import { useGetSectionById, useGetUserAccessGroups } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { executeMutation } from "firebase/data-connect";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import PaginationDisplay from "../../../shared/components/PaginationDisplay";
import {
  getMemberAccessGroups,
  canUserSubscribe,
  isUserMember,
  isMembersSection,
} from "../utils/sectionHelpers";
import type { SectionMember } from "../utils/sectionHelpers";
import { auth } from "../../../config/firebase";
import { getSectionMembersMerged } from "../../../shared/utils/firebaseFunctions";
import type { UUIDString } from "@dataconnect/generated";
import { ITEMS_PER_PAGE } from "../../../constants";
import "../../../shared/components/PageContainer.css";

interface SectionDetailProps {
  sectionId: string;
  onBack: () => void;
}

export default function SectionDetail({ sectionId, onBack }: SectionDetailProps) {
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

  const currentUser = auth.currentUser;

  // Get section details (for access group info and subscribability)
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

  // Get current user's access groups to check subscription status
  const {
    data: userAccessGroupsData,
    isLoading: loadingUserGroups,
  } = useGetUserAccessGroups(dataConnect, {});

  // Extract user's access group IDs
  const userAccessGroupIds = useMemo(() => {
    if (!userAccessGroupsData?.user?.accessGroups) {
      return [];
    }
    return userAccessGroupsData.user.accessGroups.map((group) => group.accessGroup.id);
  }, [userAccessGroupsData]);

  // Extract viewing access group IDs
  const viewingAccessGroupIds = useMemo(() => {
    if (!sectionData?.section?.viewingAccessGroups) {
      return [];
    }
    return sectionData.section.viewingAccessGroups.map((group) => group.accessGroup.id);
  }, [sectionData]);

  // Get member access groups
  const memberAccessGroups = useMemo(() => {
    if (!sectionData?.section) {
      return [];
    }
    return getMemberAccessGroups(
      sectionData.section as any,
      sectionData.section.viewingAccessGroups as any
    );
  }, [sectionData]);

  // Check if user is a member
  const userIsMember = useMemo(() => {
    return isUserMember(userAccessGroupIds, memberAccessGroups);
  }, [userAccessGroupIds, memberAccessGroups]);

  // Check if user can subscribe
  const canSubscribe = useMemo(() => {
    if (!sectionData?.section || !currentUser) {
      return false;
    }
    return canUserSubscribe(
      currentUser.uid,
      userAccessGroupIds,
      viewingAccessGroupIds,
      memberAccessGroups,
      userAccessGroupIds.filter((id) => memberAccessGroups.some((g) => g.id === id))
    );
  }, [sectionData, currentUser, userAccessGroupIds, viewingAccessGroupIds, memberAccessGroups]);

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
    if (!currentUser || memberAccessGroups.length === 0) {
      return;
    }

    // Find the first subscribable member access group
    const subscribableGroup = memberAccessGroups.find((group) => group.subscribable === true);
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
      const { subscribeToAccessGroupRef } = await import("@dataconnect/generated");
      await executeMutation(subscribeToAccessGroupRef(dataConnect, {
        accessGroupId: subscribableGroup.id as UUIDString,
      }));

      setSnackbar({
        open: true,
        message: "Successfully subscribed to this section.",
        severity: "success",
      });
      // Refetch to update UI
      refetchSection();
      refetchMembers();
      // The user access groups will be refetched automatically by the hook
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
    if (!currentUser || memberAccessGroups.length === 0) {
      return;
    }

    // Find the subscribable member access group the user is in
    const userMemberGroup = memberAccessGroups.find(
      (group) => group.subscribable === true && userAccessGroupIds.includes(group.id)
    );
    if (!userMemberGroup) {
      return;
    }

    setSubscribing(true);
    try {
      const { unsubscribeFromAccessGroupRef } = await import("@dataconnect/generated");
      await executeMutation(unsubscribeFromAccessGroupRef(dataConnect, {
        accessGroupId: userMemberGroup.id as UUIDString,
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

  return (
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
      <PageHeader title={section.name} onBack={onBack} />
      
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
            {userIsMember && memberAccessGroups.some((g) => g.subscribable === true) && (
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
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          Events list coming soon.
        </Alert>
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
