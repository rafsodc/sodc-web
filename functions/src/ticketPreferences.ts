import { HttpsError } from "firebase-functions/v2/https";

/** Shared non-financial preferences for an individual attendee. */
export function ticketPreferences(data: Record<string, unknown>) {
  const { accommodationRequested, accommodationNote, sitNextToUserIds } = data;
  if (accommodationRequested != null && typeof accommodationRequested !== "boolean") {
    throw new HttpsError("invalid-argument", "Invalid accommodation request");
  }
  if (accommodationNote != null && (typeof accommodationNote !== "string" || accommodationNote.length > 2000)) {
    throw new HttpsError("invalid-argument", "Invalid accommodation note");
  }
  if (sitNextToUserIds != null && (!Array.isArray(sitNextToUserIds) || sitNextToUserIds.length > 10 ||
      sitNextToUserIds.some((name) => typeof name !== "string" || !name.trim() || name.length > 128))) {
    throw new HttpsError("invalid-argument", "Choose up to 10 members for seating preferences; user IDs must be at most 128 characters");
  }
  return {
    accommodationRequested: (accommodationRequested as boolean | null | undefined) ?? null,
    accommodationNote: (accommodationNote as string | null | undefined)?.trim() ?? null,
    sitNextToUserIds: sitNextToUserIds == null ? null : Array.from(new Set((sitNextToUserIds as string[]).map((name) => name.trim()))),
  };
}
