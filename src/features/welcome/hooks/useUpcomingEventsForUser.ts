import { useEffect, useMemo, useState } from "react";
import { getEventsForSection } from "@dataconnect/generated";
import type { UUIDString } from "@dataconnect/generated";
import { SectionType } from "@dataconnect/generated";
import { dataConnect } from "../../../config/firebase";
import type { AccessibleSection } from "../../../shared/navigation/extractAccessibleSections";

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

export function useUpcomingEventsForUser(sections: AccessibleSection[]) {
  const eventSectionIds = useMemo(
    () =>
      sections
        .filter((s) => s.type === SectionType.EVENTS)
        .map((s) => s.id as UUIDString),
    [sections]
  );

  const [events, setEvents] = useState<UpcomingEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (eventSectionIds.length === 0) {
      setEvents([]);
      setIsError(false);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setIsError(false);

    void (async () => {
      try {
        const results = await Promise.all(
          eventSectionIds.map(async (sectionId) => {
            const sectionMeta = sections.find((s) => s.id === sectionId);
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
              sectionName: sectionMeta?.name ?? section?.name ?? "Section",
            }));
          })
        );

        const now = Date.now();
        const upcoming = results
          .flat()
          .filter((event) => new Date(event.endDateTime).getTime() >= now)
          .sort(
            (a, b) =>
              new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
          );

        if (alive) {
          setEvents(upcoming);
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
  }, [eventSectionIds, sections]);

  return { events, loading, isError };
}
