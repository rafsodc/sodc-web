import { useEffect, useState } from "react";
import { getSectionForUser } from "../../../shared/utils/firebaseFunctions";
import { auth } from "../../../config/firebase";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";

interface UseCanModerateSectionResult {
  /** True once the section access check has resolved (or failed). */
  isResolved: boolean;
  isAdmin: boolean;
  canModerateSection: boolean;
}

/**
 * Whether the current user can administer a section — either as a global admin or as a
 * member of a user group with MODERATOR purpose on that section. Backed by the
 * getSectionForUser callable, which is the only path a non-admin has to a section's
 * purpose links (the underlying GetSectionById query is admin-only — see #328) and
 * computes canModerate server-side against the caller's own group memberships.
 */
export function useCanModerateSection(sectionId: string | undefined): UseCanModerateSectionResult {
  const currentUser = auth.currentUser;
  const isAdmin = useAdminClaim(currentUser);
  const [canModerateSection, setCanModerateSection] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const requestGuard = useLatestRequestGuard();

  useEffect(() => {
    if (!sectionId) {
      setCanModerateSection(false);
      setIsResolved(true);
      return;
    }
    const requestToken = requestGuard.start();
    setIsResolved(false);
    getSectionForUser(sectionId)
      .then((result) => {
        if (!requestGuard.isCurrent(requestToken)) return;
        setCanModerateSection(result.canModerate);
      })
      .catch(() => {
        if (!requestGuard.isCurrent(requestToken)) return;
        setCanModerateSection(false);
      })
      .finally(() => {
        if (!requestGuard.isCurrent(requestToken)) return;
        setIsResolved(true);
      });
    return () => {
      if (requestGuard.isCurrent(requestToken)) requestGuard.invalidate();
    };
  }, [sectionId, requestGuard]);

  return {
    isResolved,
    isAdmin,
    canModerateSection,
  };
}
