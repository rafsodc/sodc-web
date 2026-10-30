import { idsEqual } from "../../../shared/utils/uuid";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getSectionForUser,
  type SectionForUserResponse,
} from "../../../shared/utils/firebaseFunctions";
import { auth } from "../../../config/firebase";
import {
  captureSession,
  isSessionCurrent,
} from "../../../shared/appShell/sessionLifecycle";

/** Metadata and the section-scoped permission come from the same server decision.
 * Never retain an old section's authority while its replacement is loading. */
export function useCanModerateSection(sectionId: string | undefined) {
  const session = captureSession();
  const lifecycle = session.lifecycle;
  const snapshot = useSyncExternalStore(
    lifecycle?.subscribe ?? (() => () => {}),
    lifecycle?.getSnapshot ?? (() => null),
  );
  const owner = `${sectionId ?? ""}:${snapshot?.uid ?? auth.currentUser?.uid ?? ""}:${snapshot?.generation ?? 0}`;
  const [state, setState] = useState<{
    owner: string;
    result?: SectionForUserResponse;
    failed?: boolean;
  }>();
  useEffect(() => {
    let active = true;
    const token = captureSession();
    if (!sectionId) {
      setState({ owner, failed: true });
      return;
    }
    getSectionForUser(sectionId)
      .then((result) => {
        if (active && isSessionCurrent(token))
          setState({
            owner,
            result: idsEqual(result.section?.id, sectionId)
              ? result
              : undefined,
            failed: !!result.section && !idsEqual(result.section.id, sectionId),
          });
      })
      .catch(() => {
        if (active && isSessionCurrent(token))
          setState({ owner, failed: true });
      });
    return () => {
      active = false;
    };
  }, [sectionId, owner]);
  const current =
    state?.owner === owner && isSessionCurrent(session) ? state : undefined;
  return {
    isResolved: !!current,
    canModerateSection:
      !!current?.result?.section &&
      current.result.hasAccess &&
      current.result.canModerate,
    section: current?.result?.section ?? null,
    failed: !!current?.failed,
  };
}
