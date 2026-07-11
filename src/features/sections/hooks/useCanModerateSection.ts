import { useEffect, useState } from "react";
import { getSectionForUser } from "../../../shared/utils/firebaseFunctions";
import { auth } from "../../../config/firebase";
import { useAdminClaim } from "../../users/hooks/useAdminClaim";

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

  useEffect(() => {
    if (!sectionId) {
      setCanModerateSection(false);
      setIsResolved(true);
      return;
    }
    let cancelled = false;
    setIsResolved(false);
    getSectionForUser(sectionId)
      .then((result) => {
        if (cancelled) return;
        setCanModerateSection(result.canModerate);
      })
      .catch(() => {
        if (cancelled) return;
        setCanModerateSection(false);
      })
      .finally(() => {
        if (cancelled) return;
        setIsResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  return {
    isResolved,
    isAdmin,
    canModerateSection,
  };
}
