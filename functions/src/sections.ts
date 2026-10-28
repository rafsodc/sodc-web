import { currentAuthorization } from "./currentAuthorization";
import * as firebaseAdmin from "firebase-admin";
import { hasCurrentProfileReview } from "./memberReviewRules";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireEnabled, requireString, handleFunctionError } from "./helpers";
import { enforceRateLimit } from "./rateLimiter";
import {
  serviceGetSectionById as getSectionById,
  getSectionMembers,
  serviceGetEventsForSection as getEventsForSection,
  serviceGetEventById as getEventById,
  serviceGetUserAccessGroupsById as getUserAccessGroupsById,
  getUserMembershipStatus,
  serviceListUsers as listUsers,
  searchSectionMemberCandidates,
  SectionType,
  TicketAudience,
  type GetSectionByIdData,
  type MembershipStatus,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import { linkHasPurpose, resolveSectionAccess, requireSectionModerator } from "./sectionAccess";
import { caseInsensitiveContainsPattern } from "./dataConnectSearch";

export interface SectionMemberResponse {
  id: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  rank: string | null;
  sharesContactInfo: boolean;
  /** Null whenever sharesContactInfo is false — the client never receives it, this isn't just hidden client-side. See #273. */
  email: string | null;
  /** Null whenever sharesContactInfo is false or no mobile number is stored. */
  mobileNumber: string | null;
}

function toSectionMemberResponse(u: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string | null;
  membershipStatus: string;
  rank?: string | null;
  shareContactInfo?: boolean | null;
  profileReviewedAt?: string | null;
}): SectionMemberResponse {
  const sharesContactInfo = u.shareContactInfo !== false && hasCurrentProfileReview(u.profileReviewedAt);
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    membershipStatus: u.membershipStatus,
    rank: u.rank ?? null,
    sharesContactInfo,
    email: sharesContactInfo ? u.email : null,
    mobileNumber: sharesContactInfo ? u.mobileNumber ?? null : null,
  };
}

/** Auth batch lookups fail closed; missing/unverified accounts never enter the directory. */
async function verifiedDirectoryMembers(members: SectionMemberResponse[]): Promise<SectionMemberResponse[]> {
  const verified = new Set<string>();
  for (let offset = 0; offset < members.length; offset += 100) {
    const result = await firebaseAdmin.auth().getUsers(members.slice(offset, offset + 100).map(({ id }) => ({ uid: id })));
    for (const user of result.users) if (user.emailVerified) verified.add(user.uid);
  }
  return members.filter((member) => verified.has(member.id));
}

interface RawSectionMemberUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber?: string | null;
  membershipStatus: string;
  rank?: string | null;
  shareContactInfo?: boolean | null;
  profileReviewedAt?: string | null;
}

/**
 * Loads merged section members (explicit UserUserGroup + inherited by membership status).
 * Throws not-found/permission-denied for a section the caller can't see.
 */
async function loadSectionMemberPopulation(
  sectionId: string,
  callerUid: string,
  callerIsAdmin = false,
  requestedIds?: ReadonlySet<string>
): Promise<SectionMemberResponse[]> {
  const [sectionResult, membersResult, callerGroupsResult, userStatusResult] = await Promise.all([
    getSectionById({ id: sectionId }),
    getSectionMembers({ sectionId }),
    getUserAccessGroupsById({ userId: callerUid }),
    getUserMembershipStatus({ id: callerUid }),
  ]);

  const section = sectionResult.data?.section;
  if (!section) {
    throw new HttpsError("not-found", "Section not found");
  }

  const purposeLinks = section.purposeLinks ?? [];
  const accessGroupIds = new Set(
    purposeLinks
      .filter((pl) => linkHasPurpose(pl, "ACCESS") || linkHasPurpose(pl, "MODERATOR"))
      .map((pl) => pl.userGroup.id)
  );
  const callerGroupIds = new Set(
    (callerGroupsResult.data?.user?.userGroups || []).map((ug: { userGroup: { id: string } }) => ug.userGroup.id)
  );
  const canAccess = [...accessGroupIds].some((id) => callerGroupIds.has(id));
  let canAccessByStatus = false;
  if (!canAccess) {
    const sectionData = membersResult.data?.section;
    const userStatus = userStatusResult.data?.user?.membershipStatus;
    if (userStatus && sectionData?.purposeLinks?.length) {
      canAccessByStatus = sectionData.purposeLinks.some(
        (rel) =>
          (linkHasPurpose(rel, "ACCESS") || linkHasPurpose(rel, "MODERATOR")) &&
          (rel.userGroup.membershipStatuses?.includes(userStatus) ?? false)
      );
    }
  }

  if (!callerIsAdmin && !canAccess && !canAccessByStatus) {
    throw new HttpsError("permission-denied", "You do not have permission to view this section");
  }

  const sectionData = membersResult.data?.section;
  if (!sectionData) {
    return [];
  }

  // A MEMBERS-type section only has members if it has an explicit MEMBER-purpose group —
  // ACCESS/MODERATOR only grant seeing the section, not membership. See #322. EVENTS-type
  // sections don't use a MEMBER roster at all (they're organised around ACCESS-purpose
  // booking eligibility instead), so for those, fall back to ACCESS/MODERATOR groups — this
  // population also backs the booking wizard's "sit next to" picker, which needs the event's
  // actual eligible population, not a member/access distinction that doesn't apply to EVENTS
  // sections.
  const links = sectionData.purposeLinks ?? [];
  const memberLinks = links.filter((p) => linkHasPurpose(p, "MEMBER"));
  const sourceLinks =
    memberLinks.length > 0
      ? memberLinks
      : sectionData.type === SectionType.EVENTS
        ? links.filter((p) => linkHasPurpose(p, "ACCESS") || linkHasPurpose(p, "MODERATOR"))
        : [];

  const statuses = new Set<string>();
  const explicitMap = new Map<string, SectionMemberResponse>();

  for (const rel of sourceLinks) {
    const group = (rel as { userGroup: { membershipStatuses?: string[]; users: Array<{ user: RawSectionMemberUser }> } })
      .userGroup;
    if (group.membershipStatuses) {
      group.membershipStatuses.forEach((s: string) => statuses.add(s));
    }
    if ((group.users?.length ?? 0) >= 5000) throw new HttpsError("resource-exhausted", "Directory is too large to load safely");
    for (const uag of group.users || []) {
      const u = uag.user;
      if (!explicitMap.has(u.id)) {
        explicitMap.set(u.id, toSectionMemberResponse(u));
      }
    }
  }

  // Name chunks use the identical roster rules but need verify only their own
  // requested members. The full directory still verifies its entire population.
  const verifyPopulation = (members: SectionMemberResponse[]) => verifiedDirectoryMembers(
    requestedIds ? members.filter((member) => requestedIds.has(member.id)) : members
  );
  if (statuses.size === 0) {
    return verifyPopulation(Array.from(explicitMap.values()));
  }

  const listResult = await listUsers();
  const users = (listResult.data?.users || []) as RawSectionMemberUser[];
  if (users.length >= 5000) throw new HttpsError("resource-exhausted", "Directory is too large to load safely");
  for (const u of users) {
    if (statuses.has(u.membershipStatus) && !explicitMap.has(u.id)) {
      explicitMap.set(u.id, toSectionMemberResponse(u));
    }
  }

  return verifyPopulation(Array.from(explicitMap.values()));
}

/**
 * Returns merged section members (explicit UserUserGroup + inherited by membership status).
 * Caller must have ACCESS/MODERATOR on a matching group, or current global admin authority.
 */
export const getSectionMembersMerged = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    await requireEnabled(request);
    await enforceRateLimit("getSectionMembersMerged", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;

    try {
      const members = await loadSectionMemberPopulation(sectionId, callerUid, currentAuthorization(request).isAdmin);
      logger.info(`getSectionMembersMerged: sectionId=${sectionId}, caller=${callerUid}, count=${members.length}`);
      return { members };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getSectionMembersMerged");
    }
  }
);

/** Resolve seating labels from the same verified section population as the directory. */
export const getSectionMemberNamesByIds = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    await requireEnabled(request);
    await enforceRateLimit("getSectionMemberNamesByIds", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const ids: unknown = request.data?.ids;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id || id.length > 128)) {
      throw new HttpsError("invalid-argument", "Provide at most 100 member IDs");
    }
    const actor = currentAuthorization(request);
    await requireSectionModerator(sectionId, actor.uid, actor.isAdmin);
    if (ids.length === 0) return { users: [] };
    const requested = new Set(ids as string[]);
    const population = await loadSectionMemberPopulation(sectionId, actor.uid, actor.isAdmin, requested);
    return { users: population.filter((member) => requested.has(member.id))
      .map(({ id, firstName, lastName }) => ({ id, firstName, lastName })) };
  }
);

const SEARCH_SECTION_MEMBERS_MAX_RESULTS = 20;
const SEARCH_SECTION_MEMBERS_MAX_INCLUDE_IDS = 10;

interface SectionMemberSearchScope {
  userGroupIds: string[];
  membershipStatuses: MembershipStatus[];
}

/**
 * Resolves the same explicit-group and inherited-status population used by the full
 * directory, without materialising either population. The actual name lookup stays in
 * Data Connect so the picker has a fixed backend row bound.
 */
async function loadSectionMemberSearchScope(
  sectionId: string,
  callerUid: string,
  callerIsAdmin = false
): Promise<SectionMemberSearchScope> {
  const [sectionResult, callerGroupsResult, userStatusResult] = await Promise.all([
    getSectionById({ id: sectionId }),
    getUserAccessGroupsById({ userId: callerUid }),
    getUserMembershipStatus({ id: callerUid }),
  ]);

  const section = sectionResult.data?.section;
  if (!section) {
    throw new HttpsError("not-found", "Section not found");
  }

  const links = section.purposeLinks ?? [];
  const accessLinks = links.filter(
    (link) => linkHasPurpose(link, "ACCESS") || linkHasPurpose(link, "MODERATOR")
  );
  const callerGroupIds = new Set(
    (callerGroupsResult.data?.user?.userGroups || []).map(
      (membership: { userGroup: { id: string } }) => membership.userGroup.id
    )
  );
  const callerStatus = userStatusResult.data?.user?.membershipStatus;
  const canAccess = accessLinks.some(
    (link) =>
      callerGroupIds.has(link.userGroup.id) ||
      Boolean(callerStatus && link.userGroup.membershipStatuses?.includes(callerStatus))
  );
  if (!callerIsAdmin && !canAccess) {
    throw new HttpsError("permission-denied", "You do not have permission to view this section");
  }

  const memberLinks = links.filter((link) => linkHasPurpose(link, "MEMBER"));
  const sourceLinks =
    memberLinks.length > 0
      ? memberLinks
      : section.type === SectionType.EVENTS
        ? accessLinks
        : [];

  return {
    userGroupIds: [...new Set(sourceLinks.map((link) => link.userGroup.id))],
    membershipStatuses: [
      ...new Set(sourceLinks.flatMap((link) => link.userGroup.membershipStatuses ?? [])),
    ],
  };
}

export interface SectionMemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Typeahead search over a section's eligible population, for pickers (e.g. the booking
 * wizard's "sit next to" field) where the section's full member list is too large to load
 * into a dropdown -- a squadron roster can run into the hundreds. Matches by name, capped to
 * a manageable result set. `includeIds` (already-selected ids, e.g. from an existing booking
 * being edited) are always resolved and returned regardless of the search term, so a picker
 * can label previously-chosen people without needing them to reappear in a fresh search.
 */
export const searchSectionMembers = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    await requireEnabled(request);
    await enforceRateLimit("searchSectionMembers", request.auth!.uid);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const searchTerm = typeof request.data?.searchTerm === "string" ? request.data.searchTerm.trim() : "";
    const includeIds = new Set<string>(
      (Array.isArray(request.data?.includeIds) ? request.data.includeIds : [])
        .filter((v: unknown): v is string => typeof v === "string")
        .slice(0, SEARCH_SECTION_MEMBERS_MAX_INCLUDE_IDS)
    );
    const callerUid = request.auth!.uid;

    try {
      const scope = await loadSectionMemberSearchScope(sectionId, callerUid, currentAuthorization(request).isAdmin);
      const forBooking = request.data?.forBooking === true;
      if (forBooking) await requireSectionModerator(sectionId, callerUid, currentAuthorization(request).isAdmin);
      if (!searchTerm && includeIds.size === 0) {
        return { members: [], hasMore: false };
      }

      const result = await searchSectionMemberCandidates({
        userGroupIds: scope.userGroupIds,
        membershipStatuses: scope.membershipStatuses,
        searchPattern: caseInsensitiveContainsPattern(searchTerm),
        includeIds: [...includeIds],
        limit: SEARCH_SECTION_MEMBERS_MAX_RESULTS + 1,
      });

      const included = [
        ...(result.data.includedExplicit ?? []).map((membership) => membership.user),
        ...(result.data.includedInherited ?? []),
      ];
      const searched = [
        ...(result.data.explicit ?? []).map((membership) => membership.user),
        ...(result.data.inherited ?? []),
      ].sort((a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName) ||
        a.id.localeCompare(b.id)
      );
      const seen = new Set<string>();
      const selectedMembers: SectionMemberSearchResult[] = [];
      const searchMembers: SectionMemberSearchResult[] = [];
      for (const member of included) {
        if ((!forBooking && member.id === callerUid) || seen.has(member.id)) continue;
        seen.add(member.id);
        selectedMembers.push({ id: member.id, firstName: member.firstName, lastName: member.lastName });
      }
      if (searchTerm) {
        for (const member of searched) {
          if ((!forBooking && member.id === callerUid) || seen.has(member.id)) continue;
          seen.add(member.id);
          searchMembers.push({ id: member.id, firstName: member.firstName, lastName: member.lastName });
        }
      }
      const hasMore = searchMembers.length > SEARCH_SECTION_MEMBERS_MAX_RESULTS;
      const members = [...selectedMembers, ...searchMembers.slice(0, SEARCH_SECTION_MEMBERS_MAX_RESULTS)];
      return { members: forBooking ? await Promise.all(members.map(async (member) => ({
        ...member, email: (await getUserMembershipStatus({ id: member.id })).data.user?.email ?? null,
      }))) : members, hasMore };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "searchSectionMembers");
    }
  }
);

export interface SectionForUserResponse {
  section: NonNullable<GetSectionByIdData["section"]> | null;
  hasAccess: boolean;
  canModerate: boolean;
}

/**
 * Section lookup for a regular member (or admin). GetSectionById itself is admin-only in
 * Data Connect, since it accepts an arbitrary id with no relationship check — this is the
 * only path a non-admin has to a section's details, and it's scoped to their actual access.
 * Does not throw for an unauthorized caller: returns hasAccess/canModerate: false so the
 * client can render an access-denied state rather than an error boundary.
 */
export const getSectionForUser = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<SectionForUserResponse> => {
    await requireEnabled(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;
    const callerIsAdmin = currentAuthorization(request).isAdmin;

    try {
      const { section, hasAccess, canModerate } = await resolveSectionAccess(sectionId, callerUid);
      if (!callerIsAdmin && !hasAccess) {
        return { section: null, hasAccess: false, canModerate: false };
      }
      return { section, hasAccess: true, canModerate: callerIsAdmin || canModerate };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getSectionForUser");
    }
  }
);

export interface SectionEventsForUserResponse {
  events: NonNullable<Awaited<ReturnType<typeof getEventsForSection>>["data"]["section"]>["events"];
}

/** Events for a section, gated the same way as getSectionForUser. */
export const getSectionEventsForUser = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<SectionEventsForUserResponse> => {
    await requireEnabled(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;
    const callerIsAdmin = currentAuthorization(request).isAdmin;

    try {
      const { hasAccess } = await resolveSectionAccess(sectionId, callerUid);
      if (!callerIsAdmin && !hasAccess) {
        throw new HttpsError("permission-denied", "You do not have permission to view this section");
      }
      const result = await getEventsForSection({ sectionId });
      return { events: result.data?.section?.events ?? [] };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getSectionEventsForUser");
    }
  }
);

export interface EventForUserResponse {
  event: NonNullable<Awaited<ReturnType<typeof getEventById>>["data"]["event"]> | null;
}

/** Single event lookup, gated on access to the event's own section. */
export const getEventForUser = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<EventForUserResponse> => {
    await requireEnabled(request);
    const eventId = requireString(request.data?.eventId, "eventId");
    const callerUid = request.auth!.uid;
    const callerIsAdmin = currentAuthorization(request).isAdmin;

    try {
      const eventResult = await getEventById({ id: eventId });
      const event = eventResult.data?.event;
      if (!event) {
        throw new HttpsError("not-found", "Event not found");
      }
      const { hasAccess } = await resolveSectionAccess(event.section.id, callerUid);
      if (!callerIsAdmin && !hasAccess) {
        throw new HttpsError("permission-denied", "You do not have permission to view this event");
      }
      return {
        event: {
          ...event,
          ticketTypes: (event.ticketTypes ?? []).filter(
            (ticketType) => ticketType.audience !== TicketAudience.ORGANISER_GUEST,
          ),
        },
      };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getEventForUser");
    }
  }
);
