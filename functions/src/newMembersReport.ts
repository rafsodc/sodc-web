import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  getNewMemberReportMigration, listNewMemberReportEvents, listNewMemberReportProfiles,
  getEventByIdForCallable,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { requireAdmin, requireString, validateUUID, handleFunctionError } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import { CURRENT_MEMBER_STATUSES, type NewMemberReport, type NewMemberReportOptions } from "./shared/newMemberReport";

const PAGE_SIZE = 500;
async function allPages<T>(fetch: (offset: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetch(offset);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
async function migrationStart(): Promise<string | null> {
  return (await getNewMemberReportMigration()).data.legacyUserIdentities[0]?.importedAt ?? null;
}

export const getNewMemberReportOptions = onCall({ region: FUNCTIONS_REGION }, async (request): Promise<NewMemberReportOptions> => {
  requireAdmin(request);
  await enforceRateLimit("getNewMemberReportOptions", request.auth!.uid);
  try {
    const through = new Date().toISOString();
    const [migrationAt, events] = await Promise.all([
      migrationStart(),
      allPages(async (offset) => (await listNewMemberReportEvents({ through, limit: PAGE_SIZE, offset })).data.events),
    ]);
    return { migrationAt, events: events.map((event) => ({ id: event.id, title: event.title, endsAt: event.endDateTime, sectionName: event.section.name })) };
  } catch (error) {
    handleFunctionError(error, "loading new member report options");
  }
});

export const getNewMembersReport = onCall({ region: FUNCTIONS_REGION }, async (request): Promise<NewMemberReport> => {
  requireAdmin(request);
  await enforceRateLimit("getNewMembersReport", request.auth!.uid);
  try {
    const selection = request.data?.selection;
    const membership = request.data?.membership ?? "current";
    if (!selection || !["migration", "event", "date"].includes(selection.kind) || !["current", "all"].includes(membership)) {
      throw new HttpsError("invalid-argument", "Choose a report period and membership filter");
    }
    const through = new Date().toISOString();
    let since: string;
    let baselineLabel: string;
    if (selection.kind === "migration") {
      const migrationAt = await migrationStart();
      if (!migrationAt) throw new HttpsError("failed-precondition", "No site migration is recorded. Choose an event or date.");
      since = migrationAt;
      baselineLabel = "Site migration";
    } else if (selection.kind === "event") {
      const eventId = validateUUID(requireString(selection.eventId, "eventId"));
      const event = (await getEventByIdForCallable({ id: eventId })).data.event;
      if (!event) throw new HttpsError("not-found", "Event not found");
      since = event.endDateTime;
      baselineLabel = event.title;
    } else {
      since = requireString(selection.since, "since");
      const time = Date.parse(since);
      if (!Number.isFinite(time) || new Date(time).toISOString() !== since) {
        throw new HttpsError("invalid-argument", "Choose a valid start date");
      }
      baselineLabel = "Selected date";
    }
    const start = Date.parse(since);
    if (!Number.isFinite(start) || start > Date.parse(through)) throw new HttpsError("invalid-argument", "Choose a date or event in the past");
    const profiles = await allPages(async (offset) => (await listNewMemberReportProfiles({ since, through, limit: PAGE_SIZE, offset })).data.users);
    const members = profiles.filter((profile) =>
      // Linked pre-existing profiles and reset-required imports are also legacy users.
      !profile.legacyIdentity && profile.legacyPasswordMigrated == null && profile.createdBy !== "legacy-migration" &&
      (membership === "all" || CURRENT_MEMBER_STATUSES.some((status) => status === profile.membershipStatus))
    ).map((profile) => ({
      id: profile.id, firstName: profile.firstName, lastName: profile.lastName, email: profile.email,
      rank: profile.rank ?? null, membershipStatus: profile.membershipStatus, joinedAt: profile.createdAt,
    })).sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt) || a.id.localeCompare(b.id));
    return { since, through, baselineLabel, members };
  } catch (error) {
    handleFunctionError(error, "loading new members report");
  }
});
