const REVIEW_INTERVAL_MONTHS = 6;

/**
 * Adds calendar months in UTC, clamping dates at the end of shorter months.
 * For example, 31 August plus six months becomes 28/29 February.
 */
export function addUtcCalendarMonths(value: Date, months: number): Date {
  const result = new Date(value.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return result;
}

/**
 * A missing or invalid review timestamp fails safe by requiring review.
 * At the exact six-calendar-month boundary the profile is not yet overdue.
 */
export function isProfileReviewDue(
  profileReviewedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!profileReviewedAt) return true;

  const reviewedAt = new Date(profileReviewedAt);
  if (Number.isNaN(reviewedAt.getTime())) return true;

  const dueAt = addUtcCalendarMonths(reviewedAt, REVIEW_INTERVAL_MONTHS);
  return now.getTime() > dueAt.getTime();
}
