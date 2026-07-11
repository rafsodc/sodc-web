import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth, requireEnabled, requireString, handleFunctionError } from "./helpers";
import {
  getSectionById,
  getSectionMembers,
  getEventsForSection,
  getEventById,
  getUserAccessGroupsById,
  getUserMembershipStatus,
  listUsers,
  type GetSectionByIdData,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";

export interface SectionMemberResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: string;
}

function linkHasPurpose(link: { purpose?: string; purposes?: string[] | null }, target: string): boolean {
  return link.purpose === target || (link.purposes?.includes(target) ?? false);
}

interface SectionAccess {
  section: NonNullable<GetSectionByIdData["section"]>;
  hasAccess: boolean;
  canModerate: boolean;
}

/**
 * Fetches a section and determines whether callerUid has ACCESS/MODERATOR purpose on it
 * (explicit group membership or membership-status-derived), independent of callerIsAdmin.
 * Used by every section/event lookup a non-admin member is allowed to make, since the
 * underlying GetSectionById/GetEventsForSection/GetEventById Data Connect queries are
 * admin-only — this is the only path a regular member has to that data, and it's gated
 * on their actual relationship to the section rather than an arbitrary client-supplied id.
 */
async function resolveSectionAccess(sectionId: string, callerUid: string): Promise<SectionAccess> {
  const [sectionResult, callerGroupsResult, userStatusResult] = await Promise.all([
    getSectionById({ id: sectionId }),
    getUserAccessGroupsById({ userId: callerUid }),
    getUserMembershipStatus({ id: callerUid }),
  ]);

  const section = sectionResult.data?.section;
  if (!section) {
    throw new HttpsError("not-found", "Section not found");
  }

  const purposeLinks = section.purposeLinks ?? [];
  const callerGroupIds = new Set(
    (callerGroupsResult.data?.user?.userGroups ?? []).map(
      (ug: { userGroup: { id: string } }) => ug.userGroup.id
    )
  );
  const userStatus = userStatusResult.data?.user?.membershipStatus;

  const matchesPurpose = (target: string) =>
    purposeLinks.some((pl) => {
      if (!linkHasPurpose(pl, target)) return false;
      if (callerGroupIds.has(pl.userGroup.id)) return true;
      return userStatus ? (pl.userGroup.membershipStatuses?.includes(userStatus) ?? false) : false;
    });

  const canModerate = matchesPurpose("MODERATOR");
  const hasAccess = canModerate || matchesPurpose("ACCESS");

  return { section, hasAccess, canModerate };
}

/**
 * Returns merged section members (explicit UserUserGroup + inherited by membership status).
 * Caller must have ACCESS to the section (or MODERATOR on a matching group).
 */
export const getSectionMembersMerged = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    requireAuth(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;

    try {
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
        (callerGroupsResult.data?.user?.userGroups || []).map(
          (ug: { userGroup: { id: string } }) => ug.userGroup.id
        )
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

      if (!canAccess && !canAccessByStatus) {
        throw new HttpsError("permission-denied", "You do not have permission to view this section");
      }

      const sectionData = membersResult.data?.section;
      if (!sectionData) {
        return { members: [] };
      }

      const links = sectionData.purposeLinks ?? [];
      const memberLinks = links.filter((p) => linkHasPurpose(p, "MEMBER"));
      const sourceLinks = memberLinks.length > 0 ? memberLinks : links.filter((p) => linkHasPurpose(p, "ACCESS"));

      const statuses = new Set<string>();
      const explicitMap = new Map<string, SectionMemberResponse>();

      for (const rel of sourceLinks) {
        const group = (rel as { userGroup: { membershipStatuses?: string[]; users: Array<{ user: SectionMemberResponse }> } })
          .userGroup;
        if (group.membershipStatuses) {
          group.membershipStatuses.forEach((s: string) => statuses.add(s));
        }
        for (const uag of group.users || []) {
          const u = uag.user;
          if (!explicitMap.has(u.id)) {
            explicitMap.set(u.id, {
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email,
              membershipStatus: u.membershipStatus,
            });
          }
        }
      }

      if (statuses.size === 0) {
        return { members: Array.from(explicitMap.values()) };
      }

      const listResult = await listUsers();
      const users = listResult.data?.users || [];
      for (const u of users) {
        if (statuses.has(u.membershipStatus) && !explicitMap.has(u.id)) {
          explicitMap.set(u.id, {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            membershipStatus: u.membershipStatus,
          });
        }
      }

      const members = Array.from(explicitMap.values());
      logger.info(`getSectionMembersMerged: sectionId=${sectionId}, caller=${callerUid}, count=${members.length}`);
      return { members };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getSectionMembersMerged");
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
    requireEnabled(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;
    const callerIsAdmin = request.auth!.token?.admin === true;

    try {
      const { section, hasAccess, canModerate } = await resolveSectionAccess(sectionId, callerUid);
      if (!callerIsAdmin && !hasAccess) {
        return { section: null, hasAccess: false, canModerate: false };
      }
      return { section, hasAccess: true, canModerate };
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
    requireEnabled(request);
    const sectionId = requireString(request.data?.sectionId, "sectionId");
    const callerUid = request.auth!.uid;
    const callerIsAdmin = request.auth!.token?.admin === true;

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
    requireEnabled(request);
    const eventId = requireString(request.data?.eventId, "eventId");
    const callerUid = request.auth!.uid;
    const callerIsAdmin = request.auth!.token?.admin === true;

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
      return { event };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      handleFunctionError(e as Error, "getEventForUser");
    }
  }
);
