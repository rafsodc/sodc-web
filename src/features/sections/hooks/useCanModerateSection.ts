import { useMemo } from "react";
import { useGetSectionById, useGetUserAccessGroups } from "@dataconnect/generated/react";
import { dataConnect } from "../../../config/firebase";
import type { UUIDString } from "@dataconnect/generated";
import { SectionUserGroupPurpose as SectionPurpose } from "@dataconnect/generated";
import { auth } from "../../../config/firebase";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";

interface UseCanModerateSectionResult {
  /** True once section/user-group data has loaded enough to know the answer. */
  isResolved: boolean;
  isAdmin: boolean;
  canModerateSection: boolean;
}

/**
 * Whether the current user can administer a section — either as a global admin or as a
 * member of a user group with MODERATOR purpose on that section. Mirrors the check
 * SectionDetail.tsx uses to show its "Admin" button; kept in one place since this is an
 * authorization decision, not just UI copy.
 */
export function useCanModerateSection(sectionId: string | undefined): UseCanModerateSectionResult {
  const currentUser = auth.currentUser;
  const isAdmin = useAdminClaim(currentUser);

  const { data: sectionData, isLoading: loadingSection } = useGetSectionById(
    dataConnect,
    { id: sectionId as UUIDString },
    { enabled: Boolean(sectionId) }
  );
  const { data: userAccessGroupsData, isLoading: loadingUserGroups } = useGetUserAccessGroups(
    dataConnect,
    {}
  );

  const userUserGroupIds = useMemo(() => {
    if (!userAccessGroupsData?.user?.userGroups) {
      return [];
    }
    return userAccessGroupsData.user.userGroups.map((group) => group.userGroup.id);
  }, [userAccessGroupsData]);

  const canModerateSection = useMemo(() => {
    const purposeLinks = sectionData?.section?.purposeLinks ?? [];
    return purposeLinks.some(
      (link) =>
        (link.purposes?.includes(SectionPurpose.MODERATOR) ?? false) &&
        userUserGroupIds.includes(link.userGroup.id)
    );
  }, [sectionData, userUserGroupIds]);

  return {
    isResolved: !loadingSection && !loadingUserGroups,
    isAdmin,
    canModerateSection,
  };
}
