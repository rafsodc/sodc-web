import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useGetSectionsForUser, useListSections } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import type { SectionType, SectionUserGroupPurpose } from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import SectionListCard from "./SectionListCard";
import "../../../shared/components/PageContainer.css";
import FailureState from "../../../shared/components/FailureState";
import { reportError, toMemberDataError } from "../../../shared/errors";

interface SectionsListProps {
  onBack: () => void;
  onSelectSection: (sectionId: string) => void;
}

interface Section {
  id: string;
  name: string;
  type: SectionType;
  description?: string | null;
}

const grantsAccess = (purposes?: SectionUserGroupPurpose[] | null): boolean =>
  Boolean(
    purposes?.includes(SectionPurpose.ACCESS) ||
    purposes?.includes(SectionPurpose.MODERATOR)
  );

function SectionsListComponent({ onBack, onSelectSection }: SectionsListProps) {
  const isAdmin = useAdminClaim(auth.currentUser);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use different queries based on admin status
  const {
    data: userSectionsData,
    isLoading: loadingUserSections,
    isError: errorUserSections,
    error: userSectionsError,
    refetch: refetchUserSections,
  } = useGetSectionsForUser(dataConnect);

  const {
    data: allSectionsData,
    isLoading: loadingAllSections,
    isError: errorAllSections,
    error: allSectionsError,
    refetch: refetchAllSections,
  } = useListSections(dataConnect, { enabled: isAdmin });

  // Surface query errors without logging successful query state on every render.
  useEffect(() => {
    if (userSectionsError) {
      reportError("sections.member-list", userSectionsError);
      setErrorMessage("query");
    }
    if (allSectionsError) {
      reportError("sections.admin-list", allSectionsError);
      setErrorMessage("query");
    }
  }, [userSectionsError, allSectionsError]);

  // Extract sections from query results
  const sections = useMemo(() => {
    try {
      if (isAdmin) {
        if (allSectionsData?.sections && Array.isArray(allSectionsData.sections)) {
          return allSectionsData.sections.map((section) => ({
            id: section.id,
            name: section.name,
            type: section.type,
            description: section.description,
          }));
        }
        return [];
      } else {
        if (userSectionsData?.user?.userGroups && Array.isArray(userSectionsData.user.userGroups)) {
          const sectionMap = new Map<string, Section>();
          const addSection = (section: { id: string; name: string; type: SectionType; description?: string | null }) => {
            if (section?.id && !sectionMap.has(section.id)) {
              sectionMap.set(section.id, {
                id: section.id,
                name: section.name || 'Unnamed Section',
                type: section.type,
                description: section.description,
              });
            }
          };
          for (const groupRelation of userSectionsData.user.userGroups) {
            const ug = groupRelation?.userGroup;
            if (ug?.purposeLinks && Array.isArray(ug.purposeLinks)) {
              for (const pl of ug.purposeLinks) {
                if (grantsAccess(pl.purposes) && pl.section) {
                  addSection(pl.section);
                }
              }
            }
          }
          // Include status-inherited groups (membershipStatuses-based) so users can see sections
          const userStatus = userSectionsData.user.membershipStatus;
          if (userStatus && Array.isArray(userSectionsData.allUserGroups)) {
            for (const ug of userSectionsData.allUserGroups) {
              if (!ug?.membershipStatuses?.includes(userStatus)) {
                continue;
              }
              if (ug.purposeLinks && Array.isArray(ug.purposeLinks)) {
                for (const pl of ug.purposeLinks) {
                  if (grantsAccess(pl.purposes) && pl.section) {
                    addSection(pl.section);
                  }
                }
              }
            }
          }
          return Array.from(sectionMap.values());
        }
        return [];
      }
    } catch (error) {
      reportError("sections.list-display", error);
      return [];
    }
  }, [isAdmin, allSectionsData, userSectionsData]);

  // Filter sections by search term
  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) {
      return sections;
    }
    const lowerSearch = searchTerm.toLowerCase();
    return sections.filter(
      (section) =>
        section.name.toLowerCase().includes(lowerSearch) ||
        section.description?.toLowerCase().includes(lowerSearch)
    );
  }, [sections, searchTerm]);

  const loading = isAdmin ? loadingAllSections : loadingUserSections;
  const error = isAdmin ? errorAllSections : errorUserSections;
  const refetch = isAdmin ? refetchAllSections : refetchUserSections;

  const handleRefresh = () => {
    setErrorMessage(null);
    refetch();
  };

  // Early return for loading state
  if (loading) {
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
        <PageHeader title="Sections" onBack={onBack} />
        <Box className="loading-container">
          <CircularProgress aria-label="Loading sections" />
        </Box>
      </Box>
    );
  }

  // Early return for error state
  if (error || errorMessage) {
    const userFacingError = toMemberDataError(
      isAdmin ? allSectionsError : userSectionsError,
      "sections",
    );
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
        <PageHeader title="Sections" onBack={onBack} />
        <Box sx={{ mt: 2 }}>
          <FailureState
            title={userFacingError.title}
            message={userFacingError.message}
            onRetry={userFacingError.retryable ? handleRefresh : undefined}
          />
        </Box>
      </Box>
    );
  }

  // Main render - always return valid JSX
  return (
    <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
      <PageHeader title="Sections" onBack={onBack} />
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        onRefresh={handleRefresh}
        loading={loading}
        label="Search sections"
        placeholder="Search by name or description..."
      />
      {filteredSections.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {searchTerm ? "No sections match your search." : "No sections available."}
        </Alert>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            mt: 2,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          {filteredSections.map((section) => (
            <Box component="li" key={section.id} sx={{ minWidth: 0 }}>
              <SectionListCard section={section} onSelect={onSelectSection} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Wrap in error boundary for safety
export default function SectionsList(props: SectionsListProps) {
  try {
    return <SectionsListComponent {...props} />;
  } catch (error) {
    reportError("sections.list-render", error);
    return (
      <Box className="page-container" sx={{ backgroundColor: "background.default" }}>
        <PageHeader title="Sections" onBack={props.onBack} />
        <Box sx={{ mt: 2 }}>
          <FailureState message="We could not display your sections. Please reload the page." />
        </Box>
      </Box>
    );
  }
}
