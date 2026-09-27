/** Calendar anniversaries clamp leap days and use UTC, matching profile-review prompts. */
export function isOlderThanYears(value: string | null | undefined, years: number, now = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  date.setUTCDate(1);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate()));
  return now.getTime() > date.getTime();
}

export function hasCurrentProfileReview(value: string | null | undefined, now = new Date()): boolean {
  return Boolean(value && Number.isFinite(new Date(value).getTime()) && !isOlderThanYears(value, 2, now));
}
