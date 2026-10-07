import { ATTENDEE_EMAIL_SEPARATOR_COOKIE } from "../../../shared/cookies/cookieCatalog";
import { getCookie, setCookie } from "../../../shared/utils/cookies";

export type AttendeeEmailSeparator = ", " | "; ";

export const DEFAULT_ATTENDEE_EMAIL_SEPARATOR: AttendeeEmailSeparator = ", ";

export function readAttendeeEmailSeparator(): AttendeeEmailSeparator {
  try {
    return getCookie(ATTENDEE_EMAIL_SEPARATOR_COOKIE) === "semicolon"
      ? "; "
      : DEFAULT_ATTENDEE_EMAIL_SEPARATOR;
  } catch {
    return DEFAULT_ATTENDEE_EMAIL_SEPARATOR;
  }
}

export function writeAttendeeEmailSeparator(separator: AttendeeEmailSeparator): void {
  try {
    setCookie(
      ATTENDEE_EMAIL_SEPARATOR_COOKIE,
      separator === "; " ? "semicolon" : "comma"
    );
  } catch {
    // The selection still applies to this page if browser storage is blocked.
  }
}
