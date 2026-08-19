import type {
  AnnouncementRecipientPage,
  AnnouncementRecipientSurnameInitial,
} from "../../../shared/utils/firebaseFunctions";
import { classifyError } from "../../../shared/errors";

const RATE_LIMIT_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

export function announcementRecipientRetryDelayMs(
  error: unknown,
  failedAttempt: number,
): number | null {
  if (classifyError(error) !== "rate-limit") return null;
  return RATE_LIMIT_BACKOFF_MS[failedAttempt] ?? null;
}

export type CompleteInitialLoadOutcome =
  | { status: "complete"; data: AnnouncementRecipientPage; resultsChanged: boolean }
  | { status: "partial"; data: AnnouncementRecipientPage; failedPage: number; error: unknown }
  | { status: "stale"; data: AnnouncementRecipientPage };

interface LoadCompleteInitialGroupOptions {
  initial: AnnouncementRecipientSurnameInitial;
  seed: AnnouncementRecipientPage;
  startPage: number;
  fetchPage: (page: number) => Promise<AnnouncementRecipientPage>;
  isCurrent: () => boolean;
  onProgress?: (data: AnnouncementRecipientPage) => void;
  retryDelayMs?: (error: unknown, failedAttempt: number) => number | null;
  wait?: (delayMs: number) => Promise<void>;
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
  retryDelayMs,
  wait = (delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs)),
}: LoadCompleteInitialGroupOptions): Promise<CompleteInitialLoadOutcome> {
  let latestCount = seed.initialCounts[initial] ?? 0;
  let targetPageCount = seed.pageCount;
  let resultsChanged = false;
  let data = { ...seed, page: 1, recipients: appendUniqueRecipients([], seed.recipients) };

  for (let nextPage = startPage; nextPage <= targetPageCount; nextPage += 1) {
    let next: AnnouncementRecipientPage;
    let failedAttempt = 0;
    while (true) {
      try {
        next = await fetchPage(nextPage);
        break;
      } catch (error) {
        const delayMs = retryDelayMs?.(error, failedAttempt) ?? null;
        if (delayMs === null) return { status: "partial", data, failedPage: nextPage, error };
        failedAttempt += 1;
        await wait(delayMs);
        if (!isCurrent()) return { status: "stale", data };
      }
    }
    if (!isCurrent()) return { status: "stale", data };

    const nextCount = next.initialCounts[initial] ?? 0;
    resultsChanged ||= nextCount !== latestCount || next.pageCount !== targetPageCount;
    latestCount = nextCount;
    targetPageCount = next.pageCount;

    data = {
      ...next,
      page: 1,
      recipients: appendUniqueRecipients(data.recipients, next.recipients),
    };
    onProgress?.(data);
  }

  return { status: "complete", data, resultsChanged };
}
