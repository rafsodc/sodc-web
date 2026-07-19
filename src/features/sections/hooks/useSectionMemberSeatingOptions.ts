import { useEffect, useState } from "react";
import { getSectionMembersMerged } from "../../../shared/utils/firebaseFunctions";

export interface SectionMemberSeatingOption {
  id: string;
  label: string;
}

export function useSectionMemberSeatingOptions(
  sectionId: string,
  currentUserId: string | undefined
): SectionMemberSeatingOption[] {
  const [options, setOptions] = useState<SectionMemberSeatingOption[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const merged = await getSectionMembersMerged(sectionId);
        if (!active) return;
        setOptions(
          (merged.members ?? [])
            .filter((member) => member.id !== currentUserId)
            .map((member) => ({
              id: member.id,
              label: `${member.firstName} ${member.lastName}`,
            }))
        );
      } catch {
        if (active) setOptions([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [sectionId, currentUserId]);

  return options;
}
