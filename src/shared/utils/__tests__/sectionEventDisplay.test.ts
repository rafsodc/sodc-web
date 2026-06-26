import { describe, expect, it } from "vitest";
import {
  formatSectionEventWhen,
  isUpcomingSectionEvent,
  partitionSectionEventsByTiming,
} from "../sectionEventDisplay";

const nowMs = new Date("2026-06-01T12:00:00.000Z").getTime();

describe("sectionEventDisplay", () => {
  it("treats events as upcoming until endDateTime has passed", () => {
    expect(
      isUpcomingSectionEvent(
        { endDateTime: "2026-06-01T13:00:00.000Z" },
        nowMs
      )
    ).toBe(true);
    expect(
      isUpcomingSectionEvent(
        { endDateTime: "2026-06-01T11:00:00.000Z" },
        nowMs
      )
    ).toBe(false);
  });

  it("partitions and sorts upcoming soonest-first and past most-recent-first", () => {
    const { upcoming, past } = partitionSectionEventsByTiming(
      [
        {
          id: "past-old",
          title: "Old",
          startDateTime: "2026-01-01T18:00:00.000Z",
          endDateTime: "2026-01-01T22:00:00.000Z",
        },
        {
          id: "upcoming-later",
          title: "Later",
          startDateTime: "2026-08-01T18:00:00.000Z",
          endDateTime: "2026-08-01T22:00:00.000Z",
        },
        {
          id: "past-recent",
          title: "Recent past",
          startDateTime: "2026-05-01T18:00:00.000Z",
          endDateTime: "2026-05-01T22:00:00.000Z",
        },
        {
          id: "upcoming-soon",
          title: "Soon",
          startDateTime: "2026-07-01T18:00:00.000Z",
          endDateTime: "2026-07-01T22:00:00.000Z",
        },
      ],
      nowMs
    );

    expect(upcoming.map((e) => e.id)).toEqual(["upcoming-soon", "upcoming-later"]);
    expect(past.map((e) => e.id)).toEqual(["past-recent", "past-old"]);
  });

  it("formats event date/time for display", () => {
    const formatted = formatSectionEventWhen(
      "2026-07-01T18:00:00.000Z",
      "2026-07-01T22:00:00.000Z"
    );
    expect(formatted).toContain("–");
    expect(formatted.length).toBeGreaterThan(10);
  });
});
