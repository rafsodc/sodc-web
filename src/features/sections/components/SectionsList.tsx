import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
} from "@mui/material";
import { useGetSectionsForUser, useListSections } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import { colors } from "../../../config/colors";
import PageHeader from "../../../shared/components/PageHeader";
import SearchBar from "../../../shared/components/SearchBar";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { auth } from "../../../config/firebase";
import type { SectionType } from "@dataconnect/generated";
import "../../../shared/components/PageContainer.css";

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
  } = useGetSectionsForUser(dataConnect, {});

  const {
    data: allSectionsData,
    isLoading: loadingAllSections,
    isError: errorAllSections,
    error: allSectionsError,
    refetch: refetchAllSections,
  } = useListSections(dataConnect, {}, { enabled: isAdmin });

  // Log errors and data for debugging
  useEffect(() => {
    console.log('SectionsList Debug:', {
      isAdmin,
      loadingUserSections,
      loadingAllSections,
      errorUserSections,
      errorAllSections,
      userSectionsData,
      allSectionsData,
      userSectionsError,
      allSectionsError,
    });
    
    if (userSectionsError) {
      console.error('GetSectionsForUser error:', userSectionsError);
      setErrorMessage(userSectionsError instanceof Error ? userSectionsError.message : 'Failed to load sections');
    }
    if (allSectionsError) {
      console.error('ListSections error:', allSectionsError);
      setErrorMessage(allSectionsError instanceof Error ? allSectionsError.message : 'Failed to load sections');
    }
  }, [isAdmin, loadingUserSections, loadingAllSections, errorUserSections, errorAllSections, userSectionsData, allSectionsData, userSectionsError, allSectionsError]);

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
        if (userSectionsData?.user?.accessGroups && Array.isArray(userSectionsData.user.accessGroups)) {
          const sectionMap = new Map<string, Section>();
          for (const groupRelation of userSectionsData.user.accessGroups) {
            if (groupRelation?.accessGroup?.sections && Array.isArray(groupRelation.accessGroup.sections)) {
              for (const sectionRelation of groupRelation.accessGroup.sections) {
                if (sectionRelation?.section) {
                  const section = sectionRelation.section;
                  if (section?.id && !sectionMap.has(section.id)) {
                    sectionMap.set(section.id, {
                      id: section.id,
                      name: section.name || 'Unnamed Section',
                      type: section.type,
                      description: section.description,
                    });
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
      console.error('Error extracting sections:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
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
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Sections" onBack={onBack} />
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // Early return for error state
  if (error || errorMessage) {
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Sections" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage || "Failed to load sections. Please try again."}
        </Alert>
        <Button variant="outlined" onClick={handleRefresh} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  // Main render - always return valid JSX
  return (
    <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
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
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSections.map((section) => (
                <TableRow
                  key={section.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => onSelectSection(section.id)}
                >
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {section.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={section.type}
                      size="small"
                      color={section.type === "MEMBERS" ? "primary" : "secondary"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {section.description || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSection(section.id);
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

// Wrap in error boundary for safety
export default function SectionsList(props: SectionsListProps) {
  try {
    return <SectionsListComponent {...props} />;
  } catch (error) {
    console.error('SectionsList render error:', error);
    return (
      <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
        <PageHeader title="Sections" onBack={props.onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          An error occurred while loading sections. Please refresh the page.
        </Alert>
      </Box>
    );
  }
}
