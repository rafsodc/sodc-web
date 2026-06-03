import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SectionType } from "@dataconnect/generated";
import { getEventsForSection } from "@dataconnect/generated";
import { sectionsFingerprint, useUpcomingEventsForUser } from "../useUpcomingEventsForUser";
import type { AccessibleSection } from "../../../../shared/navigation/extractAccessibleSections";

vi.mock("@dataconnect/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dataconnect/generated")>();
  return {
    ...actual,
    getEventsForSection: vi.fn(),
  };
});

const eventSection: AccessibleSection = {
  id: "section-1",
  name: "Signals",
  type: SectionType.EVENTS,
  description: "Events section",
};

describe("sectionsFingerprint", () => {
  it("is equal for arrays with the same sections in different order", () => {
    const a = [eventSection];
    const b = [{ ...eventSection }];
    expect(sectionsFingerprint(a)).toBe(sectionsFingerprint(b));
  });
});

describe("useUpcomingEventsForUser", () => {
  beforeEach(() => {
    vi.mocked(getEventsForSection).mockReset();
    vi.mocked(getEventsForSection).mockResolvedValue({
      data: {
        section: {
          id: "section-1",
          events: [
            {
              id: "event-1",
              title: "Dinner",
              location: "Club",
              guestOfHonour: null,
              startDateTime: "2030-01-01T18:00:00.000Z",
              endDateTime: "2030-01-01T22:00:00.000Z",
              bookingStartDateTime: "2029-01-01T00:00:00.000Z",
              bookingEndDateTime: "2030-01-01T00:00:00.000Z",
              maxGuestsWithoutModeratorApproval: null,
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof getEventsForSection>>);
  });

  it("does not refetch when the sections array reference changes but content is the same", async () => {
    const { result, rerender } = renderHook(
      ({ sections }) => useUpcomingEventsForUser(sections),
      { initialProps: { sections: [eventSection] } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getEventsForSection).toHaveBeenCalledTimes(1);

    rerender({ sections: [{ ...eventSection }] });

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(getEventsForSection).toHaveBeenCalledTimes(1);
  });
});
