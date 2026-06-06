import { useEffect, useMemo, useRef, useState } from "react";
import { getEventsForSection } from "@dataconnect/generated";
import type { UUIDString } from "@dataconnect/generated";
import { SectionType } from "@dataconnect/generated";
import { dataConnect } from "../../../config/firebase";
import type { AccessibleSection } from "../../../shared/navigation/extractAccessibleSections";
import {
  isUpcomingSectionEvent,
  sortUpcomingSectionEvents,
} from "../../../shared/utils/sectionEventDisplay";

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
  const fingerprint = sectionsFingerprint(sections);

  const { eventSectionIds, sectionNameById } = useMemo(() => {
    const eventSections = sections.filter((s) => s.type === SectionType.EVENTS);
    const names: Record<string, string> = {};
    for (const section of eventSections) {
      names[section.id] = section.name;
    }
    return {
      eventSectionIds: eventSections.map((s) => s.id as UUIDString).sort(),
      sectionNameById: names,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint encodes sections content without unstable array refs
  }, [fingerprint]);

  const eventSectionIdsKey = eventSectionIds.join(",");

  const [events, setEvents] = useState<UpcomingEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const lastFetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const ids = eventSectionIdsKey
      ? (eventSectionIdsKey.split(",").filter(Boolean) as UUIDString[])
      : [];

    if (ids.length === 0) {
      setEvents([]);
      setIsError(false);
      setLoading(false);
      lastFetchedKeyRef.current = "";
      return;
    }

    let alive = true;
    const isNewFetch = lastFetchedKeyRef.current !== eventSectionIdsKey;
    lastFetchedKeyRef.current = eventSectionIdsKey;

    if (isNewFetch) {
      setLoading(true);
      setIsError(false);
    }

    void (async () => {
      try {
        const results = await Promise.all(
          ids.map(async (sectionId) => {
            const result = await getEventsForSection(dataConnect, { sectionId });
            const section = result.data?.section;
            return (section?.events ?? []).map((event) => ({
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

        if (alive) {
          setEvents(upcoming);
          setIsError(false);
        }
      } catch {
        if (alive) {
          setIsError(true);
          setEvents([]);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [eventSectionIdsKey, sectionNameById]);

  return { events, loading, isError };
}
