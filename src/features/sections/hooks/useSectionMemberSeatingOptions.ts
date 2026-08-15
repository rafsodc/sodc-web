import { useEffect, useMemo, useState } from "react";
import { searchSectionMembers } from "../../../shared/utils/firebaseFunctions";
import { useLatestRequestGuard } from "../../../shared/hooks/useLatestRequestGuard";

export interface SectionMemberSeatingOption {
  id: string;
  label: string;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Typeahead search over a section's population for the booking wizard's "sit next to" field.
 * A section roster can run into the hundreds, so this searches server-side rather than
 * loading every eligible member into the Autocomplete's option list.
 */
export function useSectionMemberSeatingSearch(
  sectionId: string,
  currentUserId: string | undefined,
  selectedIds: string[]
): {
  inputValue: string;
  setInputValue: (value: string) => void;
  options: SectionMemberSeatingOption[];
  loading: boolean;
} {
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<SectionMemberSeatingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Map<string, string>>(new Map());
  const selectedLabelsRequestGuard = useLatestRequestGuard();
  const searchRequestGuard = useLatestRequestGuard();

  // Resolve labels for already-selected ids we don't have yet (e.g. hydrated from an
  // existing booking) so their chips render correctly without waiting on a fresh search.
  useEffect(() => {
    const missing = selectedIds.filter((id) => !selectedLabels.has(id));
    if (missing.length === 0) return;
    const requestToken = selectedLabelsRequestGuard.start();
    void (async () => {
      try {
        const result = await searchSectionMembers(sectionId, "", missing);
        if (!selectedLabelsRequestGuard.isCurrent(requestToken)) return;
        setSelectedLabels((prev) => {
          const next = new Map(prev);
          for (const m of result.members) {
            if (missing.includes(m.id)) next.set(m.id, `${m.firstName} ${m.lastName}`);
          }
          return next;
        });
      } catch {
        // Chip will render without a label until the next resolution attempt.
      }
    })();
    return () => {
      if (selectedLabelsRequestGuard.isCurrent(requestToken)) {
        selectedLabelsRequestGuard.invalidate();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, selectedIds.join(","), selectedLabelsRequestGuard]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setSearchResults([]);
      setLoading(false);
      return;
    }
    const requestToken = searchRequestGuard.start();
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await searchSectionMembers(sectionId, inputValue, selectedIds);
          if (!searchRequestGuard.isCurrent(requestToken)) return;
          setSearchResults(
            result.members
              .filter((m) => m.id !== currentUserId)
              .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }))
          );
        } catch {
          if (searchRequestGuard.isCurrent(requestToken)) setSearchResults([]);
        } finally {
          if (searchRequestGuard.isCurrent(requestToken)) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      if (searchRequestGuard.isCurrent(requestToken)) searchRequestGuard.invalidate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, inputValue, currentUserId, selectedIds.join(","), searchRequestGuard]);

  const options = useMemo(() => {
    const byId = new Map<string, SectionMemberSeatingOption>();
    for (const option of searchResults) byId.set(option.id, option);
    for (const id of selectedIds) {
      if (!byId.has(id) && selectedLabels.has(id)) {
        byId.set(id, { id, label: selectedLabels.get(id)! });
      }
    }
    return Array.from(byId.values());
  }, [searchResults, selectedIds, selectedLabels]);

  return { inputValue, setInputValue, options, loading };
}
