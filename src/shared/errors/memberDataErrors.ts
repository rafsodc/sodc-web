import { toUserFacingError, type UserFacingError } from "./errorHandling";

export type MemberDataContext =
  | "sections"
  | "events"
  | "event"
  | "files"
  | "bookings"
  | "payments"
  | "profile"
  | "preferences";

const CONTEXT_MESSAGES: Record<MemberDataContext, string> = {
  sections: "We could not load your sections. Please try again.",
  events: "We could not load the events. Please try again.",
  event: "We could not load this event. Please try again.",
  files: "We could not load the files for this section. Please try again.",
  bookings: "We could not load your bookings. Please try again.",
  payments: "We could not load your payments. Please try again.",
  profile: "We could not load your profile. Please try again.",
  preferences: "We could not load your communication preferences. Please try again.",
};

/** Maps member-data failures without ever displaying provider or query messages. */
export function toMemberDataError(error: unknown, context: MemberDataContext): UserFacingError {
  const mapped = toUserFacingError(error);
  if (mapped.category !== "unknown") return mapped;
  return {
    ...mapped,
    title: "Unable to load information",
    message: CONTEXT_MESSAGES[context],
  };
}
