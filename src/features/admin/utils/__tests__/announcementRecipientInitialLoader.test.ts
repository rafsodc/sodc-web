import { describe, expect, it, vi } from "vitest";
import type {
  AnnouncementRecipient,
  AnnouncementRecipientPage,
} from "../../../../shared/utils/firebaseFunctions";
import { loadCompleteInitialGroup } from "../announcementRecipientInitialLoader";

function recipient(id: string): AnnouncementRecipient {
  return {
    id,
    sendId: "send-1",
    userId: `user-${id}`,
    email: `${id}@example.com`,
    firstName: "Test",
    lastName: `Smith ${id}`,
    status: "delivered",
    effectiveDeliveryMode: "LIVE",
  };
}

function page(args: {
  recipients: AnnouncementRecipient[];
  selectedCount?: number;
  page?: number;
  pageCount?: number;
}): AnnouncementRecipientPage {
  const selectedCount = args.selectedCount ?? 3;
  return {
    recipients: args.recipients,
    totalCount: selectedCount,
    filteredCount: selectedCount,
    initialCounts: { S: selectedCount, OTHER: 0 },
    page: args.page ?? 1,
    pageSize: 1,
    pageCount: args.pageCount ?? 3,
  };
}

describe("loadCompleteInitialGroup", () => {
  it("loads pages sequentially and deduplicates recipient IDs", async () => {
    const activeRequests: number[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const fetchPage = vi.fn(async (pageNumber: number) => {
      activeRequests.push(pageNumber);
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return page({
        page: pageNumber,
        recipients: pageNumber === 2 ? [recipient("1"), recipient("2")] : [recipient("3")],
      });
    });

    const outcome = await loadCompleteInitialGroup({
      initial: "S",
      seed: page({ recipients: [recipient("1")] }),
      startPage: 2,
      fetchPage,
      isCurrent: () => true,
    });

    expect(outcome.status).toBe("complete");
    expect(outcome.data.recipients.map(({ id }) => id)).toEqual(["1", "2", "3"]);
    expect(activeRequests).toEqual([2, 3]);
    expect(maxConcurrent).toBe(1);
  });

  it("stops when the selected count changes", async () => {
    const outcome = await loadCompleteInitialGroup({
      initial: "S",
      seed: page({ recipients: [recipient("1")] }),
      startPage: 2,
      fetchPage: async () => page({ recipients: [recipient("2")], selectedCount: 4, pageCount: 4 }),
      isCurrent: () => true,
    });

    expect(outcome.status).toBe("changed");
    expect(outcome.data.recipients.map(({ id }) => id)).toEqual(["1"]);
  });

  it("returns a resumable partial result when a later page fails", async () => {
    const error = new Error("network");
    const outcome = await loadCompleteInitialGroup({
      initial: "S",
      seed: page({ recipients: [recipient("1")] }),
      startPage: 2,
      fetchPage: async (pageNumber) => {
        if (pageNumber === 3) throw error;
        return page({ page: pageNumber, recipients: [recipient("2")] });
      },
      isCurrent: () => true,
    });

    expect(outcome).toMatchObject({ status: "partial", failedPage: 3, error });
    expect(outcome.data.recipients.map(({ id }) => id)).toEqual(["1", "2"]);
  });

  it("ignores a response after the request becomes stale", async () => {
    const outcome = await loadCompleteInitialGroup({
      initial: "S",
      seed: page({ recipients: [recipient("1")] }),
      startPage: 2,
      fetchPage: async () => page({ page: 2, recipients: [recipient("2")] }),
      isCurrent: () => false,
    });

    expect(outcome.status).toBe("stale");
    expect(outcome.data.recipients.map(({ id }) => id)).toEqual(["1"]);
  });
});
