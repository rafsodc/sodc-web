import React, { useState, useMemo } from "react";
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

export default function SectionsList({ onBack, onSelectSection }: SectionsListProps) {
  const isAdmin = useAdminClaim(auth.currentUser);
  const [searchTerm, setSearchTerm] = useState("");

  // Use different queries based on admin status
  const {
    data: userSectionsData,
    isLoading: loadingUserSections,
    isError: errorUserSections,
    refetch: refetchUserSections,
  } = useGetSectionsForUser(dataConnect, {});

  const {
    data: allSectionsData,
    isLoading: loadingAllSections,
    isError: errorAllSections,
    refetch: refetchAllSections,
  } = useListSections(dataConnect, {}, { enabled: isAdmin });

  // Extract sections from query results
  const sections = useMemo(() => {
    if (isAdmin && allSectionsData?.sections) {
      return allSectionsData.sections.map((section) => ({
        id: section.id,
        name: section.name,
        type: section.type,
        description: section.description,
      }));
    } else if (userSectionsData?.user?.accessGroups) {
      const sectionMap = new Map<string, Section>();
      for (const groupRelation of userSectionsData.user.accessGroups) {
        for (const sectionRelation of groupRelation.accessGroup.sections) {
          const section = sectionRelation.section;
          if (!sectionMap.has(section.id)) {
            sectionMap.set(section.id, {
              id: section.id,
              name: section.name,
              type: section.type,
              description: section.description,
            });
          }
        }
      }
      return Array.from(sectionMap.values());
    }
    return [];
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
    refetch();
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Sections" onBack={onBack} />
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Sections" onBack={onBack} />
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load sections. Please try again.
        </Alert>
        <Button variant="outlined" onClick={handleRefresh} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
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
