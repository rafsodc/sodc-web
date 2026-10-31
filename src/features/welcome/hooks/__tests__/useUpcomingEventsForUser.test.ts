import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SectionType } from "@dataconnect/generated";
import { getSectionEventsForUser } from "../../../../shared/utils/firebaseFunctions";
import { sectionsFingerprint, useUpcomingEventsForUser } from "../useUpcomingEventsForUser";
import type { AccessibleSection } from "../../../../shared/navigation/extractAccessibleSections";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

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
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    client.clear();
    vi.restoreAllMocks();
  });

  it("loads events through the member-safe callable without refetching unchanged sections", async () => {
    const { result, rerender } = renderHook(
      ({ sections }) => useUpcomingEventsForUser(sections),
      { initialProps: { sections: [eventSection] }, wrapper }
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

    const { result } = renderHook(() => useUpcomingEventsForUser([eventSection]), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(getSectionEventsForUser).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith("[welcome.upcoming-events]", failure, {});
    consoleError.mockRestore();
  });

  it("reuses a fresh summary when Home mounts again in the same document", async () => {
    const first = renderHook(() => useUpcomingEventsForUser([eventSection]), { wrapper });
    await waitFor(() => expect(first.result.current.events).toHaveLength(1));
    first.unmount();
    const next = renderHook(() => useUpcomingEventsForUser([eventSection]), { wrapper });
    await waitFor(() => expect(next.result.current.events).toHaveLength(1));
    expect(getSectionEventsForUser).toHaveBeenCalledOnce();
  });

  it("refreshes all sections on retry without one section cancelling another", async () => {
    const sections = [eventSection, { ...eventSection, id: "section-2" }];
    const { result } = renderHook(() => useUpcomingEventsForUser(sections), { wrapper });
    await waitFor(() => expect(result.current.events).toHaveLength(2));
    act(() => result.current.retry());
    await waitFor(() => expect(getSectionEventsForUser).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.events).toHaveLength(2);
  });

  it("does not keep a previous section's events after its replacement fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, rerender } = renderHook(({ sections }) => useUpcomingEventsForUser(sections), {
      initialProps: { sections: [eventSection] }, wrapper,
    });
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    vi.mocked(getSectionEventsForUser).mockRejectedValueOnce(new Error("new section unavailable"));
    rerender({ sections: [{ ...eventSection, id: "other-section" }] });
    expect(result.current.events).toEqual([]);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.events).toEqual([]);
    consoleError.mockRestore();
  });

  it.each(["functions/permission-denied", "ACCESS_REVOKED"])("clears previously loaded cards when retry reports %s", async code => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useUpcomingEventsForUser([eventSection]), { wrapper });
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    vi.mocked(getSectionEventsForUser).mockRejectedValueOnce({ code });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.events).toEqual([]);
  });
});
