import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SectionType } from "@dataconnect/generated";
import { getSectionEventsForUser } from "../../../../shared/utils/firebaseFunctions";
import { sectionsFingerprint, useUpcomingEventsForUser } from "../useUpcomingEventsForUser";
import type { AccessibleSection } from "../../../../shared/navigation/extractAccessibleSections";

vi.mock("../../../../shared/utils/firebaseFunctions", () => {
  return {
    getSectionEventsForUser: vi.fn(),
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
    vi.mocked(getSectionEventsForUser).mockReset();
    vi.mocked(getSectionEventsForUser).mockResolvedValue({
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
    } as unknown as Awaited<ReturnType<typeof getSectionEventsForUser>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads events through the member-safe callable without refetching unchanged sections", async () => {
    const { result, rerender } = renderHook(
      ({ sections }) => useUpcomingEventsForUser(sections),
      { initialProps: { sections: [eventSection] } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getSectionEventsForUser).toHaveBeenCalledOnce();
    expect(getSectionEventsForUser).toHaveBeenCalledWith("section-1");

    rerender({ sections: [{ ...eventSection }] });

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(1);
  });

  it("can retry a failed request and recover", async () => {
    const failure = new Error("temporary network failure");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getSectionEventsForUser)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({
        events: [],
      } as Awaited<ReturnType<typeof getSectionEventsForUser>>);

    const { result } = renderHook(() => useUpcomingEventsForUser([eventSection]));
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith("[welcome.upcoming-events]", failure, {});
    consoleError.mockRestore();
  });
});
