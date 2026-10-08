import { HttpsError } from "firebase-functions/v2/https";

/** Shared non-financial preferences for an individual attendee. */
export function ticketPreferences(data: Record<string, unknown>) {
  const { accommodationRequested, accommodationNote, seatingPreferences } = data;
  if (accommodationRequested != null && typeof accommodationRequested !== "boolean") {
    throw new HttpsError("invalid-argument", "Invalid accommodation request");
  }
  if (accommodationNote != null && (typeof accommodationNote !== "string" || accommodationNote.length > 2000)) {
    throw new HttpsError("invalid-argument", "Invalid accommodation note");
  }
  if (seatingPreferences != null && (!Array.isArray(seatingPreferences) || seatingPreferences.length > 20 ||
      seatingPreferences.some((name) => typeof name !== "string" || !name.trim() || name.length > 200))) {
    throw new HttpsError("invalid-argument", "Enter up to 20 seating preference names, each at most 200 characters");
  }
  return {
    accommodationRequested: (accommodationRequested as boolean | null | undefined) ?? null,
    accommodationNote: (accommodationNote as string | null | undefined)?.trim() ?? null,
    seatingPreferences: seatingPreferences == null ? null : Array.from(new Set((seatingPreferences as string[]).map((name) => name.trim()))),
  };
}
