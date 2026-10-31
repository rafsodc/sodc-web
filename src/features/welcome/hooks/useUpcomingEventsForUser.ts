import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SectionType } from "@dataconnect/generated";
import type { AccessibleSection } from "../../../shared/navigation/extractAccessibleSections";
import { reportError } from "../../../shared/errors";
import { useQueryClient } from "@tanstack/react-query";
import { loadSectionEventSummaries } from "../../../shared/query/sectionEventSummaries";
import { removeSectionEventSummaries } from "../../../shared/query/sectionEventSummaryCache";
import { authorizationReadEpoch, subscribeAuthorizationUpdates } from "../../../shared/auth/authorizationUpdate";
import { isAuthenticationFailure } from "../../../shared/auth/isAuthenticationFailure";
import { classifyAuthorizationFailure } from "../../../shared/auth/authorizationFailure";
import { SessionChangedError } from "../../../shared/appShell/sessionLifecycle";
import {
  isUpcomingSectionEvent,
  sortUpcomingSectionEvents,
} from "../../../shared/utils/sectionEventDisplay";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";

export interface UpcomingEventRow {
  id: string;
  title: string;
  location?: string | null;
  guestOfHonour?: string | null;
  startDateTime: string;
  endDateTime: string;
  sectionId: string;
  sectionName: string;
}

/** Stable key so effect does not re-run when parent passes a new array reference with the same sections. */
export function sectionsFingerprint(sections: AccessibleSection[]): string {
  return sections
    .map((s) => `${s.id}:${s.type}:${s.name}`)
    .sort()
    .join("|");
}

export function useUpcomingEventsForUser(sections: AccessibleSection[]) {
  const queryClient = useQueryClient();
  const authorityEpoch = useSyncExternalStore(subscribeAuthorizationUpdates, authorizationReadEpoch);
  const fingerprint = sectionsFingerprint(sections);

  const { eventSectionIds, sectionNameById } = useMemo(() => {
    const eventSections = sections.filter((s) => s.type === SectionType.EVENTS);
    const names: Record<string, string> = {};
    for (const section of eventSections) {
      names[section.id] = section.name;
    }
    return {
      eventSectionIds: eventSections.map((s) => s.id).sort(),
      sectionNameById: names,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint encodes sections content without unstable array refs
  }, [fingerprint]);

  const eventSectionIdsKey = eventSectionIds.join(",");
  const readOwner = `${authorityEpoch}:${eventSectionIdsKey}`;

  const [events, setEvents] = useState<UpcomingEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const lastFetchedKeyRef = useRef<string | null>(null);
  const lastRetryRef = useRef(0);
  const requestGuard = useLatestRequestGuard();

  useEffect(() => {
    const ids = eventSectionIdsKey
      ? eventSectionIdsKey.split(",").filter(Boolean)
      : [];

    if (ids.length === 0) {
      setEvents([]);
      setIsError(false);
      setLoading(false);
      lastFetchedKeyRef.current = readOwner;
      return;
    }

    const requestToken = requestGuard.start();
    if (lastRetryRef.current !== retryAttempt) {
      removeSectionEventSummaries(queryClient);
      lastRetryRef.current = retryAttempt;
    }
    const isNewFetch = lastFetchedKeyRef.current !== readOwner;
    lastFetchedKeyRef.current = readOwner;

    if (isNewFetch) {
      setEvents([]);
      setLoading(true);
      setIsError(false);
    }

    void (async () => {
      try {
        const results = await Promise.all(
          ids.map(async (sectionId) => {
            const result = await loadSectionEventSummaries(queryClient, sectionId);
            return result.events.map((event) => ({
              id: event.id,
              title: event.title,
              location: event.location,
              guestOfHonour: event.guestOfHonour,
              startDateTime: event.startDateTime,
              endDateTime: event.endDateTime,
              sectionId,
              sectionName: sectionNameById[sectionId] ?? "Section",
            }));
          })
        );

        const now = Date.now();
        const upcoming = sortUpcomingSectionEvents(
          results.flat().filter((event) => isUpcomingSectionEvent(event, now))
        );

        if (requestGuard.isCurrent(requestToken)) {
          setEvents(upcoming);
          setIsError(false);
        }
      } catch (error) {
        if (requestGuard.isCurrent(requestToken)) {
          reportError("welcome.upcoming-events", error);
          setIsError(true);
          if (isAuthenticationFailure(error) || classifyAuthorizationFailure(error) || error instanceof SessionChangedError) {
            removeSectionEventSummaries(queryClient);
            setEvents([]);
          }
          // A transport failure may retain this same owner's already-loaded rows.
        }
      } finally {
        if (requestGuard.isCurrent(requestToken)) {
          setLoading(false);
        }
      }
    })();

    return () => {
      if (requestGuard.isCurrent(requestToken)) requestGuard.invalidate();
    };
  }, [eventSectionIdsKey, sectionNameById, retryAttempt, requestGuard, queryClient, readOwner]);

  return {
    events: lastFetchedKeyRef.current === readOwner ? events : [],
    loading: lastFetchedKeyRef.current === readOwner ? loading : eventSectionIds.length > 0,
    isError: lastFetchedKeyRef.current === readOwner && isError,
    retry: () => setRetryAttempt((attempt) => attempt + 1),
  };
}
