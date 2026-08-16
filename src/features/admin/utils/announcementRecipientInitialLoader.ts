import type {
  AnnouncementRecipientInitial,
  AnnouncementRecipientPage,
} from "../../../shared/utils/firebaseFunctions";

export type CompleteInitialLoadOutcome =
  | { status: "complete"; data: AnnouncementRecipientPage }
  | { status: "changed"; data: AnnouncementRecipientPage }
  | { status: "partial"; data: AnnouncementRecipientPage; failedPage: number; error: unknown }
  | { status: "stale"; data: AnnouncementRecipientPage };

interface LoadCompleteInitialGroupOptions {
  initial: Exclude<AnnouncementRecipientInitial, "ALL">;
  seed: AnnouncementRecipientPage;
  startPage: number;
  fetchPage: (page: number) => Promise<AnnouncementRecipientPage>;
  isCurrent: () => boolean;
  onProgress?: (data: AnnouncementRecipientPage) => void;
}

function appendUniqueRecipients(
  current: AnnouncementRecipientPage["recipients"],
  incoming: AnnouncementRecipientPage["recipients"],
): AnnouncementRecipientPage["recipients"] {
  const seen = new Set(current.map(({ id }) => id));
  return [...current, ...incoming.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

/**
 * Sequentially exhausts the bounded API pages for one surname initial.
 * The seed may be page one or a previously loaded partial result.
 */
export async function loadCompleteInitialGroup({
  initial,
  seed,
  startPage,
  fetchPage,
  isCurrent,
  onProgress,
}: LoadCompleteInitialGroupOptions): Promise<CompleteInitialLoadOutcome> {
  const expectedCount = seed.initialCounts[initial] ?? 0;
  const expectedPageCount = seed.pageCount;
  let data = { ...seed, page: 1, recipients: appendUniqueRecipients([], seed.recipients) };

  for (let nextPage = startPage; nextPage <= expectedPageCount; nextPage += 1) {
    let next: AnnouncementRecipientPage;
    try {
      next = await fetchPage(nextPage);
    } catch (error) {
      return { status: "partial", data, failedPage: nextPage, error };
    }
    if (!isCurrent()) return { status: "stale", data };
    if ((next.initialCounts[initial] ?? 0) !== expectedCount || next.pageCount !== expectedPageCount) {
      return { status: "changed", data };
    }

    data = {
      ...data,
      recipients: appendUniqueRecipients(data.recipients, next.recipients),
    };
    onProgress?.(data);
  }

  return data.recipients.length === expectedCount
    ? { status: "complete", data }
    : { status: "changed", data };
}
