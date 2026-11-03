export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  // datetime-local strings have no timezone — parse as local time explicitly.
  // new Date("2026-07-28") would be treated as midnight UTC by spec, which is
  // the previous evening in BST and causes future events to appear as past.
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(value);
  if (!parts) throw new RangeError("Invalid local date/time");
  const [, y, m, d, h = "00", min = "00", s = "00", fraction = ""] = parts;
  const [year, month, day, hours, minutes, seconds, milliseconds] =
    [Number(y), Number(m), Number(d), Number(h), Number(min), Number(s), Number(fraction.padEnd(3, "0"))];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) {
    throw new RangeError("Invalid local date/time");
  }
  // setFullYear avoids Date's special treatment of years 00–99 as 1900–1999.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hours, minutes, seconds, milliseconds);
  // Date normally rolls invalid calendar dates and nonexistent DST times forward.
  // Reject those instead of silently persisting a different wall-clock time.
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 ||
      date.getDate() !== day || date.getHours() !== hours || date.getMinutes() !== minutes ||
      date.getSeconds() !== seconds || date.getMilliseconds() !== milliseconds ||
      date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) {
    throw new RangeError("Invalid or nonexistent local date/time");
  }
  return date.toISOString();
}

export const EVENT_DATE_TIME_FIELDS = [
  "startDateTime", "endDateTime", "bookingStartDateTime", "bookingEndDateTime",
] as const;
export type EventDateTimeField = typeof EVENT_DATE_TIME_FIELDS[number];
export type EventDateTimeFields = Record<EventDateTimeField, string>;
export type EventDateTimeErrors = Partial<EventDateTimeFields>;
type EventDateTimeValidation =
  | { valid: true; errors: EventDateTimeErrors; timestamps: EventDateTimeFields }
  | { valid: false; errors: EventDateTimeErrors };

export function validateEventDateTimes(values: EventDateTimeFields): EventDateTimeValidation {
  const labels: EventDateTimeFields = {
    startDateTime: "Start date/time", endDateTime: "End date/time",
    bookingStartDateTime: "Booking window start", bookingEndDateTime: "Booking window end",
  };
  const errors: EventDateTimeErrors = {};
  const timestamps = {} as EventDateTimeFields;
  for (const field of EVENT_DATE_TIME_FIELDS) {
    if (!values[field].trim()) {
      errors[field] = `${labels[field]} is required.`;
      continue;
    }
    try {
      if (!values[field].includes("T")) throw new RangeError("Time is required");
      timestamps[field] = fromDatetimeLocal(values[field]);
    } catch {
      errors[field] = `Enter a valid ${labels[field].toLowerCase()}.`;
    }
  }
  // Compare instants after local-to-UTC conversion. Equal endpoints remain valid;
  // the booking window has no additional relationship to the event schedule.
  if (!errors.startDateTime && !errors.endDateTime && Date.parse(timestamps.endDateTime) < Date.parse(timestamps.startDateTime)) {
    errors.endDateTime = "End date/time must be on or after start date/time.";
  }
  if (!errors.bookingStartDateTime && !errors.bookingEndDateTime && Date.parse(timestamps.bookingEndDateTime) < Date.parse(timestamps.bookingStartDateTime)) {
    errors.bookingEndDateTime = "Booking window end must be on or after booking window start.";
  }
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, errors, timestamps };
}
